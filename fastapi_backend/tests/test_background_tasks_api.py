"""
Test cases for the background tasks API endpoints.

This module contains tests for the REST API endpoints used to manage
background tasks such as analysis and visualization jobs.
"""

import pytest
import uuid
import json
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient

from fastapi_backend.app.main import app
from fastapi_backend.dataprep.biodata.processing_queue import JobStatus, JobPriority


@pytest.fixture
def test_client():
    """Fixture to provide a test client."""
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
def authenticated_user():
    """Fixture to provide an authenticated user."""
    # Create a mock user object
    class MockUser:
        def __init__(self):
            self.id = uuid.uuid4()
            self.email = "test@example.com"
            self.is_active = True
    
    # Create a mock token
    access_token = "mock_access_token"
    
    return {
        "user": MockUser(),
        "access_token": access_token
    }


@pytest.fixture
def mock_background_service():
    """Fixture to mock the background service."""
    with patch('fastapi_backend.api.routes.background_tasks.get_background_service') as mock_get:
        # Create mock service
        mock_service = MagicMock()
        
        # Setup common return values
        task_id = str(uuid.uuid4())
        mock_service.submit_analysis_task.return_value = task_id
        mock_service.submit_visualization_task.return_value = task_id
        mock_service.get_task_status.return_value = {
            "task_id": task_id,
            "status": JobStatus.COMPLETED.value,
            "result": {"data": "test_result"},
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        mock_service.cancel_task.return_value = True
        mock_service.get_queue_stats.return_value = {
            "pending": 2,
            "active": 1,
            "completed": 5,
            "failed": 1,
            "workers": 4,
            "running": True
        }
        mock_service.list_tasks.return_value = [
            {
                "task_id": str(uuid.uuid4()),
                "status": JobStatus.COMPLETED.value,
                "created_at": datetime.now().isoformat()
            }
        ]
        
        # Return mock service
        mock_get.return_value = mock_service
        yield mock_service


@pytest.mark.asyncio
async def test_submit_analysis_task(test_client, authenticated_user, mock_background_service):
    """Test submitting an analysis task via the API."""
    # Mock authentication
    with patch('fastapi_backend.api.routes.background_tasks.current_active_user') as mock_auth:
        mock_auth.return_value = authenticated_user["user"]
        
        # Create test request body
        request_body = {
            "task_type": "analysis",
            "analysis_type": "test_analysis",
            "params": {"param1": "value1"},
            "priority": JobPriority.NORMAL.value
        }
        
        # Make API request
        response = test_client.post(
            "/tasks/analysis",
            json=request_body,
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert "task_id" in response_data
        assert "message" in response_data
        
        # Check service was called with expected parameters
        mock_background_service.submit_analysis_task.assert_called_once()
        call_args = mock_background_service.submit_analysis_task.call_args[1]
        assert call_args["analysis_type"] == "test_analysis"
        assert call_args["params"] == {"param1": "value1"}
        assert call_args["user_id"] == str(authenticated_user["user"].id)


@pytest.mark.asyncio
async def test_submit_visualization_task(test_client, authenticated_user, mock_background_service):
    """Test submitting a visualization task via the API."""
    # Mock authentication
    with patch('fastapi_backend.api.routes.background_tasks.current_active_user') as mock_auth:
        mock_auth.return_value = authenticated_user["user"]
        
        # Create test request body
        request_body = {
            "task_type": "visualization",
            "visualization_type": "scatter",
            "params": {"param1": "value1"},
            "priority": JobPriority.HIGH.value
        }
        
        # Make API request
        response = test_client.post(
            "/tasks/visualization",
            json=request_body,
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert "task_id" in response_data
        assert "message" in response_data
        
        # Check service was called with expected parameters
        mock_background_service.submit_visualization_task.assert_called_once()
        call_args = mock_background_service.submit_visualization_task.call_args[1]
        assert call_args["visualization_type"] == "scatter"
        assert call_args["params"] == {"param1": "value1"}
        assert call_args["user_id"] == str(authenticated_user["user"].id)


@pytest.mark.asyncio
async def test_get_task_status(test_client, authenticated_user, mock_background_service):
    """Test retrieving task status via the API."""
    # Mock authentication
    with patch('fastapi_backend.api.routes.background_tasks.current_active_user') as mock_auth:
        mock_auth.return_value = authenticated_user["user"]
        
        # Generate test task ID
        task_id = str(uuid.uuid4())
        
        # Make API request
        response = test_client.get(
            f"/tasks/status/{task_id}",
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert response_data["status"] == JobStatus.COMPLETED.value
        assert "result" in response_data
        
        # Check service was called with expected parameters
        mock_background_service.get_task_status.assert_called_once_with(task_id)


@pytest.mark.asyncio
async def test_cancel_task(test_client, authenticated_user, mock_background_service):
    """Test canceling a task via the API."""
    # Mock authentication
    with patch('fastapi_backend.api.routes.background_tasks.current_active_user') as mock_auth:
        mock_auth.return_value = authenticated_user["user"]
        
        # Generate test task ID
        task_id = str(uuid.uuid4())
        
        # Setup mock task status check
        mock_background_service.get_task_status.return_value = {
            "task_id": task_id,
            "status": JobStatus.PROCESSING.value,
            "user_id": str(authenticated_user["user"].id)
        }
        
        # Make API request
        response = test_client.delete(
            f"/tasks/cancel/{task_id}",
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert "message" in response_data
        
        # Check service was called with expected parameters
        mock_background_service.get_task_status.assert_called_once_with(task_id)
        mock_background_service.cancel_task.assert_called_once_with(task_id)


@pytest.mark.asyncio
async def test_get_queue_stats(test_client, authenticated_user, mock_background_service):
    """Test retrieving queue statistics via the API."""
    # Mock authentication
    with patch('fastapi_backend.api.routes.background_tasks.current_active_user') as mock_auth:
        mock_auth.return_value = authenticated_user["user"]
        
        # Make API request
        response = test_client.get(
            "/tasks/queue/stats",
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert "pending" in response_data
        assert "active" in response_data
        assert "completed" in response_data
        assert "failed" in response_data
        assert "workers" in response_data
        assert "running" in response_data
        
        # Check service was called
        mock_background_service.get_queue_stats.assert_called_once()


@pytest.mark.asyncio
async def test_list_tasks(test_client, authenticated_user, mock_background_service):
    """Test listing tasks via the API."""
    # Mock authentication
    with patch('fastapi_backend.api.routes.background_tasks.current_active_user') as mock_auth:
        mock_auth.return_value = authenticated_user["user"]
        
        # Make API request
        response = test_client.get(
            "/tasks/list?status=completed&limit=10&offset=0",
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert "tasks" in response_data
        assert "total" in response_data
        assert isinstance(response_data["tasks"], list)
        
        # Check service was called with expected parameters
        mock_background_service.list_tasks.assert_called_once()
        call_args = mock_background_service.list_tasks.call_args[1]
        assert call_args["user_id"] == str(authenticated_user["user"].id)
        assert call_args["limit"] == 10
        assert call_args["offset"] == 0