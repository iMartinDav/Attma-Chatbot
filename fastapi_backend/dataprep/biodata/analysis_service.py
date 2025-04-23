"""
Analysis Service for Bioinformatics Data.

This module integrates the various components of the analysis pipeline,
providing a unified interface for processing bioinformatics data.
"""

import os
import json
import logging
import tempfile
import uuid
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
from datetime import datetime

from .processing_queue import (
    ProcessingQueue, JobPriority, JobStatus, ProcessingJob
)
from .analysis_components import (
    AnalysisType, AnalysisResult, get_analysis_registry
)
from .result_formatters import (
    get_formatter_registry, FormattingError
)
from .workflow_runner import WorkflowRunner
from .data_processor import BioinformaticsProcessor, DataProcessingError

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AnalysisError(Exception):
    """Exception raised for errors in the analysis service."""
    pass


class AnalysisService:
    """
    Service for managing bioinformatics data analysis.
    
    This class integrates the processing queue, analysis components,
    workflow runner, and result formatters into a unified service.
    
    Attributes:
        queue: The processing queue for handling analysis jobs
        workflows_dir: Directory containing workflow scripts
        results_dir: Directory for storing analysis results
        max_workers: Maximum number of concurrent worker threads
    """
    
    def __init__(
        self, 
        workflows_dir: Optional[Union[str, Path]] = None,
        results_dir: Optional[Union[str, Path]] = None,
        max_workers: int = 4,
        job_timeout: int = 3600,
        retry_limit: int = 2
    ):
        """
        Initialize the analysis service.
        
        Args:
            workflows_dir: Directory containing workflow scripts
            results_dir: Directory for storing analysis results
            max_workers: Maximum number of concurrent worker threads
            job_timeout: Maximum time (seconds) a job can run before timing out
            retry_limit: Maximum number of retry attempts for failed jobs
        """
        # Create processing queue
        self.queue = ProcessingQueue(
            max_workers=max_workers,
            job_timeout=job_timeout,
            retry_limit=retry_limit
        )
        
        # Set up directories
        module_dir = Path(__file__).parent.parent
        self.workflows_dir = Path(workflows_dir) if workflows_dir else module_dir / "workflows"
        self.results_dir = Path(results_dir) if results_dir else module_dir / "results"
        
        # Ensure directories exist
        os.makedirs(self.workflows_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)
        
        # Create workflow runner
        self.workflow_runner = WorkflowRunner(self.workflows_dir)
        
        # Get registries
        self.analysis_registry = get_analysis_registry()
        self.formatter_registry = get_formatter_registry()
        
        # Register job handlers
        self._register_job_handlers()
        
        # Start the queue
        self.queue.start()
        logger.info(f"Analysis service initialized with {max_workers} workers")
    
    def _register_job_handlers(self) -> None:
        """Register handlers for different job types with the queue."""
        # Register analysis job handler
        self.queue.register_handler("analysis", self._handle_analysis_job)
        
        # Register workflow job handler
        self.queue.register_handler("workflow", self._handle_workflow_job)
        
        # Register format job handler
        self.queue.register_handler("format", self._handle_format_job)
    
    def _handle_analysis_job(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle an analysis job.
        
        Args:
            params: Parameters for the analysis
            
        Returns:
            Result of the analysis
        """
        try:
            # Extract parameters
            analysis_type = params.get("analysis_type")
            if not analysis_type:
                raise ValueError("Missing required parameter: analysis_type")
            
            # Convert string to enum if needed
            if isinstance(analysis_type, str):
                try:
                    analysis_type = AnalysisType(analysis_type)
                except ValueError:
                    raise ValueError(f"Invalid analysis type: {analysis_type}")
            
            # Run the analysis
            result = self.analysis_registry.analyze(analysis_type, params)
            
            # Save result if requested
            if params.get("save_result", False):
                result_path = self._save_result(result, params)
                return {
                    "status": "success",
                    "result_path": str(result_path),
                    "result_summary": result.to_dict()
                }
            
            return {
                "status": "success",
                "result": result.to_dict()
            }
        
        except Exception as e:
            logger.error(f"Error in analysis job: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _handle_workflow_job(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a workflow job.
        
        Args:
            params: Parameters for the workflow
            
        Returns:
            Result of the workflow
        """
        try:
            # Extract parameters
            workflow_name = params.get("workflow_name")
            if not workflow_name:
                raise ValueError("Missing required parameter: workflow_name")
            
            # Run the workflow
            workflow_params = params.get("workflow_params", {})
            result = self.workflow_runner.run_workflow(workflow_name, workflow_params)
            
            return {
                "status": "success",
                "workflow_result": result
            }
        
        except Exception as e:
            logger.error(f"Error in workflow job: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _handle_format_job(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a format job.
        
        Args:
            params: Parameters for formatting
            
        Returns:
            Formatted result
        """
        try:
            # Extract parameters
            result_data = params.get("result_data")
            if not result_data:
                raise ValueError("Missing required parameter: result_data")
            
            format_name = params.get("format_name")
            if not format_name:
                raise ValueError("Missing required parameter: format_name")
            
            # Create AnalysisResult from data
            if isinstance(result_data, dict):
                # Try to reconstruct the result object
                try:
                    result = AnalysisResult.from_dict(result_data)
                except Exception:
                    # If reconstruction fails, assume it's a raw result
                    result = AnalysisResult(
                        analysis_type=params.get("analysis_type", "unknown"),
                        result_data=result_data,
                        metadata=params.get("metadata", {})
                    )
            else:
                raise ValueError("Invalid result_data: must be a dictionary")
            
            # Format the result
            format_type = params.get("format_type")
            options = params.get("options", {})
            
            formatted = self.formatter_registry.format_result(
                result, format_name, format_type, options
            )
            
            return {
                "status": "success",
                "formatted_result": formatted
            }
        
        except Exception as e:
            logger.error(f"Error in format job: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _save_result(
        self, 
        result: AnalysisResult, 
        params: Dict[str, Any]
    ) -> Path:
        """
        Save an analysis result to a file.
        
        Args:
            result: The analysis result to save
            params: Analysis parameters
            
        Returns:
            Path to the saved result file
        """
        # Create a unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_id = uuid.uuid4().hex[:8]
        filename = f"{result.analysis_type}_{timestamp}_{result_id}.json"
        
        # Create a directory for this analysis type if needed
        result_dir = self.results_dir / str(result.analysis_type)
        os.makedirs(result_dir, exist_ok=True)
        
        # Save the result
        result_path = result_dir / filename
        with open(result_path, 'w') as f:
            json.dump(result.to_dict(), f, indent=2)
        
        logger.info(f"Saved analysis result to {result_path}")
        return result_path
    
    def submit_analysis(
        self,
        analysis_type: Union[str, AnalysisType],
        params: Dict[str, Any],
        user_id: Optional[str] = None,
        priority: JobPriority = JobPriority.NORMAL
    ) -> str:
        """
        Submit an analysis job to the queue.
        
        Args:
            analysis_type: Type of analysis to perform
            params: Parameters for the analysis
            user_id: ID of the user submitting the job
            priority: Priority level for the job
            
        Returns:
            Job ID for tracking
        """
        # Prepare job parameters
        job_params = params.copy()
        job_params["analysis_type"] = analysis_type
        
        # Submit the job
        job_id = self.queue.submit_job(
            "analysis", job_params, user_id, priority
        )
        
        logger.info(f"Submitted analysis job {job_id} with type {analysis_type}")
        return job_id
    
    def submit_workflow(
        self,
        workflow_name: str,
        workflow_params: Dict[str, Any],
        user_id: Optional[str] = None,
        priority: JobPriority = JobPriority.NORMAL
    ) -> str:
        """
        Submit a workflow job to the queue.
        
        Args:
            workflow_name: Name of the workflow to run
            workflow_params: Parameters for the workflow
            user_id: ID of the user submitting the job
            priority: Priority level for the job
            
        Returns:
            Job ID for tracking
        """
        # Prepare job parameters
        job_params = {
            "workflow_name": workflow_name,
            "workflow_params": workflow_params
        }
        
        # Submit the job
        job_id = self.queue.submit_job(
            "workflow", job_params, user_id, priority
        )
        
        logger.info(f"Submitted workflow job {job_id} for workflow {workflow_name}")
        return job_id
    
    def format_result(
        self,
        result_data: Dict[str, Any],
        format_name: str,
        format_type: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None,
        async_processing: bool = False,
        user_id: Optional[str] = None
    ) -> Union[Dict[str, Any], str]:
        """
        Format an analysis result.
        
        Args:
            result_data: Result data to format
            format_name: Name of the format
            format_type: Specific type within the format
            options: Additional formatting options
            async_processing: Whether to process asynchronously
            user_id: ID of the user submitting the job
            
        Returns:
            Formatted result or job ID if async_processing is True
        """
        # Prepare job parameters
        job_params = {
            "result_data": result_data,
            "format_name": format_name,
            "format_type": format_type,
            "options": options
        }
        
        if async_processing:
            # Submit the job
            job_id = self.queue.submit_job(
                "format", job_params, user_id, JobPriority.HIGH
            )
            
            logger.info(f"Submitted format job {job_id} for format {format_name}")
            return job_id
        else:
            # Process immediately
            return self._handle_format_job(job_params)
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a job.
        
        Args:
            job_id: ID of the job to check
            
        Returns:
            Job status dictionary, or None if job not found
        """
        return self.queue.get_job_status(job_id)
    
    def list_jobs(
        self,
        status: Optional[Union[JobStatus, List[JobStatus]]] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List jobs in the queue.
        
        Args:
            status: Filter by job status
            user_id: Filter by user ID
            limit: Maximum number of jobs to return
            offset: Offset for pagination
            
        Returns:
            List of job dictionaries
        """
        return self.queue.list_jobs(status, user_id, limit, offset)
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the current state of the queue.
        
        Returns:
            Dictionary with queue statistics
        """
        return self.queue.get_queue_stats()
    
    def list_available_analysis_types(self) -> List[Dict[str, Any]]:
        """
        List all available analysis types.
        
        Returns:
            List of analysis type information dictionaries
        """
        return self.analysis_registry.list_components()
    
    def list_available_workflows(self) -> List[str]:
        """
        List all available workflows.
        
        Returns:
            List of workflow names
        """
        return self.workflow_runner.list_available_workflows()
    
    def list_available_formatters(self) -> List[str]:
        """
        List all available formatters.
        
        Returns:
            List of formatter names
        """
        return self.formatter_registry.list_formatters()
    
    def shutdown(self) -> None:
        """Shutdown the analysis service."""
        logger.info("Shutting down analysis service")
        self.queue.stop(wait=True)


# Singleton instance
_instance = None


def get_analysis_service(
    workflows_dir: Optional[Union[str, Path]] = None,
    results_dir: Optional[Union[str, Path]] = None,
    max_workers: int = 4
) -> AnalysisService:
    """
    Get the global analysis service instance.
    
    Args:
        workflows_dir: Directory containing workflow scripts
        results_dir: Directory for storing analysis results
        max_workers: Maximum number of concurrent worker threads
        
    Returns:
        The global analysis service instance
    """
    global _instance
    if _instance is None:
        _instance = AnalysisService(
            workflows_dir=workflows_dir,
            results_dir=results_dir,
            max_workers=max_workers
        )
    return _instance


# Example usage
if __name__ == "__main__":
    import time
    
    # Get the analysis service
    service = get_analysis_service()
    
    # Create a test input file
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
        f.write(b"gene,cell1,cell2,cell3\n")
        f.write(b"gene1,1.0,2.0,3.0\n")
        f.write(b"gene2,4.0,5.0,6.0\n")
        test_file = f.name
    
    try:
        # Print available analysis types
        print("Available analysis types:")
        for component in service.list_available_analysis_types():
            print(f"- {component['name']} ({component['analysis_type']})")
        
        # Submit a matrix stats analysis
        print("\nSubmitting matrix stats analysis...")
        job_id = service.submit_analysis(
            AnalysisType.MATRIX_STATS,
            {"input": test_file}
        )
        print(f"Job ID: {job_id}")
        
        # Wait for job to complete
        status = None
        while status != JobStatus.COMPLETED and status != JobStatus.FAILED:
            job_status = service.get_job_status(job_id)
            status = job_status.get("status") if job_status else None
            print(f"Job status: {status}")
            time.sleep(1)
        
        # Get the result
        job_result = service.get_job_status(job_id)
        if job_result and job_result.get("result"):
            result_data = job_result["result"]
            
            # Format as table
            print("\nFormatting result as table...")
            formatted = service.format_result(
                result_data, "table", "grid"
            )
            if formatted.get("status") == "success":
                print(f"Table format successful: {len(formatted['formatted_result']['tableData']['rows'])} rows")
            else:
                print(f"Format error: {formatted.get('error')}")
        
        # Print queue stats
        print("\nQueue stats:")
        stats = service.get_queue_stats()
        print(f"- Pending jobs: {stats['pending']}")
        print(f"- Active jobs: {stats['active']}")
        print(f"- Completed jobs: {stats['completed']}")
        print(f"- Failed jobs: {stats['failed']}")
        
    finally:
        # Clean up
        if os.path.exists(test_file):
            os.unlink(test_file)
        
        # Shutdown
        service.shutdown()