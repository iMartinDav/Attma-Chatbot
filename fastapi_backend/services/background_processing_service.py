"""
Background Processing Service.

This module provides an asynchronous background processing service for
long-running tasks such as bioinformatics analyses, graph visualizations,
and data transformations.
"""

import os
import uuid
import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable, Awaitable, Union
from datetime import datetime
import json

from fastapi import BackgroundTasks
from fastapi.encoders import jsonable_encoder

from fastapi_backend.dataprep.biodata.processing_queue import (
    ProcessingQueue, JobStatus, JobPriority
)
from fastapi_backend.app.graph_storage import (
    insert_analysis_result, get_analysis_result,
    update_analysis_result, list_analysis_results
)

# Configure logging
logger = logging.getLogger(__name__)

# Global processing queue instance
_processing_queue = None


def get_processing_queue(
    max_workers: int = 4,
    job_timeout: int = 3600,
    retry_limit: int = 2
) -> ProcessingQueue:
    """
    Get or create the global processing queue.
    
    Args:
        max_workers: Maximum number of concurrent worker threads
        job_timeout: Maximum time (seconds) a job can run before timing out
        retry_limit: Maximum number of retry attempts for failed jobs
        
    Returns:
        ProcessingQueue instance
    """
    global _processing_queue
    
    if _processing_queue is None:
        _processing_queue = ProcessingQueue(
            max_workers=max_workers,
            job_timeout=job_timeout,
            retry_limit=retry_limit
        )
        # Start the queue
        _processing_queue.start()
        logger.info(f"Started processing queue with {max_workers} workers")
    
    return _processing_queue


