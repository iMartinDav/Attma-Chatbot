"""
Test cases for the background processing service.

This module contains tests for the asynchronous background processing
service used for long-running bioinformatics analyses.
"""

import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
import uuid
from datetime import datetime

from fastapi_backend.services.background_processing_service import (
    get_background_service, get_processing_queue, BackgroundAnalysisService
)
from fastapi_backend.dataprep.biodata.processing_queue import (
    JobStatus, JobPriority
)


@pytest.fixture
def background_service():
    """Fixture to provide a background service with mocks."""
    with patch('fastapi_backend.services.background_processing_service.ProcessingQueue') as mock_queue:
        # Setup mock queue
        queue_instance = MagicMock()
        queue_instance.submit_job.return_value = str(uuid.uuid4())
        queue_instance.get_job_status.return_value = {
            "job_id": str(uuid.uuid4()),
            "status": JobStatus.COMPLETED.value,
            "result": {"data": "test_result"},
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        mock_queue.return_value = queue_instance
        
        # Create the service with mocked dependencies
        service = BackgroundAnalysisService(max_workers=1)
        
        yield service


@pytest.mark.asyncio
async def test_submit_analysis_task(background_service):
    """Test submitting an analysis task."""
    # Submit a test analysis task
    task_id = background_service.submit_analysis_task(
        analysis_type="test_analysis",
        params={"param1": "value1"},
        user_id="test_user",
        priority=JobPriority.HIGH
    )
    
    # Verify task was submitted
    assert task_id is not None
    assert isinstance(task_id, str)
    
    # Verify queue was called with expected parameters
    background_service.queue.submit_job.assert_called_once()
    call_args = background_service.queue.submit_job.call_args[1]
    assert call_args["job_type"] == "analysis"
    assert call_args["user_id"] == "test_user"
    assert call_args["priority"] == JobPriority.HIGH
    assert "analysis_type" in call_args["params"]
    assert call_args["params"]["analysis_type"] == "test_analysis"


@pytest.mark.asyncio
async def test_submit_visualization_task(background_service):
    """Test submitting a visualization task."""
    # Submit a test visualization task
    task_id = background_service.submit_visualization_task(
        visualization_type="test_plot",
        params={"param1": "value1"},
        user_id="test_user"
    )
    
    # Verify task was submitted
    assert task_id is not None
    assert isinstance(task_id, str)
    
    # Verify queue was called with expected parameters
    background_service.queue.submit_job.assert_called_once()
    call_args = background_service.queue.submit_job.call_args[1]
    assert call_args["job_type"] == "visualization"
    assert call_args["user_id"] == "test_user"
    assert "visualization_type" in call_args["params"]
    assert call_args["params"]["visualization_type"] == "test_plot"


@pytest.mark.asyncio
async def test_get_task_status(background_service):
    """Test retrieving task status."""
    # Mock task ID
    task_id = str(uuid.uuid4())
    
    # Get task status
    status = background_service.get_task_status(task_id)
    
    # Verify status was retrieved
    assert status is not None
    assert status["status"] == JobStatus.COMPLETED.value
    assert "result" in status
    
    # Verify queue was called with expected parameters
    background_service.queue.get_job_status.assert_called_once_with(task_id)


@pytest.mark.asyncio
async def test_cancel_task(background_service):
    """Test canceling a task."""
    # Mock task ID
    task_id = str(uuid.uuid4())
    
    # Setup mock return value for cancel_job
    background_service.queue.cancel_job.return_value = True
    
    # Cancel task
    result = background_service.cancel_task(task_id)
    
    # Verify result
    assert result is True
    
    # Verify queue was called with expected parameters
    background_service.queue.cancel_job.assert_called_once_with(task_id)


@pytest.mark.asyncio
async def test_queue_stats(background_service):
    """Test retrieving queue statistics."""
    # Setup mock return value
    background_service.queue.get_queue_stats.return_value = {
        "pending": 2,
        "active": 1,
        "completed": 5,
        "failed": 1,
        "workers": 4,
        "running": True
    }
    
    # Get queue stats
    stats = background_service.get_queue_stats()
    
    # Verify stats were retrieved
    assert stats is not None
    assert "pending" in stats
    assert "active" in stats
    assert "completed" in stats
    assert "failed" in stats
    assert "workers" in stats
    assert "running" in stats
    
    # Verify queue was called
    background_service.queue.get_queue_stats.assert_called_once()


@pytest.mark.asyncio
async def test_list_tasks(background_service):
    """Test listing tasks."""
    # Setup mock return value
    mock_tasks = [
        {
            "job_id": str(uuid.uuid4()),
            "status": JobStatus.COMPLETED.value,
            "user_id": "test_user",
            "job_type": "analysis",
            "created_at": datetime.now().isoformat()
        },
        {
            "job_id": str(uuid.uuid4()),
            "status": JobStatus.PROCESSING.value,
            "user_id": "test_user",
            "job_type": "visualization",
            "created_at": datetime.now().isoformat()
        }
    ]
    background_service.queue.list_jobs.return_value = mock_tasks
    
    # List tasks
    tasks = background_service.list_tasks(user_id="test_user")
    
    # Verify tasks were listed
    assert tasks is not None
    assert len(tasks) == 2
    
    # Verify queue was called with expected parameters
    background_service.queue.list_jobs.assert_called_once()
    call_args = background_service.queue.list_jobs.call_args[1]
    assert call_args["user_id"] == "test_user"


@pytest.mark.asyncio
async def test_handle_analysis_job(background_service):
    """Test the analysis job handler."""
    # Create a patched version of the handler that doesn't use asyncio
    with patch('asyncio.get_event_loop') as mock_loop:
        # Mock the loop
        mock_loop.is_running.return_value = True
        mock_loop.run_until_complete.return_value = (True, "Success", "test_id")
        
        # Setup mock params
        params = {
            "analysis_type": "test_analysis",
            "user_id": "test_user",
            "metadata": {"test": "data"}
        }
        
        # Call the handler
        result = background_service._handle_analysis_job(params)
        
        # Verify result
        assert result is not None
        assert result["status"] == "success"
        assert "result_id" in result


@pytest.mark.asyncio
async def test_handle_visualization_job(background_service):
    """Test the visualization job handler."""
    # This test would require more complex mocking for the actual visualization code
    # Simplified test to just ensure the handler doesn't throw an exception
    with patch('asyncio.get_event_loop') as mock_loop:
        # Mock the loop
        mock_loop.is_running.return_value = True
        mock_loop.run_until_complete.return_value = (True, "Success", {"id": "test_id", "url": "https://test.url"})
        
        # Setup mock params
        params = {
            "visualization_type": "scatter",
            "user_id": "test_user",
            "metadata": {"test": "data"}
        }
        
        # Patch the import for the single cell service
        with patch('fastapi_backend.services.background_processing_service.get_single_cell_service') as mock_get_sc:
            # Mock the single cell service
            mock_sc = MagicMock()
            mock_sc.generate_plot.return_value = {"plot_bytes": b"test_plot_data"}
            mock_get_sc.return_value = mock_sc
            
            # Call the handler
            result = background_service._handle_visualization_job(params)
            
            # Verify result structure (cannot verify exact content due to mocking)
            assert result is not None
            assert isinstance(result, dict)


@pytest.mark.asyncio
async def test_singleton_pattern():
    """Test that the background service uses the singleton pattern."""
    # Get service instances
    service1 = get_background_service()
    service2 = get_background_service()
    
    # They should be the same instance
    assert service1 is service2