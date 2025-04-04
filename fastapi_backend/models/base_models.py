from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
from enum import Enum

class TaskStatus(str, Enum):
    """Enum for task status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class BaseResponse(BaseModel):
    """Base response model with a message."""
    message: str = Field(..., description="Response message.")

class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error message.")
    code: int = Field(..., description="Error code.")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details.")

class TaskResponse(BaseModel):
    """Task response model for long-running operations."""
    task_id: str = Field(..., description="ID of the task.")
    status: TaskStatus = Field(TaskStatus.PENDING, description="Status of the task.")
    message: Optional[str] = Field(None, description="Additional message.")
    result: Optional[Dict[str, Any]] = Field(None, description="Task result, if available.")
    error: Optional[str] = Field(None, description="Error message, if any.") 