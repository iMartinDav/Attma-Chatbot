"""
Background Tasks API Routes.

This module provides API endpoints for submitting, monitoring,
and managing background tasks for bioinformatics analyses.
"""

import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from fastapi_backend.services.background_processing_service import (
    get_background_service, run_in_background, BackgroundAnalysisService
)
from fastapi_backend.app.users import current_active_user
from fastapi_backend.app.models import User

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["background-tasks"])


# Pydantic models for API requests and responses
class TaskRequest(BaseModel):
    """Base model for task requests."""
    task_type: str
    params: Dict[str, Any] = Field(default_factory=dict)
    priority: Optional[int] = 2  # Normal priority by default
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AnalysisTaskRequest(TaskRequest):
    """Model for analysis task requests."""
    task_type: str = "analysis"
    analysis_type: str


class VisualizationTaskRequest(TaskRequest):
    """Model for visualization task requests."""
    task_type: str = "visualization"
    visualization_type: str


class TaskSubmitResponse(BaseModel):
    """Response model for task submission."""
    task_id: str
    message: str


class TaskStatusResponse(BaseModel):
    """Response model for task status."""
    task_id: str
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class QueueStatsResponse(BaseModel):
    """Response model for queue statistics."""
    pending: int
    active: int
    completed: int
    failed: int
    workers: int
    running: bool


class TaskListResponse(BaseModel):
    """Response model for task listing."""
    tasks: List[TaskStatusResponse]
    total: int


def get_service() -> BackgroundAnalysisService:
    """Dependency to get the background service."""
    return get_background_service()


@router.post("/analysis", response_model=TaskSubmitResponse)
async def submit_analysis_task(
    request: AnalysisTaskRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(current_active_user),
    service: BackgroundAnalysisService = Depends(get_service)
):
    """
    Submit an analysis task to be processed in the background.
    
    The task will be queued and processed asynchronously.
    Returns a task ID that can be used to check the status of the task.
    """
    try:
        # Submit the task
        task_id = service.submit_analysis_task(
            analysis_type=request.analysis_type,
            params=request.params,
            user_id=str(current_user.id),
            priority=request.priority,
            metadata=request.metadata
        )
        
        return TaskSubmitResponse(
            task_id=task_id,
            message=f"Analysis task of type {request.analysis_type} submitted successfully"
        )
    except Exception as e:
        logger.error(f"Error submitting analysis task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error submitting analysis task: {str(e)}"
        )


@router.post("/visualization", response_model=TaskSubmitResponse)
async def submit_visualization_task(
    request: VisualizationTaskRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(current_active_user),
    service: BackgroundAnalysisService = Depends(get_service)
):
    """
    Submit a visualization task to be processed in the background.
    
    The task will be queued and processed asynchronously.
    Returns a task ID that can be used to check the status of the task.
    """
    try:
        # Submit the task
        task_id = service.submit_visualization_task(
            visualization_type=request.visualization_type,
            params=request.params,
            user_id=str(current_user.id),
            priority=request.priority,
            metadata=request.metadata
        )
        
        return TaskSubmitResponse(
            task_id=task_id,
            message=f"Visualization task of type {request.visualization_type} submitted successfully"
        )
    except Exception as e:
        logger.error(f"Error submitting visualization task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error submitting visualization task: {str(e)}"
        )


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(current_active_user),
    service: BackgroundAnalysisService = Depends(get_service)
):
    """
    Get the status of a background task.
    
    Returns the current status, result (if completed),
    or error message (if failed) for the specified task.
    """
    task_status = service.get_task_status(task_id)
    
    if not task_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
    
    # Check if the task belongs to the current user
    task_user_id = task_status.get("user_id")
    if task_user_id and task_user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this task"
        )
    
    return task_status


@router.delete("/cancel/{task_id}", response_model=Dict[str, Any])
async def cancel_task(
    task_id: str,
    current_user: User = Depends(current_active_user),
    service: BackgroundAnalysisService = Depends(get_service)
):
    """
    Cancel a pending or running task.
    
    Returns a success message if the task was canceled,
    or an error message if cancellation failed.
    """
    # Check if the task exists and belongs to the current user
    task_status = service.get_task_status(task_id)
    if not task_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
    
    task_user_id = task_status.get("user_id")
    if task_user_id and task_user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to cancel this task"
        )
    
    # Try to cancel the task
    success = service.cancel_task(task_id)
    
    if success:
        return {"message": f"Task {task_id} canceled successfully"}
    else:
        return {"message": f"Could not cancel task {task_id}: task may be completed or already canceled"}


@router.get("/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats(
    current_user: User = Depends(current_active_user),
    service: BackgroundAnalysisService = Depends(get_service)
):
    """
    Get statistics about the current state of the task queue.
    
    Returns counts of pending, active, completed, and failed tasks,
    as well as the number of worker threads and queue status.
    """
    stats = service.get_queue_stats()
    return stats


@router.get("/list", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = None,
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(current_active_user),
    service: BackgroundAnalysisService = Depends(get_service)
):
    """
    List background tasks, optionally filtered by status.
    
    Returns a paginated list of tasks belonging to the current user.
    """
    # Convert status string to proper enum value if provided
    status_filter = None
    if status:
        from fastapi_backend.dataprep.biodata.processing_queue import JobStatus
        try:
            status_filter = JobStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status value: {status}"
            )
    
    # Get tasks for the current user
    tasks = service.list_tasks(
        status=status_filter,
        user_id=str(current_user.id),
        limit=limit,
        offset=offset
    )
    
    return TaskListResponse(
        tasks=tasks,
        total=len(tasks)  # In a real implementation, you'd use a count query
    )