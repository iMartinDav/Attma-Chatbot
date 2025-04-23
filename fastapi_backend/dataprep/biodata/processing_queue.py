"""
Processing Queue for Bioinformatics Data Analysis.

This module provides a queue system for processing large bioinformatics datasets
with priority handling, status monitoring, and graceful error recovery.
"""

import os
import time
import uuid
import logging
import threading
import asyncio
from enum import Enum
from typing import Dict, Any, List, Optional, Callable, Awaitable, Union, Tuple
from dataclasses import dataclass, field
from queue import PriorityQueue, Empty
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Status of a job in the processing queue."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class JobPriority(int, Enum):
    """Priority levels for jobs in the queue."""
    HIGH = 1
    NORMAL = 2
    LOW = 3


@dataclass(order=True)
class ProcessingJob:
    """
    A job to be processed in the queue.
    
    Attributes:
        priority: Job priority level
        job_id: Unique identifier for the job
        status: Current status of the job
        created_at: When the job was created
        updated_at: When the job was last updated
        user_id: ID of the user who submitted the job
        job_type: Type of analysis to perform
        params: Parameters for the analysis
        result: Result of the analysis (if completed)
        error: Error information (if failed)
        metadata: Additional job metadata
    """
    priority: JobPriority = field(compare=True)
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()), compare=False)
    status: JobStatus = field(default=JobStatus.PENDING, compare=False)
    created_at: datetime = field(default_factory=datetime.now, compare=False)
    updated_at: datetime = field(default_factory=datetime.now, compare=False)
    user_id: str = field(default=None, compare=False)
    job_type: str = field(default=None, compare=False)
    params: Dict[str, Any] = field(default_factory=dict, compare=False)
    result: Optional[Dict[str, Any]] = field(default=None, compare=False)
    error: Optional[str] = field(default=None, compare=False)
    metadata: Dict[str, Any] = field(default_factory=dict, compare=False)

    def update_status(self, status: JobStatus, error: Optional[str] = None) -> None:
        """Update the job status and timestamp."""
        self.status = status
        self.updated_at = datetime.now()
        if error and status == JobStatus.FAILED:
            self.error = error
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary for serialization."""
        return {
            "job_id": self.job_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "user_id": self.user_id,
            "job_type": self.job_type,
            "params": self.params,
            "result": self.result,
            "error": self.error,
            "metadata": self.metadata,
            "priority": int(self.priority)
        }


class ProcessingQueue:
    """
    Queue system for processing bioinformatics data analysis jobs.
    
    This class manages a priority queue of analysis jobs, executing them
    based on priority and handling failures gracefully.
    
    Attributes:
        max_workers: Maximum number of concurrent worker threads
        job_timeout: Maximum time (seconds) a job can run before timing out
        retry_limit: Maximum number of retry attempts for failed jobs
        job_handlers: Registry of job type handlers
    """
    
    def __init__(
        self, 
        max_workers: int = 4, 
        job_timeout: int = 3600,
        retry_limit: int = 2
    ):
        """
        Initialize the processing queue.
        
        Args:
            max_workers: Maximum number of concurrent worker threads
            job_timeout: Maximum time (seconds) a job can run before timing out
            retry_limit: Maximum number of retry attempts for failed jobs
        """
        self.max_workers = max_workers
        self.job_timeout = job_timeout
        self.retry_limit = retry_limit
        self.queue = PriorityQueue()
        self.active_jobs: Dict[str, ProcessingJob] = {}
        self.completed_jobs: Dict[str, ProcessingJob] = {}
        self.job_handlers: Dict[str, Callable] = {}
        self.workers: List[threading.Thread] = []
        self.running = False
        self._lock = threading.RLock()
        self._job_event = threading.Event()
    
    def register_handler(self, job_type: str, handler: Callable[[Dict[str, Any]], Dict[str, Any]]) -> None:
        """
        Register a handler function for a specific job type.
        
        Args:
            job_type: Type of job this handler can process
            handler: Function that processes the job (takes params, returns result)
        """
        with self._lock:
            self.job_handlers[job_type] = handler
            logger.info(f"Registered handler for job type: {job_type}")
    
    def submit_job(
        self, 
        job_type: str, 
        params: Dict[str, Any], 
        user_id: str = None,
        priority: JobPriority = JobPriority.NORMAL,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Submit a job to the processing queue.
        
        Args:
            job_type: Type of job to process
            params: Parameters for the job
            user_id: ID of the user submitting the job
            priority: Priority level for the job
            metadata: Additional metadata for the job
            
        Returns:
            Job ID for tracking
            
        Raises:
            ValueError: If job_type has no registered handler
        """
        if job_type not in self.job_handlers:
            raise ValueError(f"No handler registered for job type: {job_type}")
        
        # Create a new job
        job = ProcessingJob(
            priority=priority,
            user_id=user_id,
            job_type=job_type,
            params=params,
            metadata=metadata or {}
        )
        
        with self._lock:
            # Add job to queue
            self.queue.put(job)
            self.active_jobs[job.job_id] = job
        
        # Signal that a new job is available
        self._job_event.set()
        
        logger.info(f"Submitted job {job.job_id} of type {job_type} with priority {priority}")
        return job.job_id
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the current status of a job.
        
        Args:
            job_id: ID of the job to check
            
        Returns:
            Job status dictionary, or None if job not found
        """
        with self._lock:
            if job_id in self.active_jobs:
                return self.active_jobs[job_id].to_dict()
            elif job_id in self.completed_jobs:
                return self.completed_jobs[job_id].to_dict()
        return None
    
    def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a pending or active job.
        
        Args:
            job_id: ID of the job to cancel
            
        Returns:
            True if job was canceled, False otherwise
        """
        with self._lock:
            if job_id in self.active_jobs:
                job = self.active_jobs[job_id]
                if job.status == JobStatus.PENDING:
                    # Mark job as canceled
                    job.update_status(JobStatus.CANCELED)
                    # Move to completed jobs
                    self.completed_jobs[job_id] = job
                    del self.active_jobs[job_id]
                    logger.info(f"Canceled pending job: {job_id}")
                    return True
                elif job.status == JobStatus.PROCESSING:
                    # Mark job for cancellation
                    job.update_status(JobStatus.CANCELED)
                    logger.info(f"Marked active job for cancellation: {job_id}")
                    return True
        
        logger.warning(f"Could not cancel job {job_id}: not found or already completed")
        return False
    
    def start(self) -> None:
        """
        Start the processing queue workers.
        """
        if self.running:
            logger.warning("Processing queue is already running")
            return
        
        self.running = True
        logger.info(f"Starting processing queue with {self.max_workers} workers")
        
        # Create worker threads
        for i in range(self.max_workers):
            thread = threading.Thread(
                target=self._worker_loop,
                name=f"ProcessingWorker-{i}",
                daemon=True
            )
            self.workers.append(thread)
            thread.start()
    
    def stop(self, wait: bool = True) -> None:
        """
        Stop the processing queue.
        
        Args:
            wait: If True, wait for current jobs to complete
        """
        if not self.running:
            return
        
        logger.info("Stopping processing queue")
        self.running = False
        self._job_event.set()  # Wake up any waiting workers
        
        if wait and self.workers:
            for thread in self.workers:
                thread.join(timeout=5.0)
            
            logger.info("Processing queue stopped, all workers joined")
        
        self.workers = []
    
    def _worker_loop(self) -> None:
        """Worker thread loop that processes jobs from the queue."""
        thread_name = threading.current_thread().name
        logger.info(f"Worker thread {thread_name} starting")
        
        while self.running:
            try:
                # Try to get a job from the queue
                try:
                    job = self.queue.get(block=True, timeout=1.0)
                except Empty:
                    # No jobs in queue, wait for notification or timeout
                    self._job_event.wait(timeout=5.0)
                    self._job_event.clear()
                    continue
                
                # Skip canceled jobs
                if job.status == JobStatus.CANCELED:
                    self.queue.task_done()
                    continue
                
                # Process the job
                self._process_job(job, thread_name)
                
                # Mark queue task as done
                self.queue.task_done()
            
            except Exception as e:
                logger.error(f"Error in worker thread {thread_name}: {str(e)}")
        
        logger.info(f"Worker thread {thread_name} stopping")
    
    def _process_job(self, job: ProcessingJob, thread_name: str) -> None:
        """
        Process a single job.
        
        Args:
            job: The job to process
            thread_name: Name of the worker thread
        """
        start_time = time.time()
        retry_count = job.metadata.get("retry_count", 0)
        
        try:
            # Update job status
            with self._lock:
                job.update_status(JobStatus.PROCESSING)
                logger.info(f"Worker {thread_name} processing job {job.job_id} of type {job.job_type}")
            
            # Check if job has been canceled
            if job.status == JobStatus.CANCELED:
                logger.info(f"Job {job.job_id} was canceled, skipping processing")
                with self._lock:
                    if job.job_id in self.active_jobs:
                        self.completed_jobs[job.job_id] = job
                        del self.active_jobs[job.job_id]
                return
            
            # Get the handler for this job type
            handler = self.job_handlers.get(job.job_type)
            if not handler:
                raise ValueError(f"No handler found for job type: {job.job_type}")
            
            # Execute the handler with job parameters
            result = handler(job.params)
            
            # Update job with result
            with self._lock:
                job.result = result
                job.update_status(JobStatus.COMPLETED)
                
                # Move to completed jobs
                if job.job_id in self.active_jobs:
                    self.completed_jobs[job.job_id] = job
                    del self.active_jobs[job.job_id]
            
            elapsed_time = time.time() - start_time
            logger.info(f"Job {job.job_id} completed in {elapsed_time:.2f} seconds")
        
        except Exception as e:
            elapsed_time = time.time() - start_time
            error_msg = f"Job {job.job_id} failed after {elapsed_time:.2f} seconds: {str(e)}"
            logger.error(error_msg)
            
            with self._lock:
                # Increment retry count
                retry_count += 1
                job.metadata["retry_count"] = retry_count
                
                # Check if we should retry
                if retry_count <= self.retry_limit:
                    logger.info(f"Retrying job {job.job_id} (attempt {retry_count} of {self.retry_limit})")
                    job.update_status(JobStatus.PENDING)
                    # Re-queue with reduced priority
                    job.priority = JobPriority(min(int(job.priority) + 1, 3))
                    self.queue.put(job)
                else:
                    # Mark as failed after retry limit reached
                    job.update_status(JobStatus.FAILED, error=str(e))
                    
                    # Move to completed jobs
                    if job.job_id in self.active_jobs:
                        self.completed_jobs[job.job_id] = job
                        del self.active_jobs[job.job_id]
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the current state of the queue.
        
        Returns:
            Dictionary with queue statistics
        """
        with self._lock:
            pending_jobs = self.queue.qsize()
            active_jobs = sum(1 for job in self.active_jobs.values() 
                             if job.status == JobStatus.PROCESSING)
            completed_jobs = len(self.completed_jobs)
            failed_jobs = sum(1 for job in self.completed_jobs.values() 
                             if job.status == JobStatus.FAILED)
        
        return {
            "pending": pending_jobs,
            "active": active_jobs,
            "completed": completed_jobs,
            "failed": failed_jobs,
            "workers": len(self.workers),
            "running": self.running
        }
    
    def list_jobs(
        self, 
        status: Optional[Union[JobStatus, List[JobStatus]]] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List jobs in the queue, optionally filtered by status.
        
        Args:
            status: Filter by job status (or list of statuses)
            user_id: Filter by user ID
            limit: Maximum number of jobs to return
            offset: Offset for pagination
        
        Returns:
            List of job dictionaries
        """
        result = []
        status_list = []
        
        if status:
            if isinstance(status, list):
                status_list = status
            else:
                status_list = [status]
        
        with self._lock:
            # First add active jobs
            active_items = list(self.active_jobs.items())
            for job_id, job in active_items:
                if (not status_list or job.status in status_list) and \
                   (user_id is None or job.user_id == user_id):
                    result.append(job.to_dict())
            
            # Then add completed jobs
            completed_items = list(self.completed_jobs.items())
            for job_id, job in completed_items:
                if (not status_list or job.status in status_list) and \
                   (user_id is None or job.user_id == user_id):
                    result.append(job.to_dict())
        
        # Sort by creation time (newest first)
        result.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Apply pagination
        return result[offset:offset+limit]
    
    def clean_old_jobs(self, max_age_days: int = 7) -> int:
        """
        Remove completed or failed jobs older than the specified age.
        
        Args:
            max_age_days: Maximum age in days for jobs to keep
            
        Returns:
            Number of jobs removed
        """
        cutoff_time = datetime.now() - timedelta(days=max_age_days)
        removed_count = 0
        
        with self._lock:
            to_remove = []
            for job_id, job in self.completed_jobs.items():
                if job.created_at < cutoff_time:
                    to_remove.append(job_id)
            
            for job_id in to_remove:
                del self.completed_jobs[job_id]
                removed_count += 1
        
        if removed_count > 0:
            logger.info(f"Removed {removed_count} old jobs from queue")
        
        return removed_count


# Example usage
if __name__ == "__main__":
    # Create a processing queue
    queue = ProcessingQueue(max_workers=2)
    
    # Define a sample handler
    def sample_handler(params):
        time.sleep(2)  # Simulate work
        return {"result": f"Processed {params.get('input', 'unknown')}"}
    
    # Register the handler
    queue.register_handler("sample", sample_handler)
    
    # Start the queue
    queue.start()
    
    # Submit some jobs
    job1 = queue.submit_job("sample", {"input": "job1"}, priority=JobPriority.HIGH)
    job2 = queue.submit_job("sample", {"input": "job2"}, priority=JobPriority.NORMAL)
    job3 = queue.submit_job("sample", {"input": "job3"}, priority=JobPriority.LOW)
    
    # Wait for a bit
    time.sleep(1)
    
    # Print queue stats
    print(queue.get_queue_stats())
    
    # Wait for jobs to complete
    time.sleep(5)
    
    # Get job statuses
    print(f"Job 1 status: {queue.get_job_status(job1)}")
    print(f"Job 2 status: {queue.get_job_status(job2)}")
    print(f"Job 3 status: {queue.get_job_status(job3)}")
    
    # Stop the queue
    queue.stop()