class BackgroundAnalysisService:
    """
    Service for handling background analysis tasks.
    
    This service provides methods for submitting analysis tasks
    to the processing queue and monitoring their status.
    """
    
    def __init__(
        self,
        max_workers: int = 4,
        job_timeout: int = 3600,
        retry_limit: int = 2
    ):
        self.queue = get_processing_queue(
            max_workers=max_workers,
            job_timeout=job_timeout,
            retry_limit=retry_limit
        )
        self._register_handlers()
    
    def _register_handlers(self):
        """Register default handlers for common task types."""
        # Register handlers for different analysis types
        self.queue.register_handler("analysis", self._handle_analysis_job)
        self.queue.register_handler("visualization", self._handle_visualization_job)
        self.queue.register_handler("data_transformation", self._handle_transformation_job)
    
    def _handle_analysis_job(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a generic analysis job.
        
        Args:
            params: Job parameters
            
        Returns:
            Job result
        """
        try:
            # Get the analysis type
            analysis_type = params.get("analysis_type", "unknown")
            logger.info(f"Processing analysis job of type {analysis_type}")
            
            # Process the analysis (placeholder for actual analysis)
            # In a real implementation, this would dispatch to specific analysis functions
            
            # Record the result in the database
            user_id = params.get("user_id", "default")
            metadata = params.get("metadata", {})
            
            # Create result data
            result_data = {
                "analysis_type": analysis_type,
                "processed_at": datetime.now().isoformat(),
                "result": "Analysis completed successfully"
            }
            
            # Store small result directly in the database
            if asyncio.get_event_loop().is_running():
                # If we're in an async context
                loop = asyncio.get_event_loop()
                success, message, result_id = loop.run_until_complete(
                    insert_analysis_result(
                        user_id=user_id,
                        analysis_type=analysis_type,
                        result_type="analysis",
                        storage_type="database",
                        metadata=metadata,
                        small_result=result_data
                    )
                )
            else:
                # Create a new event loop for this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    success, message, result_id = loop.run_until_complete(
                        insert_analysis_result(
                            user_id=user_id,
                            analysis_type=analysis_type,
                            result_type="analysis",
                            storage_type="database",
                            metadata=metadata,
                            small_result=result_data
                        )
                    )
                finally:
                    loop.close()
            
            if not success:
                raise ValueError(f"Failed to store analysis result: {message}")
            
            return {
                "status": "success",
                "result_id": result_id,
                "message": "Analysis completed successfully"
            }
            
        except Exception as e:
            logger.error(f"Error in analysis job: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def _handle_visualization_job(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a visualization job.
        
        Args:
            params: Job parameters
            
        Returns:
            Job result
        """
        try:
            # Extract parameters
            viz_type = params.get("visualization_type", "graph")
            user_id = params.get("user_id", "default")
            metadata = params.get("metadata", {})
            
            # Check if this is a plot visualization
            if viz_type in ["umap", "tsne", "pca", "spatial", "heatmap", "violin", "scatter"]:
                from fastapi_backend.services.single_cell_service import get_single_cell_service
                
                # Get single cell service
                sc_service = get_single_cell_service()
                
                # Get parameters
                adata_id = params.get("adata_id")
                if not adata_id:
                    raise ValueError("Missing required parameter: adata_id")
                
                plot_params = params.get("parameters", {})
                width = params.get("plot_width", 800)
                height = params.get("plot_height", 600)
                
                # Generate the plot
                plot_data = sc_service.generate_plot(
                    adata_id, 
                    viz_type, 
                    plot_params,
                    width=width,
                    height=height
                )
                
                # Store the plot in Vercel Blob Storage
                from fastapi_backend.analysis.utility import store_plot_visualization
                
                plot_bytes = plot_data["plot_bytes"]
                
                # Setup asyncio to run the async function
                if asyncio.get_event_loop().is_running():
                    loop = asyncio.get_event_loop()
                    success, message, result = loop.run_until_complete(
                        store_plot_visualization(
                            plot_data=plot_bytes,
                            title=f"{viz_type.upper()} Plot",
                            plot_type=viz_type,
                            user_id=user_id,
                            metadata={
                                "adata_id": adata_id,
                                "parameters": plot_params,
                                "generated_at": datetime.now().isoformat()
                            }
                        )
                    )
                else:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        success, message, result = loop.run_until_complete(
                            store_plot_visualization(
                                plot_data=plot_bytes,
                                title=f"{viz_type.upper()} Plot",
                                plot_type=viz_type,
                                user_id=user_id,
                                metadata={
                                    "adata_id": adata_id,
                                    "parameters": plot_params,
                                    "generated_at": datetime.now().isoformat()
                                }
                            )
                        )
                    finally:
                        loop.close()
                
                if not success:
                    raise ValueError(f"Failed to store plot: {message}")
                
                return {
                    "status": "success",
                    "result_id": result["id"],
                    "url": result["url"],
                    "message": f"{viz_type} plot generated and stored successfully"
                }
                
            # Default handling for other visualization types
            else:
                # Create dummy result
                result_data = {
                    "visualization_type": viz_type,
                    "generated_at": datetime.now().isoformat(),
                    "result": "Visualization created successfully"
                }
                
                # Similar to analysis job handler, store result in database
                if asyncio.get_event_loop().is_running():
                    loop = asyncio.get_event_loop()
                    success, message, result_id = loop.run_until_complete(
                        insert_analysis_result(
                            user_id=user_id,
                            analysis_type=f"visualization_{viz_type}",
                            result_type="visualization",
                            storage_type="database",
                            metadata=metadata,
                            small_result=result_data
                        )
                    )
                else:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        success, message, result_id = loop.run_until_complete(
                            insert_analysis_result(
                                user_id=user_id,
                                analysis_type=f"visualization_{viz_type}",
                                result_type="visualization",
                                storage_type="database",
                                metadata=metadata,
                                small_result=result_data
                            )
                        )
                    finally:
                        loop.close()
                
                if not success:
                    raise ValueError(f"Failed to store visualization result: {message}")
                
                return {
                    "status": "success",
                    "result_id": result_id,
                    "message": "Visualization created successfully"
                }
                
        except Exception as e:
            logger.error(f"Error in visualization job: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def _handle_transformation_job(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a data transformation job.
        
        Args:
            params: Job parameters
            
        Returns:
            Job result
        """
        try:
            # Process data transformation
            transform_type = params.get("transform_type", "unknown")
            logger.info(f"Processing data transformation of type {transform_type}")
            
            # Create dummy result (replace with actual transformation code)
            result = {
                "transform_type": transform_type,
                "processed": True,
                "timestamp": datetime.now().isoformat()
            }
            
            return {
                "status": "success",
                "result": result,
                "message": "Data transformation completed successfully"
            }
            
        except Exception as e:
            logger.error(f"Error in data transformation job: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def submit_analysis_task(
        self,
        analysis_type: str,
        params: Dict[str, Any],
        user_id: Optional[str] = None,
        priority: JobPriority = JobPriority.NORMAL,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Submit an analysis task to be processed in the background.
        
        Args:
            analysis_type: Type of analysis to perform
            params: Parameters for the analysis
            user_id: ID of the user submitting the task
            priority: Priority level for the task
            metadata: Additional metadata for the task
            
        Returns:
            Task ID for tracking
        """
        # Create job parameters
        job_params = {
            "analysis_type": analysis_type,
            "user_id": user_id,
            "metadata": metadata or {},
            **params
        }
        
        # Submit to queue
        task_id = self.queue.submit_job(
            job_type="analysis",
            params=job_params,
            user_id=user_id,
            priority=priority,
            metadata=metadata
        )
        
        logger.info(f"Submitted analysis task {task_id} of type {analysis_type}")
        return task_id
    
    def submit_visualization_task(
        self,
        visualization_type: str,
        params: Dict[str, Any],
        user_id: Optional[str] = None,
        priority: JobPriority = JobPriority.NORMAL,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Submit a visualization task to be processed in the background.
        
        Args:
            visualization_type: Type of visualization to create
            params: Parameters for the visualization
            user_id: ID of the user submitting the task
            priority: Priority level for the task
            metadata: Additional metadata for the task
            
        Returns:
            Task ID for tracking
        """
        # Create job parameters
        job_params = {
            "visualization_type": visualization_type,
            "user_id": user_id,
            "metadata": metadata or {},
            **params
        }
        
        # Submit to queue
        task_id = self.queue.submit_job(
            job_type="visualization",
            params=job_params,
            user_id=user_id,
            priority=priority,
            metadata=metadata
        )
        
        logger.info(f"Submitted visualization task {task_id} of type {visualization_type}")
        return task_id
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a background task.
        
        Args:
            task_id: ID of the task to check
            
        Returns:
            Task status dictionary, or None if task not found
        """
        return self.queue.get_job_status(task_id)
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a pending or running task.
        
        Args:
            task_id: ID of the task to cancel
            
        Returns:
            True if task was canceled, False otherwise
        """
        return self.queue.cancel_job(task_id)
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the current state of the task queue.
        
        Returns:
            Dictionary with queue statistics
        """
        return self.queue.get_queue_stats()
    
    def list_tasks(
        self,
        status: Optional[Union[JobStatus, List[JobStatus]]] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List background tasks, optionally filtered by status.
        
        Args:
            status: Filter by task status (or list of statuses)
            user_id: Filter by user ID
            limit: Maximum number of tasks to return
            offset: Offset for pagination
            
        Returns:
            List of task dictionaries
        """
        return self.queue.list_jobs(
            status=status,
            user_id=user_id,
            limit=limit,
            offset=offset
        )


# Singleton instance
_background_service = None


def get_background_service(
    max_workers: int = 4,
    job_timeout: int = 3600,
    retry_limit: int = 2
) -> BackgroundAnalysisService:
    """
    Get or create the singleton background service.
    
    Args:
        max_workers: Maximum number of concurrent worker threads
        job_timeout: Maximum time (seconds) a job can run before timing out
        retry_limit: Maximum number of retry attempts for failed jobs
        
    Returns:
        BackgroundAnalysisService instance
    """
    global _background_service
    
    if _background_service is None:
        _background_service = BackgroundAnalysisService(
            max_workers=max_workers,
            job_timeout=job_timeout,
            retry_limit=retry_limit
        )
    
    return _background_service


async def run_in_background(
    background_tasks: BackgroundTasks,
    func: Callable[..., Awaitable[Any]],
    *args,
    **kwargs
) -> str:
    """
    Run a function in the background using FastAPI's BackgroundTasks.
    
    Args:
        background_tasks: BackgroundTasks instance from FastAPI
        func: Function to run in the background
        *args: Arguments to pass to the function
        **kwargs: Keyword arguments to pass to the function
        
    Returns:
        Task ID for tracking
    """
    task_id = str(uuid.uuid4())
    
    # Define the background task
    async def _run_task():
        try:
            # Execute the function
            result = await func(*args, **kwargs)
            
            # Record the result (implement as needed)
            logger.info(f"Background task {task_id} completed successfully")
            return result
        except Exception as e:
            logger.error(f"Error in background task {task_id}: {str(e)}")
            raise
    
    # Add to background tasks
    background_tasks.add_task(_run_task)
    
    return task_id