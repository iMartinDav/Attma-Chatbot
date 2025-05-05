"""
FastAPI routes for bioinformatics workflow execution.

This module provides API endpoints for analyzing and processing
bioinformatics data files, as well as executing scientific workflows.
"""

import os
import tempfile
import shutil
import uuid
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, HttpUrl
import aiohttp

# Use relative imports that match the structure inside Docker container
from bioflow.biodata import MatrixStructure, BioinformaticsProcessor, WorkflowRunner
from bioflow.biodata.matrix_parser import MatrixFormatError
from bioflow.biodata.workflow_runner import WorkflowError
from dataprep import initialize_dataprep

# Import database models and dependencies
from ..users import current_active_user
from ..models import User  # Changed from ..schemas import User
from ..database import query_db, execute_db
from ..config import settings

# Create specific logger for this module
import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bioflow", tags=["bioflow"])

# Initialize data directories
TEMP_DIR = Path(tempfile.mkdtemp())
UPLOADS = {}
PROCESSING_RESULTS = {}
WORKFLOW_RESULTS = {}
ANALYSIS_RESULTS = {}

# Configure Vercel Blob Storage if available
try:
    from vercel_blob import put_blob, list_blobs, get_blob
    HAS_BLOB_STORAGE = True
    logger.info("Vercel Blob Storage is available")
except ImportError:
    HAS_BLOB_STORAGE = False
    logger.warning("Vercel Blob Storage is not available")

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


class FileUploadResponse(BaseModel):
    """Response model for file uploads."""
    file_id: str
    original_name: str
    content_type: str
    size: int
    analysis_task_id: Optional[str] = None
    url: str
    pathname: str
    needs_processing: bool
    message: Optional[str] = None


class AnalysisResult(BaseModel):
    """Model for analysis results."""
    id: str
    user_id: str
    analysis_type: str
    created_at: str
    metadata: Dict[str, Any]
    result_type: str  # 'table', 'graph', etc.
    storage_type: str  # 'database', 'blob', etc.
    result_location: Optional[str] = None
    small_result: Optional[Dict[str, Any]] = None
    large_result_blob_id: Optional[str] = None


