"""
BioFlow visualization router for graph artifacts.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uuid
import logging
import asyncio
import os
import json
from datetime import datetime

# Initialize logger
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(
    prefix="/api/bioflow/visualization",
    tags=["bioflow", "visualization"]
)

# Store for visualization job statuses
# In a production environment, this should be stored in a database or Redis
visualization_jobs = {}

class VisualizationRequest(BaseModel):
    """
    Request model for creating a visualization.
    """
    workflow_id: str
    visualization_type: str = "graph"  # Default to graph visualization
    config: Dict[str, Any] = {}


class VisualizationResponse(BaseModel):
    """
    Response model for visualization job.
    """
    job_id: str
    status: str
    message: Optional[str] = None


class VisualizationStatusResponse(BaseModel):
    """
    Response model for visualization job status.
    """
    job_id: str
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
    result_url: Optional[str] = None


async def generate_graph_visualization(job_id: str, workflow_id: str, config: Dict[str, Any]):
    """
    Background task to generate graph visualization.
    """
    try:
        # Update job status to processing
        visualization_jobs[job_id]["status"] = "processing"
        visualization_jobs[job_id]["progress"] = 0.0
        visualization_jobs[job_id]["message"] = "Starting visualization generation..."
        
        # Simulate processing stages - in a real implementation, this would call the actual graph generation logic
        for progress in [0.25, 0.5, 0.75, 1.0]:
            # Simulate processing time
            await asyncio.sleep(2)
            
            # Update progress
            visualization_jobs[job_id]["progress"] = progress
            visualization_jobs[job_id]["message"] = f"Processing visualization... {int(progress * 100)}%"
        
        # Create visualization output directory if it doesn't exist
        output_dir = os.path.join(os.getcwd(), "shared-data", "visualizations")
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate a filename for the visualization
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"graph_{workflow_id}_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)
        
        # Generate dummy graph data - in a real implementation, this would be actual graph data
        graph_data = {
            "nodes": [
                {"id": "node1", "label": "Input Data", "type": "input"},
                {"id": "node2", "label": "Process 1", "type": "process"},
                {"id": "node3", "label": "Process 2", "type": "process"},
                {"id": "node4", "label": "Output", "type": "output"},
            ],
            "edges": [
                {"source": "node1", "target": "node2"},
                {"id": "edge2", "source": "node2", "target": "node3"},
                {"id": "edge3", "source": "node3", "target": "node4"},
            ],
            "metadata": {
                "workflow_id": workflow_id,
                "created_at": datetime.now().isoformat(),
                "config": config,
            }
        }
        
        # Save the graph data to file
        with open(filepath, "w") as f:
            json.dump(graph_data, f, indent=2)
        
        # Update job status to completed
        relative_url = f"/api/bioflow/visualization/data/{filename}"
        visualization_jobs[job_id]["status"] = "completed"
        visualization_jobs[job_id]["progress"] = 1.0
        visualization_jobs[job_id]["message"] = "Visualization generated successfully"
        visualization_jobs[job_id]["result_url"] = relative_url
        visualization_jobs[job_id]["result_path"] = filepath
        
    except Exception as e:
        logger.error(f"Error generating visualization for job {job_id}: {e}")
        visualization_jobs[job_id]["status"] = "failed"
        visualization_jobs[job_id]["message"] = f"Error generating visualization: {str(e)}"


@router.post("", response_model=VisualizationResponse)
async def create_visualization(
    request: VisualizationRequest,
    background_tasks: BackgroundTasks
):
    """
    Create a new visualization.
    """
    job_id = str(uuid.uuid4())
    
    # Store job in memory - in a production environment, this should be stored in a database or Redis
    visualization_jobs[job_id] = {
        "job_id": job_id,
        "workflow_id": request.workflow_id,
        "visualization_type": request.visualization_type,
        "config": request.config,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "progress": 0.0,
        "message": "Visualization job queued"
    }
    
    # Start background task to generate visualization
    background_tasks.add_task(
        generate_graph_visualization,
        job_id=job_id,
        workflow_id=request.workflow_id,
        config=request.config
    )
    
    return VisualizationResponse(
        job_id=job_id,
        status="queued",
        message="Visualization job queued"
    )


@router.get("/{job_id}/status", response_model=VisualizationStatusResponse)
async def get_visualization_status(job_id: str):
    """
    Get the status of a visualization job.
    """
    if job_id not in visualization_jobs:
        raise HTTPException(status_code=404, detail="Visualization job not found")
    
    job = visualization_jobs[job_id]
    
    return VisualizationStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job.get("progress"),
        message=job.get("message"),
        result_url=job.get("result_url")
    )


@router.get("/data/{filename}")
async def get_visualization_data(filename: str):
    """
    Get the visualization data file.
    """
    filepath = os.path.join(os.getcwd(), "shared-data", "visualizations", filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Visualization data not found")
    
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
        
        return data
    except Exception as e:
        logger.error(f"Error reading visualization data {filepath}: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading visualization data: {str(e)}")


@router.get("/list/{workflow_id}", response_model=List[Dict[str, Any]])
async def list_visualizations(workflow_id: str):
    """
    List all visualizations for a workflow.
    """
    # Get all jobs for the workflow
    workflow_jobs = [
        job for job_id, job in visualization_jobs.items() 
        if job.get("workflow_id") == workflow_id and job.get("status") == "completed"
    ]
    
    return workflow_jobs