"""
Unit tests for the processing queue component.
"""

import time
import unittest
from unittest.mock import MagicMock, patch
import threading
import uuid

from dataprep.biodata.processing_queue import (
    ProcessingQueue, JobPriority, JobStatus, ProcessingJob, JobError
)


class TestProcessingQueue(unittest.TestCase):
    """Test suite for the ProcessingQueue class."""
    
    def setUp(self):
        """Set up test fixtures before each test method is run."""
        self.queue = ProcessingQueue(max_workers=2)
        
        # Create a simple job handler that just returns its parameters
        def echo_handler(params):
            time.sleep(0.1)  # Small delay to simulate work
            return {"echo": params}
        
        # Register the handler
        self.queue.register_handler("echo", echo_handler)
        
        # Create a job handler that fails
        def failing_handler(params):
            raise ValueError("Test error")
        
        # Register the failing handler
        self.queue.register_handler("fail", failing_handler)
    
    def tearDown(self):
        """Tear down test fixtures after each test method is run."""
        if self.queue:
            self.queue.stop(wait=True)
    
    def test_queue_initialization(self):
        """Test that the queue initializes correctly."""
        self.assertEqual(self.queue.max_workers, 2)
        self.assertTrue(isinstance(self.queue._job_queue, list))
        self.assertTrue(isinstance(self.queue._handlers, dict))
    
    def test_job_submission_and_retrieval(self):
        """Test submitting a job to the queue and retrieving its status."""
        # Start the queue
        self.queue.start()
        
        # Submit a job
        test_params = {"test": "value"}
        job_id = self.queue.submit_job("echo", test_params)
        
        # Verify the job ID looks valid
        self.assertTrue(isinstance(job_id, str))
        self.assertEqual(len(job_id), 36)  # UUID length
        
        # Wait a moment for the job to be processed
        time.sleep(0.5)
        
        # Get the job status
        job_status = self.queue.get_job_status(job_id)
        
        # Verify the job completed
        self.assertEqual(job_status["status"], JobStatus.COMPLETED)
        self.assertEqual(job_status["result"]["echo"], test_params)
        
    def test_job_failure(self):
        """Test that the queue handles job failures correctly."""
        # Start the queue
        self.queue.start()
        
        # Submit a job that will fail
        job_id = self.queue.submit_job("fail", {"test": "value"})
        
        # Wait a moment for the job to be processed
        time.sleep(0.5)
        
        # Get the job status
        job_status = self.queue.get_job_status(job_id)
        
        # Verify the job failed
        self.assertEqual(job_status["status"], JobStatus.FAILED)
        self.assertTrue("Test error" in job_status["error"])
    
    def test_priority_handling(self):
        """Test that the queue processes jobs in priority order."""
        # Don't start the queue yet to control the test flow
        
        # Submit three jobs with different priorities
        low_job = self.queue.submit_job("echo", {"priority": "low"}, priority=JobPriority.LOW)
        normal_job = self.queue.submit_job("echo", {"priority": "normal"}, priority=JobPriority.NORMAL)
        high_job = self.queue.submit_job("echo", {"priority": "high"}, priority=JobPriority.HIGH)
        
        # Check the jobs in the queue
        jobs = self.queue._job_queue
        
        # Jobs should be ordered by priority (high to low)
        self.assertEqual(jobs[0].job_id, high_job)
        self.assertEqual(jobs[1].job_id, normal_job)
        self.assertEqual(jobs[2].job_id, low_job)
    
    def test_list_jobs(self):
        """Test listing jobs in the queue."""
        # Submit a few jobs but don't start the queue
        job1 = self.queue.submit_job("echo", {"id": 1}, user_id="user1")
        job2 = self.queue.submit_job("echo", {"id": 2}, user_id="user1")
        job3 = self.queue.submit_job("echo", {"id": 3}, user_id="user2")
        
        # List all jobs
        all_jobs = self.queue.list_jobs()
        self.assertEqual(len(all_jobs), 3)
        
        # List jobs by status
        pending_jobs = self.queue.list_jobs(status=JobStatus.PENDING)
        self.assertEqual(len(pending_jobs), 3)
        
        # List jobs by user
        user1_jobs = self.queue.list_jobs(user_id="user1")
        self.assertEqual(len(user1_jobs), 2)
        
        user2_jobs = self.queue.list_jobs(user_id="user2")
        self.assertEqual(len(user2_jobs), 1)
    
    def test_get_queue_stats(self):
        """Test getting queue statistics."""
        # Submit jobs in different states
        # One pending
        job1 = self.queue.submit_job("echo", {"id": 1})
        
        # Start the queue
        self.queue.start()
        
        # One completed
        job2 = self.queue.submit_job("echo", {"id": 2})
        time.sleep(0.5)  # Let it complete
        
        # One failed
        job3 = self.queue.submit_job("fail", {"id": 3})
        time.sleep(0.5)  # Let it fail
        
        # Get stats
        stats = self.queue.get_queue_stats()
        
        # Verify stats
        self.assertEqual(stats["total"], 3)
        self.assertEqual(stats["pending"], 1)
        self.assertEqual(stats["active"], 0)
        self.assertEqual(stats["completed"], 1)
        self.assertEqual(stats["failed"], 1)
    
    def test_job_timeout(self):
        """Test that jobs timeout after the specified time."""
        # Create a job that sleeps longer than the timeout
        def slow_handler(params):
            time.sleep(1.0)  # Sleep longer than timeout
            return {"result": "done"}
        
        # Create a queue with short timeout
        timeout_queue = ProcessingQueue(max_workers=1, job_timeout=0.5)
        timeout_queue.register_handler("slow", slow_handler)
        timeout_queue.start()
        
        # Submit job
        job_id = timeout_queue.submit_job("slow", {})
        
        # Wait for job to timeout
        time.sleep(2.0)
        
        # Check job status
        job_status = timeout_queue.get_job_status(job_id)
        self.assertEqual(job_status["status"], JobStatus.FAILED)
        self.assertTrue("timeout" in job_status["error"].lower())
        
        # Clean up
        timeout_queue.stop(wait=True)

    def test_job_retry(self):
        """Test job retry mechanism."""
        retry_attempts = []
        
        # Create a handler that fails twice then succeeds
        def retry_handler(params):
            attempt = len(retry_attempts)
            retry_attempts.append(attempt)
            
            if attempt < 2:  # Fail first two attempts
                raise ValueError(f"Failing attempt {attempt}")
                
            return {"success": True, "attempt": attempt}
        
        # Create a queue with retry
        retry_queue = ProcessingQueue(max_workers=1, retry_limit=2)
        retry_queue.register_handler("retry", retry_handler)
        retry_queue.start()
        
        # Submit job
        job_id = retry_queue.submit_job("retry", {})
        
        # Wait for job to complete with retries
        time.sleep(1.0)
        
        # Check job status
        job_status = retry_queue.get_job_status(job_id)
        self.assertEqual(job_status["status"], JobStatus.COMPLETED)
        self.assertEqual(job_status["result"]["attempt"], 2)
        self.assertEqual(len(retry_attempts), 3)  # Initial + 2 retries
        
        # Clean up
        retry_queue.stop(wait=True)


if __name__ == "__main__":
    unittest.main()