@router.post("/upload/", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(current_active_user),
    background_tasks: BackgroundTasks = None
):
    """
    Upload a bioinformatics data file and trigger appropriate processing.
    
    Args:
        file: The file to upload
        current_user: Authenticated user information
        background_tasks: FastAPI background tasks
        
    Returns:
        Upload response with file information and processing status
    """
    try:
        # Check file size limit before processing
        # Default limit to 200MB or use settings if configured
        MAX_FILE_SIZE = getattr(settings, "MAX_UPLOAD_SIZE_MB", 200) * 1024 * 1024  # Convert to bytes
        
        # Log upload attempt with details
        logger.debug(f"Upload attempt: filename={file.filename}, content_type={file.content_type}, user_id={current_user.id}")

        # Read a small chunk to check if file exists
        chunk = await file.read(1024)
        if not chunk:
            logger.warning(f"Empty file upload attempted: {file.filename}")
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Seek back to start
        await file.seek(0)
        
        # Generate a unique file ID using UUID
        file_id = str(uuid.uuid4())
        
        # Create more descriptive temp directory paths
        base_temp_dir = os.getenv("TEMP_DIR", "/tmp")
        app_temp_dir = os.path.join(base_temp_dir, "bioflow_uploads")
        
        # Ensure temp directories exist with proper permissions
        try:
            os.makedirs(app_temp_dir, exist_ok=True)
            # On Linux, ensure proper permissions (ignored on Windows)
            try:
                os.chmod(app_temp_dir, 0o755)
            except:
                pass
        except Exception as e:
            logger.error(f"Failed to create temp directory: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Server error: Could not create temporary directory. {str(e)}"
            )
        
        # Create user-specific directory with timestamp to prevent collisions
        timestamp = int(time.time())
        user_dir = os.path.join(app_temp_dir, f"{current_user.id}_{timestamp}")
        
        try:
            os.makedirs(user_dir, exist_ok=True)
        except Exception as e:
            logger.error(f"Failed to create user directory: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Server error: Could not create user directory. {str(e)}"
            )
        
        # Use a secure filename and include original extension
        original_filename = file.filename
        file_ext = os.path.splitext(original_filename)[1].lower() if original_filename else ""
        secure_filename = f"{file_id}{file_ext}"
        file_path = os.path.join(user_dir, secure_filename)
        
        logger.debug(f"Saving uploaded file to: {file_path}")
        
        # Special handling for .dgz files (Cell Ranger Loupe files)
        is_dgz_file = original_filename and original_filename.lower().endswith('.dgz')
        
        # Stream file to disk in chunks to handle large files
        file_size = 0
        try:
            with open(file_path, "wb") as f:
                while True:
                    # Read in 1MB chunks
                    chunk = await file.read(1048576)
                    if not chunk:
                        break
                    file_size += len(chunk)
                    
                    # Check size limit during upload
                    if file_size > MAX_FILE_SIZE:
                        # Clean up the partial file
                        try:
                            os.unlink(file_path)
                        except:
                            pass
                        logger.warning(f"File too large: {file_size/(1024*1024):.1f}MB exceeds {MAX_FILE_SIZE/(1024*1024)}MB limit")
                        raise HTTPException(
                            status_code=413,
                            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE/(1024*1024):.1f}MB"
                        )
                    
                    f.write(chunk)
        except HTTPException:
            # Re-raise HTTP exceptions without modification
            raise
        except Exception as e:
            logger.error(f"Error writing file: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Server error: Failed to save uploaded file. {str(e)}"
            )
        
        # Determine if this is a bioinformatics file that needs processing
        file_ext = os.path.splitext(file.filename)[1].lower()
        is_bioinformatics_file = file_ext in [
            '.fastq', '.bam', '.vcf', '.mtx', 
            '.h5ad', '.h5', '.hdf5', '.dgz',
            '.zip', '.gz', '.tgz', '.tar.gz', '.tar'
        ]
        
        # Store file info
        file_info = {
            "file_id": file_id,
            "original_name": file.filename,
            "path": file_path,
            "content_type": file.content_type or "application/octet-stream",
            "size": file_size,
            "user_id": str(current_user.id)
        }
        
        UPLOADS[file_id] = file_info
        
        # Create response object
        response_data = FileUploadResponse(
            file_id=file_id,
            original_name=file.filename,
            content_type=file_info["content_type"],
            size=file_size,
            url=f"/bioflow/files/{file_id}",
            pathname=file.filename,
            needs_processing=is_bioinformatics_file,
            message=None
        )
        
        # If it's a bioinformatics file, trigger processing in background
        if (is_bioinformatics_file and background_tasks):
            # Generate analysis task ID - use regular UUID without prefix
            analysis_task_id = str(uuid.uuid4())
            response_data.analysis_task_id = analysis_task_id
            
            # Special message for dgz files
            if is_dgz_file:
                response_data.message = "Cell Ranger Loupe file (.dgz) received. Special processing initiated."
            else:
                response_data.message = "File received. Processing has been initiated."
            
            # Initialize result tracking with start time for processing duration measurement
            ANALYSIS_RESULTS[analysis_task_id] = {
                "task_id": analysis_task_id,
                "file_id": file_id,
                "status": "processing",
                "user_id": str(current_user.id),
                "start_time": time.time()
            }
            
            # Run analysis in the background - using special handling for dgz files
            if is_dgz_file:
                logger.info(f"Using special handler for dgz file: {file.filename}")
                background_tasks.add_task(
                    process_dgz_file,  # Special handler for dgz files
                    analysis_task_id,
                    file_path,
                    file_info,
                    str(current_user.id)
                )
            else:
                # Standard processing for other bioinformatics files
                background_tasks.add_task(
                    process_bioinformatics_file,
                    analysis_task_id,
                    file_path,
                    file_info,
                    str(current_user.id)
                )
            
            # Store the initial task status in the database
            try:
                await execute_db(
                    """
                    INSERT INTO analysis_jobs (id, user_id, file_id, status, file_name, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    """,
                    analysis_task_id, str(current_user.id), file_id, "processing", file.filename
                )
            except Exception as db_err:
                # Log DB error but don't fail the upload
                logger.error(f"Failed to record analysis job in database: {str(db_err)}", exc_info=True)
                # Continue processing anyway
        
        # Log successful upload
        logger.info(f"Successfully uploaded {file.filename} ({file_size/(1024*1024):.2f}MB) as {file_id}")
        return response_data
    
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.exception(f"Unexpected error uploading file: {str(e)}")
        # Return the error message in the response for debugging
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Server error processing upload: {str(e)}",
                "exception_type": type(e).__name__,
            },
        )


