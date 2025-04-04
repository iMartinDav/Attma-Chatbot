from typing import Dict, List, Optional, Any, Union
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, File, UploadFile, Query, Path, status
from fastapi.responses import JSONResponse, FileResponse
import uuid
import os
import tempfile
import shutil
from pydantic import UUID4
import asyncio

from fastapi_backend.models.single_cell_models import (
    SingleCellDataLoadRequest,
    SingleCellDataLoadResponse,
    QualityControlRequest,
    QualityControlResponse,
    NormalizationRequest,
    NormalizationResponse,
    DimensionalityReductionRequest,
    DimensionalityReductionResponse,
    ClusteringRequest,
    ClusteringResponse,
    PlotRequest,
    PlotResponse,
    MarkerGenesRequest,
    MarkerGenesResponse
)
from fastapi_backend.models.base_models import BaseResponse, ErrorResponse, TaskResponse
from fastapi_backend.services.single_cell_service import SingleCellService
from fastapi_backend.utils.exceptions import (
    DataLoadingError, 
    InvalidDataFormatError, 
    AnalysisError, 
    ResourceNotFoundError,
    S3OperationError,
    PlottingError
)
from fastapi_backend.utils.logging import get_logger

# Configure logger
logger = get_logger(__name__)

# Create router
router = APIRouter(prefix="/api/single-cell", tags=["single-cell"])

# In-memory dictionary to store task status and results
tasks = {}

# Function to get the single-cell service
def get_single_cell_service():
    """Dependency to get a SingleCellService instance."""
    return SingleCellService(
        data_dir=os.getenv("SINGLE_CELL_DATA_DIR", "/tmp/single_cell_data"),
        s3_bucket=os.getenv("S3_BUCKET", None)
    )

# Background task for long-running operations
async def run_background_task(task_id: str, func, *args, **kwargs):
    """
    Run a function in the background and update the task status.
    
    Args:
        task_id: The ID of the task
        func: The function to run
        *args: Arguments to pass to the function
        **kwargs: Keyword arguments to pass to the function
    """
    try:
        tasks[task_id] = {"status": "running", "result": None, "error": None}
        result = await asyncio.to_thread(func, *args, **kwargs)
        tasks[task_id] = {"status": "completed", "result": result, "error": None}
    except Exception as e:
        logger.exception(f"Error in background task {task_id}: {e}")
        tasks[task_id] = {"status": "failed", "result": None, "error": str(e)}

