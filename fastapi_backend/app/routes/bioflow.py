"""
FastAPI routes for bioinformatics workflow execution.

This module provides API endpoints for analyzing and processing
bioinformatics data files, as well as executing scientific workflows.
"""

import os
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Use relative imports that match the structure inside Docker container
from bioflow.biodata import MatrixStructure, BioinformaticsProcessor, WorkflowRunner
from bioflow.biodata.matrix_parser import MatrixFormatError
from bioflow.biodata.workflow_runner import WorkflowError

router = APIRouter(prefix="/bioflow", tags=["bioflow"])

# In-memory storage for uploaded files and processing results
# In production, you would use a database and proper file storage
TEMP_DIR = Path(tempfile.mkdtemp())
UPLOADS = {}
PROCESSING_RESULTS = {}
WORKFLOW_RESULTS = {}


class MatrixAnalysisRequest(BaseModel):
    """Request model for matrix analysis."""
    file_id: str


class MatrixSubsetRequest(BaseModel):
    """Request model for matrix subsetting."""
    file_id: str
    num_columns: int


class WorkflowRequest(BaseModel):
    """Request model for workflow execution."""
    file_id: str
    workflow_name: str
    params: Optional[Dict[str, Any]] = None


class MatrixInfoResponse(BaseModel):
    """Response model for matrix information."""
    data_path: str
    delimiter: str
    has_header_row: bool
    has_header_column: bool
    data_type: str
    num_rows: int
    num_columns: int
    column_names_sample: Optional[List[str]] = None
    row_names_sample: Optional[List[str]] = None


class TaskResponse(BaseModel):
    """Response model for task information."""
    task_id: str


class TaskStatusResponse(BaseModel):
    """Response model for task status."""
    task_id: str
    status: str
    file_id: str
    num_columns: Optional[int] = None
    subset_path: Optional[str] = None
    error: Optional[str] = None


class WorkflowStatusResponse(BaseModel):
    """Response model for workflow status."""
    task_id: str
    status: str
    file_id: str
    workflow_name: str
    output_dir: Optional[str] = None
    files: Optional[Dict[str, str]] = None
    error: Optional[str] = None


class WorkflowListResponse(BaseModel):
    """Response model for available workflows."""
    workflows: List[str]