# Special handler for Cell Ranger Loupe files (.dgz)
async def process_dgz_file(task_id: str, file_path: str, file_info: Dict[str, Any], user_id: str):
    """
    Process a Cell Ranger Loupe file (.dgz) differently, since they're not extractable.
    These are binary visualization files that should be treated as standalone data.
    
    Args:
        task_id: The ID of the analysis task
        file_path: Path to the file
        file_info: Information about the file
        user_id: ID of the user who uploaded the file
    """
    try:
        logger.info(f"Processing Cell Ranger Loupe file (.dgz): {file_path} for task {task_id}")
        
        # Update status to processing
        ANALYSIS_RESULTS[task_id] = {
            "task_id": task_id,
            "file_id": file_info["file_id"],
            "status": "processing",
            "user_id": user_id,
            "message": "Processing Cell Ranger Loupe file (.dgz)"
        }
        
        # Update the database status
        try:
            await execute_db(
                "UPDATE analysis_jobs SET status = $1, updated_at = NOW() WHERE id = $2",
                "processing", task_id
            )
        except Exception as db_err:
            logger.error(f"Database error updating dgz processing status: {str(db_err)}")
            # Continue processing anyway
        
        # Get file size in MB
        file_size = os.path.getsize(file_path)
        file_size_mb = file_size / (1024 * 1024)
        
        # Set result data for dgz files
        result_data = {
            "file_type": ".dgz",
            "file_size": file_size,
            "file_size_mb": file_size_mb,
            "is_loupe_file": True,
            "message": "Cell Ranger Loupe file detected. This is a binary visualization file."
        }
        
        # Create metadata for the analysis result
        metadata = {
            "original_filename": file_info["original_name"],
            "file_size": file_size,
            "file_size_mb": file_size_mb,
            "file_type": ".dgz",
            "content_type": file_info["content_type"],
            "is_loupe_file": True,
            "processing_time": f"{(time.time() - ANALYSIS_RESULTS[task_id].get('start_time', time.time())):.2f} seconds"
        }
        
        # Generate a result ID
        result_id = str(uuid.uuid4())
        
        # For dgz files, we don't need to store large results
        storage_type = "database"
        small_result = result_data
        
        # Store analysis result in database
        try:
            await execute_db(
                """
                INSERT INTO analysis_results (
                    id, user_id, analysis_type, created_at, metadata,
                    result_type, storage_type, small_result
                )
                VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
                """,
                result_id, user_id, "loupe_dgz_file", json.dumps(metadata),
                "loupe_visualization", storage_type, json.dumps(small_result)
            )
            
            # Update the analysis job status
            await execute_db(
                """
                UPDATE analysis_jobs 
                SET status = $1, result_id = $2, updated_at = NOW() 
                WHERE id = $3
                """,
                "completed", result_id, task_id
            )
        except Exception as db_err:
            logger.error(f"Database error storing dgz analysis result: {str(db_err)}", exc_info=True)
            # Continue anyway to update in-memory status
        
        # Update in-memory status
        ANALYSIS_RESULTS[task_id] = {
            "task_id": task_id,
            "file_id": file_info["file_id"],
            "status": "completed",
            "user_id": user_id,
            "result_id": result_id,
            "analysis_type": "loupe_dgz_file",
            "message": "Cell Ranger Loupe file processed successfully"
        }
        
        logger.info(f"Successfully processed dgz file for task {task_id}, result ID {result_id}")
        
    except Exception as e:
        logger.error(f"Error processing dgz file: {str(e)}", exc_info=True)
        
        # Update status to failed
        ANALYSIS_RESULTS[task_id] = {
            "task_id": task_id,
            "file_id": file_info["file_id"],
            "status": "failed",
            "user_id": user_id,
            "error": f"Cell Ranger Loupe file processing failed: {str(e)}"
        }
        
        # Update the database status
        try:
            await execute_db(
                """
                UPDATE analysis_jobs 
                SET status = $1, error = $2, updated_at = NOW()
                WHERE id = $3
                """,
                "failed", str(e), task_id
            )
        except Exception as db_err:
            logger.error(f"Database error updating failed dgz status: {str(db_err)}")
            # Nothing more we can do here


