from fastapi import BackgroundTasks
from fastapi_backend.services.background_processing_service import get_background_service

class PlotRequest(BaseModel):
    """Request model for generating a plot."""
    adata_id: str
    plot_type: str
    parameters: Optional[Dict[str, Any]] = None
    width: Optional[int] = 800
    height: Optional[int] = 600


class PlotResponse(BaseModel):
    """Response model for plot generation."""
    status: str  # "completed", "processing", or "failed"
    message: str
    url: Optional[str] = None
    plot_id: Optional[str] = None
    task_id: Optional[str] = None


class PlotStatusResponse(BaseModel):
    """Response model for plot task status."""
    status: str
    message: str
    url: Optional[str] = None
    plot_id: Optional[str] = None
    task_id: Optional[str] = None

# Route to generate a plot and return its URL
@router.post("/plot", response_model=PlotResponse)
async def generate_plot(
    plot_request: PlotRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(current_active_user)
):
    """
    Generate a plot for the specified AnnData object and plot type.
    For large or computationally intensive plots, processing happens in the background.
    Returns a task ID immediately for status tracking and eventual plot URL retrieval.
    """
    try:
        # Get the single cell service
        service = get_single_cell_service()
        
        # For computationally intensive plots, process in background
        if plot_request.plot_type in ["umap", "tsne", "pca", "spatial", "heatmap"]:
            # Get background service
            bg_service = get_background_service()
            
            # Submit as a background visualization task
            task_id = bg_service.submit_visualization_task(
                visualization_type=plot_request.plot_type,
                params={
                    "adata_id": plot_request.adata_id,
                    "parameters": plot_request.parameters.dict() if plot_request.parameters else {},
                    "plot_height": plot_request.height,
                    "plot_width": plot_request.width
                },
                user_id=str(current_user.id),
                metadata={
                    "title": f"{plot_request.plot_type.upper()} Plot",
                    "original_request": plot_request.dict()
                }
            )
            
            return PlotResponse(
                status="processing",
                message=f"Plot generation in progress. Use task ID {task_id} to check status.",
                task_id=task_id
            )
        else:
            # For simpler plots, process synchronously
            plot_data = await service.generate_plot(
                plot_request.adata_id, 
                plot_request.plot_type,
                plot_request.parameters,
                width=plot_request.width,
                height=plot_request.height
            )
            
            # Store the plot in Vercel Blob Storage
            from fastapi_backend.analysis.utility import store_plot_visualization
            
            plot_bytes = plot_data["plot_bytes"]
            success, message, result = await store_plot_visualization(
                plot_data=plot_bytes,
                title=f"{plot_request.plot_type.upper()} Plot",
                plot_type=plot_request.plot_type,
                user_id=str(current_user.id),
                metadata={
                    "adata_id": plot_request.adata_id,
                    "parameters": plot_request.parameters.dict() if plot_request.parameters else {},
                    "generated_at": datetime.now().isoformat()
                }
            )
            
            if not success:
                raise HTTPException(status_code=500, detail=f"Failed to store plot: {message}")
            
            return PlotResponse(
                status="completed", 
                message="Plot generated successfully",
                url=result["url"],
                plot_id=result["id"]
            )
    except Exception as e:
        logger.error(f"Error generating plot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Route to get the status of a background plot task
@router.get("/plot/status/{task_id}", response_model=PlotStatusResponse)
async def get_plot_status(
    task_id: str, 
    current_user: User = Depends(current_active_user)
):
    """
    Check the status of a background plot generation task.
    
    If the task is complete, returns the plot URL.
    """
    try:
        # Get background service
        bg_service = get_background_service()
        
        # Get task status
        task_status = bg_service.get_task_status(task_id)
        
        if not task_status:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        # Check if the task belongs to the current user
        task_user_id = task_status.get("user_id")
        if task_user_id and task_user_id != str(current_user.id):
            raise HTTPException(
                status_code=403, 
                detail="You don't have permission to access this task"
            )
        
        # Create response based on status
        if task_status["status"] == "completed":
            # Task completed successfully
            result = task_status.get("result", {})
            
            # Extract plot URL from result
            if "result_id" in result:
                # Get the analysis result with the plot details
                from fastapi_backend.app.graph_storage import get_analysis_result
                success, message, analysis_result = await get_analysis_result(
                    result["result_id"], 
                    str(current_user.id)
                )
                
                if success and analysis_result:
                    return PlotStatusResponse(
                        status="completed",
                        message="Plot generated successfully",
                        url=analysis_result.get("result_location"),
                        plot_id=analysis_result.get("id")
                    )
            
            # Fallback if URL not found in result
            return PlotStatusResponse(
                status="completed",
                message="Plot task completed but URL not found",
                task_id=task_id
            )
        elif task_status["status"] == "failed":
            # Task failed
            error_message = task_status.get("error", "Unknown error")
            return PlotStatusResponse(
                status="failed",
                message=f"Plot generation failed: {error_message}",
                task_id=task_id
            )
        else:
            # Task still in progress
            return PlotStatusResponse(
                status="processing",
                message=f"Plot generation in progress ({task_status['status']})",
                task_id=task_id
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking plot status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))