@router.post("/upload/", response_model=Dict[str, str])
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a bioinformatics data file.
    
    Args:
        file: The file to upload
        
    Returns:
        Dictionary with file_id for future reference
    """
    try:
        # Generate a unique file ID
        file_id = f"upload_{len(UPLOADS) + 1}"
        
        # Ensure temp directory exists
        os.makedirs(TEMP_DIR, exist_ok=True)
        
        # Save the file
        file_path = TEMP_DIR / file_id / file.filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, "wb") as f:
            contents = await file.read()
            f.write(contents)
        
        # Store the file info
        UPLOADS[file_id] = {
            "original_name": file.filename,
            "path": str(file_path)
        }
        
        return {"file_id": file_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.post("/analyze/", response_model=MatrixInfoResponse)
async def analyze_matrix(request: MatrixAnalysisRequest):
    """
    Analyze the structure of a matrix file.
    
    Args:
        request: Matrix analysis request with file_id
        
    Returns:
        Matrix structure information
    """
    if request.file_id not in UPLOADS:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        file_path = UPLOADS[request.file_id]["path"]
        
        # Analyze matrix structure
        matrix_structure = MatrixStructure(file_path)
        
        # Convert to response model
        response = MatrixInfoResponse(
            data_path=str(matrix_structure.data_path),
            delimiter=matrix_structure.delimiter,
            has_header_row=matrix_structure.has_header_row,
            has_header_column=matrix_structure.has_header_column,
            data_type=matrix_structure.data_type,
            num_rows=matrix_structure.num_rows,
            num_columns=matrix_structure.num_columns
        )
        
        # Add column names if available
        if matrix_structure.column_names:
            response.column_names_sample = matrix_structure.column_names[:5]
        
        # Add row names if available
        if matrix_structure.row_names:
            response.row_names_sample = matrix_structure.row_names[:5]
        
        return response
    
    except MatrixFormatError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing matrix: {str(e)}")


@router.post("/subset/", response_model=TaskResponse)
async def subset_matrix(request: MatrixSubsetRequest, background_tasks: BackgroundTasks):
    """
    Create a subset of a matrix with a specified number of columns.
    
    Args:
        request: Matrix subset request with file_id and num_columns
        background_tasks: FastAPI background tasks
        
    Returns:
        Dictionary with task_id for checking status
    """
    if request.file_id not in UPLOADS:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        file_path = UPLOADS[request.file_id]["path"]
        
        # Generate task ID
        task_id = f"subset_{len(PROCESSING_RESULTS) + 1}"
        
        # Initialize the result
        PROCESSING_RESULTS[task_id] = {
            "task_id": task_id,
            "status": "processing",
            "file_id": request.file_id,
            "num_columns": request.num_columns
        }
        
        # Run the processing in the background
        background_tasks.add_task(
            process_matrix_subset,
            task_id,
            file_path,
            request.num_columns
        )
        
        return {"task_id": task_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting subset task: {str(e)}")


@router.get("/workflows/", response_model=WorkflowListResponse)
async def list_workflows():
    """
    List available workflows.
    
    Returns:
        List of available workflow names
    """
    try:
        runner = WorkflowRunner()
        workflows = runner.list_available_workflows()
        return {"workflows": workflows}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing workflows: {str(e)}")


@router.post("/workflow/", response_model=TaskResponse)
async def run_workflow(request: WorkflowRequest, background_tasks: BackgroundTasks):
    """
    Run a workflow on a file.
    
    Args:
        request: Workflow request with file_id, workflow_name, and optional params
        background_tasks: FastAPI background tasks
        
    Returns:
        Dictionary with task_id for checking status
    """
    if request.file_id not in UPLOADS:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        runner = WorkflowRunner()
        
        # Check if workflow exists
        available_workflows = runner.list_available_workflows()
        if request.workflow_name not in available_workflows:
            raise HTTPException(status_code=404, detail=f"Workflow not found: {request.workflow_name}")
        
        file_path = UPLOADS[request.file_id]["path"]
        
        # Generate task ID
        task_id = f"workflow_{len(WORKFLOW_RESULTS) + 1}"
        
        # Prepare parameters
        params = request.params or {}
        params["input"] = file_path
        
        # Initialize the result
        WORKFLOW_RESULTS[task_id] = {
            "task_id": task_id,
            "status": "processing",
            "file_id": request.file_id,
            "workflow_name": request.workflow_name
        }
        
        # Run the workflow in the background
        background_tasks.add_task(
            process_workflow,
            task_id,
            request.workflow_name,
            params
        )
        
        return {"task_id": task_id}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting workflow: {str(e)}")


@router.get("/workflow/{task_id}/", response_model=WorkflowStatusResponse)
async def get_workflow_status(task_id: str):
    """
    Get the status of a workflow task.
    
    Args:
        task_id: Task ID for tracking
        
    Returns:
        Workflow status information
    """
    if task_id not in WORKFLOW_RESULTS:
        raise HTTPException(status_code=404, detail="Workflow task not found")
    
    return WORKFLOW_RESULTS[task_id]


@router.get("/workflow/{task_id}/result/{file_name}")
async def download_workflow_result(task_id: str, file_name: str):
    """
    Download a specific result file from a workflow.
    
    Args:
        task_id: Task ID for tracking
        file_name: Name of the file to download
        
    Returns:
        File response with the requested file
    """
    if task_id not in WORKFLOW_RESULTS:
        raise HTTPException(status_code=404, detail="Workflow task not found")
    
    result = WORKFLOW_RESULTS[task_id]
    
    if result["status"] != "completed":
        raise HTTPException(status_code=400, detail="Workflow not completed")
    
    if "files" not in result or not result["files"]:
        raise HTTPException(status_code=400, detail="No files available for download")
    
    # Find the file by name
    matching_files = [path for name, path in result["files"].items() if name == file_name]
    
    if not matching_files:
        raise HTTPException(status_code=404, detail=f"File not found: {file_name}")
    
    file_path = matching_files[0]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File no longer exists")
    
    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type="application/octet-stream"
    )


async def process_matrix_subset(task_id: str, file_path: str, num_columns: int):
    """
    Process a matrix subset in the background.
    
    Args:
        task_id: Task ID for tracking
        file_path: Path to the matrix file
        num_columns: Number of columns for the subset
    """
    try:
        # Create processor
        processor = BioinformaticsProcessor(file_path)
        
        # Create subset
        subset_path = processor.generate_matrix_subset(num_columns)
        
        if subset_path:
            # Update task result
            PROCESSING_RESULTS[task_id] = {
                "task_id": task_id,
                "status": "completed",
                "file_id": PROCESSING_RESULTS[task_id]["file_id"],
                "num_columns": num_columns,
                "subset_path": str(subset_path)
            }
        else:
            # Update task result with error
            PROCESSING_RESULTS[task_id] = {
                "task_id": task_id,
                "status": "failed",
                "file_id": PROCESSING_RESULTS[task_id]["file_id"],
                "num_columns": num_columns,
                "error": "Failed to create subset"
            }
    
    except Exception as e:
        # Update task result with error
        PROCESSING_RESULTS[task_id] = {
            "task_id": task_id,
            "status": "failed",
            "file_id": PROCESSING_RESULTS[task_id]["file_id"],
            "num_columns": num_columns,
            "error": str(e)
        }


async def process_workflow(task_id: str, workflow_name: str, params: Dict[str, Any]):
    """
    Process a workflow in the background.
    
    Args:
        task_id: Task ID for tracking
        workflow_name: Name of the workflow to run
        params: Parameters for the workflow
    """
    try:
        # Initialize workflow runner
        runner = WorkflowRunner()
        
        # Run the workflow
        result = runner.run_workflow(workflow_name, params)
        
        # Update task result
        WORKFLOW_RESULTS[task_id] = {
            "task_id": task_id,
            "status": "completed" if result["status"] == "success" else "failed",
            "file_id": WORKFLOW_RESULTS[task_id]["file_id"],
            "workflow_name": workflow_name,
            "output_dir": result.get("output_dir"),
            "files": result.get("files"),
            "error": None if result["status"] == "success" else result.get("message")
        }
    
    except WorkflowError as e:
        # Update task result with workflow error
        WORKFLOW_RESULTS[task_id] = {
            "task_id": task_id,
            "status": "failed",
            "file_id": WORKFLOW_RESULTS[task_id]["file_id"],
            "workflow_name": workflow_name,
            "error": str(e)
        }
    
    except Exception as e:
        # Update task result with general error
        WORKFLOW_RESULTS[task_id] = {
            "task_id": task_id,
            "status": "failed",
            "file_id": WORKFLOW_RESULTS[task_id]["file_id"],
            "workflow_name": workflow_name,
            "error": f"Unexpected error: {str(e)}"
        }


@router.get("/task/{task_id}/", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    Get the status of a processing task.
    
    Args:
        task_id: Task ID for tracking
        
    Returns:
        Task status information
    """
    if task_id not in PROCESSING_RESULTS:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return PROCESSING_RESULTS[task_id]


@router.get("/download/{task_id}/")
async def download_subset(task_id: str):
    """
    Download the result of a processing task.
    
    Args:
        task_id: Task ID for tracking
        
    Returns:
        File response with the processed file
    """
    if task_id not in PROCESSING_RESULTS:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = PROCESSING_RESULTS[task_id]
    
    if result["status"] != "completed":
        raise HTTPException(status_code=400, detail="Task not completed")
    
    if "subset_path" not in result:
        raise HTTPException(status_code=400, detail="No file available for download")
    
    subset_path = result["subset_path"]
    if not os.path.exists(subset_path):
        raise HTTPException(status_code=404, detail="Subset file not found")
    
    return FileResponse(
        path=subset_path,
        filename=os.path.basename(subset_path),
        media_type="application/octet-stream"
    ) 