@router.get("/files/{file_id}")
async def get_file(file_id: str, current_user: User = Depends(current_active_user)):
    """
    Get an uploaded file by ID.
    
    Args:
        file_id: The ID of the file to retrieve
        current_user: Authenticated user information
        
    Returns:
        The file content
    """
    if file_id not in UPLOADS:
        # Check if file is in blob storage
        if HAS_BLOB_STORAGE:
            try:
                # Look up file in database
                file_record = await query_db(
                    "SELECT blob_url FROM uploaded_files WHERE id = $1 AND user_id = $2",
                    file_id, str(current_user.id)
                )
                
                if file_record and file_record[0]['blob_url']:
                    # Redirect to blob storage URL
                    return JSONResponse(content={"url": file_record[0]['blob_url']})
                else:
                    raise HTTPException(status_code=404, detail="File not found")
            except Exception as e:
                logger.error(f"Error retrieving file from blob storage: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Error retrieving file: {str(e)}")
        else:
            raise HTTPException(status_code=404, detail="File not found")
    
    file_info = UPLOADS[file_id]
    
    # Check if user has access to this file
    if file_info["user_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileResponse(
        path=file_info["path"],
        filename=file_info["original_name"],
        media_type=file_info["content_type"]
    )


@router.get("/analysis/{task_id}/status", response_model=Dict[str, Any])
async def get_analysis_status(task_id: str, current_user: User = Depends(current_active_user)):
    """
    Get the status of a bioinformatics analysis task.
    
    Args:
        task_id: The ID of the analysis task
        current_user: Authenticated user information
        
    Returns:
        Status information for the analysis task
    """
    # First check in-memory status
    if task_id in ANALYSIS_RESULTS:
        result = ANALYSIS_RESULTS[task_id]
        
        # Check if user has access to this task
        if result["user_id"] != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return result
    
    # If not in memory, check database
    try:
        task_record = await query_db(
            """
            SELECT id, user_id, file_id, status, result_id, error, created_at, updated_at 
            FROM analysis_jobs 
            WHERE id = $1 AND user_id = $2
            """,
            task_id, str(current_user.id)
        )
        
        if not task_record:
            raise HTTPException(status_code=404, detail="Analysis task not found")
        
        return task_record[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving analysis status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving analysis status: {str(e)}")


@router.get("/analysis/result/{result_id}", response_model=AnalysisResult)
async def get_analysis_result(result_id: str, current_user: User = Depends(current_active_user)):
    """
    Get the result of a bioinformatics analysis.
    
    Args:
        result_id: The ID of the analysis result
        current_user: Authenticated user information
        
    Returns:
        Analysis result data
    """
    try:
        # Query the database for the result
        result_record = await query_db(
            """
            SELECT id, user_id, analysis_type, created_at, metadata, result_type, 
                   storage_type, result_location, small_result, large_result_blob_id
            FROM analysis_results
            WHERE id = $1 AND user_id = $2
            """,
            result_id, str(current_user.id)
        )
        
        if not result_record:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        result = result_record[0]
        
        # If large result is stored in blob storage, retrieve it
        if result['storage_type'] == 'blob' and result['large_result_blob_id'] and HAS_BLOB_STORAGE:
            try:
                blob_data = await get_blob(result['large_result_blob_id'])
                if blob_data:
                    # Extract actual content from blob
                    if result['result_type'] == 'graph':
                        # For graph data in blob storage, we return the URL
                        result['blob_url'] = blob_data.url
                    else:
                        # For other types, we might process the content
                        # This depends on your specific requirements
                        pass
            except Exception as blob_error:
                logger.error(f"Error retrieving blob data: {str(blob_error)}", exc_info=True)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving analysis result: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving analysis result: {str(e)}")


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


async def process_bioinformatics_file(task_id: str, file_path: str, file_info: Dict[str, Any], user_id: str):
    """
    Process a bioinformatics file and store the results.
    
    Args:
        task_id: The ID of the analysis task
        file_path: Path to the file
        file_info: Information about the file
        user_id: ID of the user who uploaded the file
    """
    try:
        logger.info(f"Starting analysis of bioinformatics file {file_path} for task {task_id}")
        
        file_ext = os.path.splitext(file_path)[1].lower()
        filename = os.path.basename(file_path)
        file_size_mb = file_info["size"] / (1024 * 1024)  # Convert to MB
        is_large_file = file_size_mb > 5
        
        # Update status to processing
        ANALYSIS_RESULTS[task_id] = {
            "task_id": task_id,
            "file_id": file_info["file_id"],
            "status": "processing",
            "user_id": user_id,
            "message": f"Analysis in progress{' (large file, may take longer)' if is_large_file else ''}"
        }
        
        # Update the database status
        await execute_db(
            "UPDATE analysis_jobs SET status = $1, updated_at = NOW() WHERE id = $2",
            "processing", task_id
        )
        
        # Create a processing directory for this analysis
        processing_dir = Path(tempfile.mkdtemp())
        
        # Process based on file type
        result_data = None
        analysis_type = "unknown"
        result_type = "unknown"
        
        # Check if it's a compressed file
        is_compressed = file_ext in ['.zip', '.gz', '.tgz', '.tar.gz', '.tar', '.dgz']

        if is_compressed:
            # Handle compressed files
            extract_dir = processing_dir / "extracted"
            extract_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Extracting compressed file {file_path} to {extract_dir}")
            
            if file_ext == '.zip':
                shutil.unpack_archive(file_path, extract_dir, 'zip')
            elif file_ext in ['.tar.gz', '.tgz']:
                shutil.unpack_archive(file_path, extract_dir, 'gztar')
            elif file_ext == '.tar':
                shutil.unpack_archive(file_path, extract_dir, 'tar')
            elif file_ext == '.gz':
                # For single gzipped files, extract and update file_path
                import gzip
                output_file = extract_dir / filename[:-3]  # Remove .gz extension
                with gzip.open(file_path, 'rb') as f_in:
                    with open(output_file, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                
                # Update file_path to point to extracted file
                file_path = str(output_file)
                file_ext = os.path.splitext(file_path)[1].lower()
            
            logger.info(f"Extracted files from compressed archive to {extract_dir}")
            
            # Try to find bioinformatics files in the extracted directory
            matrix_files = list(extract_dir.glob("**/*.mtx")) + list(extract_dir.glob("**/*.txt"))
            h5ad_files = list(extract_dir.glob("**/*.h5ad")) + list(extract_dir.glob("**/*.h5"))
            sequence_files = list(extract_dir.glob("**/*.fastq")) + list(extract_dir.glob("**/*.bam")) + list(extract_dir.glob("**/*.vcf"))
            csv_files = list(extract_dir.glob("**/*.csv")) + list(extract_dir.glob("**/*.tsv"))
            
            if matrix_files:
                # Process matrix file
                bioinfo_file = matrix_files[0]
                processor = BioinformaticsProcessor(str(bioinfo_file))
                matrix_info = processor.matrix_structure
                
                analysis_type = "compressed_with_matrix"
                result_type = "table"
                result_data = {
                    "data_type": "matrix_in_compressed",
                    "matrix_file": str(bioinfo_file),
                    "num_rows": matrix_info.num_rows,
                    "num_columns": matrix_info.num_columns,
                    "extracted_dir": str(extract_dir)
                }
                
                # Create a subset for preview if matrix is large
                if matrix_info.num_columns > 100:
                    try:
                        subset_path = processor.generate_matrix_subset(100)
                        if subset_path:
                            result_data["subset_path"] = str(subset_path)
                            result_data["has_subset"] = True
                    except Exception as subset_error:
                        logger.warning(f"Error creating subset: {str(subset_error)}")
                        result_data["subset_error"] = str(subset_error)
                        
            elif h5ad_files:
                # Process h5ad file
                bioinfo_file = h5ad_files[0]
                processor = BioinformaticsProcessor(str(bioinfo_file))
                matrix_info = processor.matrix_structure
                
                analysis_type = "compressed_with_h5ad"
                result_type = "table"
                result_data = {
                    "data_type": "h5ad_in_compressed",
                    "matrix_file": str(bioinfo_file),
                    "num_rows": matrix_info.num_rows,
                    "num_columns": matrix_info.num_columns,
                    "extracted_dir": str(extract_dir)
                }
                
            elif sequence_files:
                # Handle sequence data files
                bioinfo_file = sequence_files[0]
                file_type = os.path.splitext(bioinfo_file)[1].lower()
                
                analysis_type = f"compressed_with_{file_type[1:]}"
                result_type = "sequence_data"
                result_data = {
                    "file_type": file_type,
                    "file_size": os.path.getsize(bioinfo_file),
                    "file_path": str(bioinfo_file),
                    "extracted_dir": str(extract_dir),
                    "message": f"Found {file_type} sequence file in compressed archive"
                }
                
            elif csv_files:
                # Handle CSV/TSV data files (could be gene expression data)
                bioinfo_file = csv_files[0]
                file_type = os.path.splitext(bioinfo_file)[1].lower()
                
                analysis_type = "compressed_with_table"
                result_type = "table"
                
                # Read first few lines to determine structure
                with open(bioinfo_file, 'r') as f:
                    header = f.readline().strip()
                    delimiter = ',' if ',' in header else '\t' if '\t' in header else None
                    
                    if delimiter:
                        columns = header.split(delimiter)
                        num_columns = len(columns)
                        
                        # Count rows (limited to first 10000 for large files)
                        num_rows = 1  # Header row
                        for i, _ in enumerate(f):
                            num_rows += 1
                            if i >= 10000:
                                num_rows = f">10000 (truncated)"
                                break
                        
                        result_data = {
                            "file_type": file_type,
                            "file_path": str(bioinfo_file),
                            "delimiter": delimiter,
                            "num_columns": num_columns,
                            "num_rows": num_rows,
                            "extracted_dir": str(extract_dir),
                            "column_sample": columns[:10] if len(columns) > 10 else columns
                        }
                    else:
                        result_data = {
                            "file_type": file_type,
                            "file_path": str(bioinfo_file),
                            "message": "Could not determine file structure",
                            "extracted_dir": str(extract_dir)
                        }
                
            else:
                # No recognized bioinformatics files found
                analysis_type = "compressed_archive"
                result_type = "unknown"
                result_data = {
                    "data_type": "compressed_archive",
                    "extracted_dir": str(extract_dir),
                    "files_count": len(list(extract_dir.glob("**/*"))),
                    "message": "No recognized bioinformatics files found in archive"
                }
                
        elif file_ext in ['.mtx', '.h5ad', '.h5']:
            # Handle matrix files with bioflow processor
            processor = BioinformaticsProcessor(file_path)
            matrix_info = processor.matrix_structure
            
            # Basic analysis of matrix structure
            analysis_type = "matrix_structure"
            result_type = "table"
            result_data = {
                "data_type": matrix_info.data_type,
                "num_rows": matrix_info.num_rows,
                "num_columns": matrix_info.num_columns,
                "file_type": file_ext,
                "has_header_row": matrix_info.has_header_row,
                "has_header_column": matrix_info.has_header_column
            }
            
            # For large files, use a more efficient approach for subset creation
            subset_size = 50 if is_large_file else 100
            
            # If it's a matrix, create a subset for preview
            try:
                subset_path = processor.generate_matrix_subset(subset_size)
                if subset_path:
                    result_data["subset_path"] = str(subset_path)
                    result_data["has_subset"] = True
                    result_data["subset_size"] = subset_size
            except Exception as subset_error:
                logger.warning(f"Error creating subset: {str(subset_error)}")
                result_data["subset_error"] = str(subset_error)
        
        elif file_ext in ['.fastq', '.bam', '.vcf']:
            # Handle sequence data files
            analysis_type = f"{file_ext[1:]}_file"
            result_type = "sequence_data"
            result_data = {
                "file_type": file_ext,
                "file_size": os.path.getsize(file_path),
                "file_size_mb": file_size_mb,
                "message": f"File recognized as {file_ext} format{' (large file)' if is_large_file else ''}"
            }
            
            # For very large files, consider implementing specialized sequence data analysis here
        
        else:
            # Check if it might be a CSV/TSV file with bioinformatics data
            if file_ext in ['.csv', '.tsv', '.txt']:
                # Try to determine if it's bioinformatics data
                analysis_type = "tabular_data"
                result_type = "table"
                
                # Read first few lines to determine structure
                with open(file_path, 'r') as f:
                    header = f.readline().strip()
                    delimiter = ',' if ',' in header else '\t' if '\t' in header else None
                    
                    if delimiter:
                        columns = header.split(delimiter)
                        num_columns = len(columns)
                        
                        # Count rows (limited for large files)
                        num_rows = 1  # Header row
                        for i, _ in enumerate(f):
                            num_rows += 1
                            if i >= 10000:
                                num_rows = f">10000 (truncated)"
                                break
                        
                        # Check for common bioinformatics column names
                        bio_keywords = ['gene', 'transcript', 'chromosome', 'position', 'expression',
                                        'count', 'ensembl', 'entrez', 'uniprot', 'go_term', 'pathway']
                        
                        has_bio_columns = any(kw in header.lower() for kw in bio_keywords)
                        
                        result_data = {
                            "file_type": file_ext,
                            "delimiter": delimiter,
                            "num_columns": num_columns,
                            "num_rows": num_rows,
                            "is_bioinformatics_data": has_bio_columns,
                            "column_sample": columns[:10] if len(columns) > 10 else columns
                        }
                    else:
                        result_data = {
                            "file_type": file_ext,
                            "message": "Could not determine file structure"
                        }
            else:
                # Unrecognized format
                analysis_type = "unknown"
                result_type = "unknown"
                result_data = {
                    "file_ext": file_ext,
                    "file_size_mb": file_size_mb,
                    "message": "Unrecognized bioinformatics file format"
                }
        
        # Generate a result ID
        result_id = str(uuid.uuid4())
        
        # Determine how to store the result based on size
        storage_type = None
        result_location = None
        small_result = None
        large_result_blob_id = None
        
        # Convert result data to JSON string to check size
        result_json = json.dumps(result_data)
        result_size = len(result_json)
        
        if result_size < 1024 * 1024:  # Less than 1MB
            # Store small results directly in PostgreSQL
            storage_type = "database"
            small_result = result_data
        else:
            # Store large results in blob storage if available
            if HAS_BLOB_STORAGE:
                storage_type = "blob"
                # Store in Vercel Blob
                blob_key = f"users/{user_id}/analyses/{result_id}.json"
                
                try:
                    # Upload the blob
                    blob = await put_blob(blob_key, result_json, {
                        "contentType": "application/json",
                        "access": "public"
                    })
                    
                    large_result_blob_id = blob.url
                    result_location = blob.url
                except Exception as blob_error:
                    logger.error(f"Error storing result in blob storage: {str(blob_error)}", exc_info=True)
                    # Fall back to database storage
                    storage_type = "database"
                    small_result = {
                        "error": "Failed to store in blob storage",
                        "summary": {
                            "analysis_type": analysis_type,
                            "result_type": result_type
                        }
                    }
            else:
                # No blob storage available, store a summary in the database
                storage_type = "database"
                small_result = {
                    "message": "Result too large for database storage and blob storage not available",
                    "summary": {
                        "analysis_type": analysis_type,
                        "result_type": result_type
                    }
                }
        
        # Create metadata object
        metadata = {
            "original_filename": file_info["original_name"],
            "file_size": file_info["size"],
            "file_size_mb": file_size_mb,
            "is_large_file": is_large_file,
            "file_type": file_ext,
            "is_compressed": is_compressed,
            "content_type": file_info["content_type"],
            "processing_time": f"{(time.time() - ANALYSIS_RESULTS[task_id].get('start_time', time.time())):.2f} seconds"
        }
        
        # Store analysis result in database
        await execute_db(
            """
            INSERT INTO analysis_results (
                id, user_id, analysis_type, created_at, metadata,
                result_type, storage_type, result_location, small_result, large_result_blob_id
            )
            VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
            """,
            result_id, user_id, analysis_type, json.dumps(metadata), 
            result_type, storage_type, result_location, 
            json.dumps(small_result) if small_result else None, 
            large_result_blob_id
        )
        
        # Update the analysis job status
        await execute_db(
            """
            UPDATE analysis_jobs 
            SET status = $1, result_id = $2, updated_at = NOW() 
            WHERE id = $3
            """,
            "completed", result_id, task_id
        )
        
        # Update in-memory status
        ANALYSIS_RESULTS[task_id] = {
            "task_id": task_id,
            "file_id": file_info["file_id"],
            "status": "completed",
            "user_id": user_id,
            "result_id": result_id,
            "analysis_type": analysis_type
        }
        
        logger.info(f"Successfully completed analysis for task {task_id}, result ID {result_id}")
        
    except Exception as e:
        logger.error(f"Error processing bioinformatics file: {str(e)}", exc_info=True)
        
        # Update status to failed
        ANALYSIS_RESULTS[task_id] = {
            "task_id": task_id,
            "file_id": file_info["file_id"],
            "status": "failed",
            "user_id": user_id,
            "error": str(e)
        }
        
        # Update the database status
        await execute_db(
            """
            UPDATE analysis_jobs 
            SET status = $1, error = $2, updated_at = NOW()
            WHERE id = $3
            """,
            "failed", str(e), task_id
        )


from app.schemas import BaseModel

class BlobProcessRequest(BaseModel):
    url: str
    filename: str
    content_type: str


@router.post("/process-from-blob/")
async def process_from_blob(
    request: BlobProcessRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(current_active_user),
):
    """
    Trigger processing of a file stored in Vercel Blob.
    Downloads the file, saves to temp, and starts analysis in background.
    """
    logger.info(f"Received blob processing request: {request.url} for user {current_user.id}")
    # Download the file from blob
    temp_dir = tempfile.mkdtemp()
    local_path = os.path.join(temp_dir, request.filename)
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(str(request.url)) as resp:
                if resp.status != 200:
                    logger.error(f"Failed to download blob: {resp.status}")
                    raise HTTPException(status_code=400, detail=f"Failed to download blob: {resp.status}")
                with open(local_path, "wb") as f:
                    while True:
                        chunk = await resp.content.read(1024 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
        logger.info(f"Downloaded blob to {local_path}")
        # Generate a file_id and task_id
        file_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())
        file_info = {
            "file_id": file_id,
            "original_name": request.filename,
            "path": local_path,
            "content_type": request.content_type,
            "size": os.path.getsize(local_path),
            "user_id": str(current_user.id),
        }
        # Register file in UPLOADS
        UPLOADS[file_id] = file_info
        # Start processing in background
        ANALYSIS_RESULTS[task_id] = {
            "task_id": task_id,
            "file_id": file_id,
            "status": "processing",
            "user_id": str(current_user.id),
            "start_time": time.time(),
        }
        background_tasks.add_task(
            process_bioinformatics_file,
            task_id,
            local_path,
            file_info,
            str(current_user.id),
        )
        # Optionally, insert job in DB as in upload_file
        try:
            await execute_db(
                """
                INSERT INTO analysis_jobs (id, user_id, file_id, status, file_name, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                """,
                task_id, str(current_user.id), file_id, "processing", request.filename
            )
        except Exception as db_err:
            logger.error(f"Failed to record analysis job in database: {str(db_err)}", exc_info=True)
        return {"task_id": task_id, "file_id": file_id, "status": "processing"}
    except Exception as e:
        logger.error(f"Error processing blob: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing blob: {str(e)}")