# Routes
@router.post("/data/load", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def load_single_cell_data(
    request: SingleCellDataLoadRequest,
    background_tasks: BackgroundTasks,
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Load single-cell data into the service. This is a long-running operation, so it is executed
    in the background. Returns a task ID that can be used to check the status of the operation.
    """
    task_id = str(uuid.uuid4())
    
    background_tasks.add_task(
        run_background_task,
        task_id,
        service.load_single_cell_data,
        request.file_path,
        request.project_name,
        request.metadata_path,
        request.coordinates_path
    )
    
    return TaskResponse(
        task_id=task_id,
        message="Data load task started"
    )

@router.post("/data/upload", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_single_cell_data(
    background_tasks: BackgroundTasks,
    data_file: UploadFile = File(...),
    project_name: str = Query(..., description="Name of the project"),
    metadata_file: Optional[UploadFile] = File(None),
    coordinates_file: Optional[UploadFile] = File(None),
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Upload single-cell data files and load them into the service. This is a long-running operation,
    so it is executed in the background. Returns a task ID that can be used to check the status
    of the operation.
    """
    # Create a temporary directory to store the uploaded files
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Save the data file
        data_path = os.path.join(temp_dir, data_file.filename)
        with open(data_path, "wb") as f:
            shutil.copyfileobj(data_file.file, f)
        
        # Save the metadata file if provided
        metadata_path = None
        if metadata_file:
            metadata_path = os.path.join(temp_dir, metadata_file.filename)
            with open(metadata_path, "wb") as f:
                shutil.copyfileobj(metadata_file.file, f)
        
        # Save the coordinates file if provided
        coordinates_path = None
        if coordinates_file:
            coordinates_path = os.path.join(temp_dir, coordinates_file.filename)
            with open(coordinates_path, "wb") as f:
                shutil.copyfileobj(coordinates_file.file, f)
        
        # Create a task ID
        task_id = str(uuid.uuid4())
        
        # Run the load task in the background
        background_tasks.add_task(
            run_background_task,
            task_id,
            service.load_single_cell_data,
            data_path,
            project_name,
            metadata_path,
            coordinates_path
        )
        
        return TaskResponse(
            task_id=task_id,
            message="Data upload and load task started"
        )
    
    except Exception as e:
        # Clean up the temporary directory
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload and load data: {str(e)}"
        )

@router.get("/task/{task_id}", response_model=Union[TaskResponse, Any])
async def get_task_status(
    task_id: str = Path(..., description="ID of the task to check")
):
    """
    Check the status of a long-running task.
    """
    if task_id not in tasks:
        raise HTTPException(
            status_code=404,
            detail=f"Task with ID {task_id} not found"
        )
    
    task = tasks[task_id]
    
    if task["status"] == "completed":
        return {"status": task["status"], "result": task["result"]}
    elif task["status"] == "failed":
        return {"status": task["status"], "error": task["error"]}
    else:
        return TaskResponse(
            task_id=task_id,
            status=task["status"],
            message=f"Task is {task['status']}"
        )

@router.post("/qc", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_quality_control(
    request: QualityControlRequest,
    background_tasks: BackgroundTasks,
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Run quality control on a loaded dataset.
    """
    task_id = str(uuid.uuid4())
    
    # First calculate QC metrics
    async def run_qc():
        adata_id = request.adata_id
        
        # Calculate QC metrics
        adata_id, qc_summary = service.calculate_qc_metrics(adata_id)
        
        # If subset size is provided, subset the data
        if request.subset_size:
            adata_id, subset_summary = service.subset_randomly(adata_id, request.subset_size)
            qc_summary.update(subset_summary)
        
        # Apply filters
        adata_id, filter_summary = service.filter_cells_by_qc(
            adata_id,
            min_genes=request.min_genes,
            max_genes=request.max_genes,
            min_counts=request.min_counts,
            max_counts=request.max_counts,
            max_mt_pct=request.max_mt_pct
        )
        
        # Filter genes
        adata_id, gene_filter_summary = service.filter_genes_by_counts(
            adata_id,
            min_cells=request.min_cells,
            max_cells=request.max_cells
        )
        
        # Combine summaries
        combined_summary = {**qc_summary, **filter_summary, **gene_filter_summary}
        
        return adata_id, combined_summary
    
    background_tasks.add_task(
        run_background_task,
        task_id,
        run_qc
    )
    
    return TaskResponse(
        task_id=task_id,
        message="Quality control task started"
    )

@router.post("/normalization", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_normalization(
    request: NormalizationRequest,
    background_tasks: BackgroundTasks,
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Run normalization on a dataset.
    """
    task_id = str(uuid.uuid4())
    
    async def run_norm():
        adata_id = request.adata_id
        
        # Normalize the data
        adata_id, norm_summary = service.normalize_data(
            adata_id,
            method=request.method.value,
            scale_factor=request.scale_factor
        )
        
        # Find highly variable genes if requested
        if request.highly_variable:
            adata_id, hv_summary = service.find_highly_variable_genes(
                adata_id,
                n_top_genes=request.n_top_genes
            )
            norm_summary.update(hv_summary)
        
        # Scale the data
        adata_id, scale_summary = service.scale_data(
            adata_id,
            zero_center=True,
            max_value=10
        )
        
        # Combine summaries
        combined_summary = {**norm_summary, **scale_summary}
        
        return adata_id, combined_summary
    
    background_tasks.add_task(
        run_background_task,
        task_id,
        run_norm
    )
    
    return TaskResponse(
        task_id=task_id,
        message="Normalization task started"
    )

@router.post("/dimension-reduction", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_dimension_reduction(
    request: DimensionalityReductionRequest,
    background_tasks: BackgroundTasks,
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Run dimensionality reduction on a dataset.
    """
    task_id = str(uuid.uuid4())
    
    async def run_dr():
        adata_id = request.adata_id
        
        if request.method.value == 'pca':
            # Run PCA
            adata_id, dr_summary = service.run_pca(
                adata_id,
                n_components=request.n_components,
                use_highly_variable=request.use_highly_variable
            )
        elif request.method.value == 'umap':
            # Run UMAP (requires PCA to be run first)
            adata_id, dr_summary = service.run_umap(
                adata_id,
                n_components=request.n_components,
                use_pca=True,
                n_pcs=request.n_components
            )
        elif request.method.value == 'tsne':
            # Run t-SNE (requires PCA to be run first)
            adata_id, dr_summary = service.run_tsne(
                adata_id,
                n_components=request.n_components,
                use_pca=True,
                n_pcs=request.n_components
            )
        else:
            raise ValueError(f"Unsupported dimensionality reduction method: {request.method.value}")
        
        return adata_id, dr_summary
    
    background_tasks.add_task(
        run_background_task,
        task_id,
        run_dr
    )
    
    return TaskResponse(
        task_id=task_id,
        message=f"{request.method.value.upper()} task started"
    )

@router.post("/clustering", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_clustering(
    request: ClusteringRequest,
    background_tasks: BackgroundTasks,
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Run clustering on a dataset.
    """
    task_id = str(uuid.uuid4())
    
    async def run_cluster():
        adata_id = request.adata_id
        
        # Compute neighbors (if not done already)
        try:
            adata_id, neighbors_summary = service.compute_neighbors(
                adata_id,
                n_neighbors=request.n_neighbors,
                use_rep=request.embedding
            )
        except ValueError:
            # Neighbors already computed or not required for k-means
            neighbors_summary = {}
        
        # Run clustering
        adata_id, cluster_summary = service.run_clustering(
            adata_id,
            method=request.method.value,
            resolution=request.resolution,
            n_clusters=request.n_clusters
        )
        
        # Combine summaries
        combined_summary = {**neighbors_summary, **cluster_summary}
        
        return adata_id, combined_summary
    
    background_tasks.add_task(
        run_background_task,
        task_id,
        run_cluster
    )
    
    return TaskResponse(
        task_id=task_id,
        message=f"{request.method.value} clustering task started"
    )

@router.post("/markers", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def find_marker_genes(
    request: MarkerGenesRequest,
    background_tasks: BackgroundTasks,
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Find marker genes for clusters.
    """
    task_id = str(uuid.uuid4())
    
    background_tasks.add_task(
        run_background_task,
        task_id,
        service.find_marker_genes,
        request.adata_id,
        request.cluster_key,
        request.method,
        request.min_pct,
        request.min_logfc,
        request.n_genes
    )
    
    return TaskResponse(
        task_id=task_id,
        message="Marker gene identification task started"
    )

@router.post("/plot", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_plot(
    request: PlotRequest,
    background_tasks: BackgroundTasks,
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Generate a plot for a dataset.
    """
    task_id = str(uuid.uuid4())
    
    async def run_plot():
        if request.plot_type == 'embedding':
            # Extract the basis from plot_type (e.g., 'umap', 'tsne', 'pca')
            basis, *color = request.plot_type.split('_', 1)
            color = color[0] if color else None
            
            return service.plot_embedding(
                request.adata_id,
                basis=basis,
                color=color,
                figsize=(request.width / 100, request.height / 100),
                save_path=request.save_path
            )
        elif request.plot_type == 'violin_mt':
            return service.plot_violin_mitochondrial_genes(
                request.adata_id,
                figsize=(request.width / 100, request.height / 100),
                save_path=request.save_path
            )
        elif request.plot_type == 'highly_variable_genes':
            return service.plot_highly_variable_genes(
                request.adata_id,
                figsize=(request.width / 100, request.height / 100),
                save_path=request.save_path
            )
        elif request.plot_type == 'pca_variance':
            return service.plot_pca_variance(
                request.adata_id,
                figsize=(request.width / 100, request.height / 100),
                save_path=request.save_path
            )
        elif request.plot_type.startswith('dotplot'):
            # Extract genes from plot_type or use default
            _, *genes = request.plot_type.split('_', 1)
            genes = genes[0].split(',') if genes else []
            
            return service.plot_dotplot(
                request.adata_id,
                genes=genes,
                figsize=(request.width / 100, request.height / 100),
                save_path=request.save_path
            )
        else:
            raise ValueError(f"Unsupported plot type: {request.plot_type}")
    
    background_tasks.add_task(
        run_background_task,
        task_id,
        run_plot
    )
    
    return TaskResponse(
        task_id=task_id,
        message=f"{request.plot_type} plot generation task started"
    )

@router.get("/plot/{plot_id}", response_model=None)
async def get_plot(
    plot_id: str = Path(..., description="ID of the plot to get")
):
    """
    Get a plot by its ID.
    """
    # Find the task that generated the plot
    for task_id, task in tasks.items():
        if task["status"] == "completed" and task["result"] and "plot_id" in task["result"] and task["result"]["plot_id"] == plot_id:
            # Return the plot as a PNG
            return Response(
                content=task["result"]["plot_data"],
                media_type="image/png"
            )
    
    raise HTTPException(
        status_code=404,
        detail=f"Plot with ID {plot_id} not found"
    )

@router.get("/summary/{adata_id}", response_model=Dict[str, Any])
async def get_adata_summary(
    adata_id: str = Path(..., description="ID of the AnnData object to summarize"),
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Get a summary of an AnnData object.
    """
    try:
        return service.summarize_adata(adata_id)
    except ResourceNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"AnnData object with ID {adata_id} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to summarize AnnData object: {str(e)}"
        )

@router.post("/export/{adata_id}", response_model=Dict[str, str])
async def export_adata(
    adata_id: str = Path(..., description="ID of the AnnData object to export"),
    format: str = Query("h5ad", description="Format to export to (h5ad or seurat)"),
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Export an AnnData object to a file.
    """
    try:
        # Create a temporary directory to store the exported file
        temp_dir = tempfile.mkdtemp()
        
        if format.lower() == "h5ad":
            output_path = os.path.join(temp_dir, f"{adata_id}.h5ad")
            result_path = service.save_adata_to_h5ad(adata_id, output_path)
        elif format.lower() == "seurat":
            output_path = os.path.join(temp_dir, f"{adata_id}.rds")
            result_path = service.convert_h5ad_to_seurat(adata_id, output_path)
        else:
            raise ValueError(f"Unsupported export format: {format}")
        
        return {"file_path": result_path}
        
    except ResourceNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"AnnData object with ID {adata_id} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export AnnData object: {str(e)}"
        )

@router.post("/clear-cache", response_model=BaseResponse)
async def clear_cache(
    service: SingleCellService = Depends(get_single_cell_service)
):
    """
    Clear the cache of AnnData objects.
    """
    try:
        service.clear_cache()
        return BaseResponse(message="Cache cleared successfully")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        ) 