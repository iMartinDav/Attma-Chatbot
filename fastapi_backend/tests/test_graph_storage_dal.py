"""
Test cases for the graph storage data access layer.

This module contains tests for the data access layer used to store and
retrieve graph visualizations and other analysis results.
"""

import pytest
import uuid
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime

from fastapi_backend.app.graph_storage import (
    insert_analysis_result, get_analysis_result,
    update_analysis_result, list_analysis_results,
    delete_analysis_result
)


@pytest.fixture
def mock_httpx_client():
    """Fixture to mock the httpx client."""
    with patch('fastapi_backend.app.graph_storage.httpx.AsyncClient') as mock_client:
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": str(uuid.uuid4())}
        
        # Setup the client's context manager
        mock_context_mgr = MagicMock()
        mock_context_mgr.__aenter__.return_value = mock_context_mgr
        mock_context_mgr.post = AsyncMock(return_value=mock_response)
        mock_context_mgr.get = AsyncMock(return_value=mock_response)
        mock_context_mgr.patch = AsyncMock(return_value=mock_response)
        mock_context_mgr.delete = AsyncMock(return_value=mock_response)
        
        mock_client.return_value = mock_context_mgr
        
        yield mock_context_mgr


@pytest.mark.asyncio
async def test_insert_analysis_result(mock_httpx_client):
    """Test inserting an analysis result."""
    # Define test data
    user_id = str(uuid.uuid4())
    analysis_type = "test_analysis"
    result_type = "table"
    storage_type = "database"
    metadata = {"test": "metadata"}
    small_result = {"data": "test_data"}
    
    # Insert the result
    success, message, result_id = await insert_analysis_result(
        user_id=user_id,
        analysis_type=analysis_type,
        result_type=result_type,
        storage_type=storage_type,
        metadata=metadata,
        small_result=small_result
    )
    
    # Check result
    assert success is True
    assert message == "Analysis result inserted successfully"
    assert result_id is not None
    
    # Check API call
    mock_httpx_client.post.assert_called_once()
    args, kwargs = mock_httpx_client.post.call_args
    assert args[0].endswith("/analysis-results")
    assert kwargs["json"]["userId"] == user_id
    assert kwargs["json"]["analysisType"] == analysis_type
    assert kwargs["json"]["resultType"] == result_type
    assert kwargs["json"]["storageType"] == storage_type
    assert kwargs["json"]["metadata"] == metadata
    assert kwargs["json"]["smallResult"] == small_result


@pytest.mark.asyncio
async def test_get_analysis_result(mock_httpx_client):
    """Test retrieving an analysis result."""
    # Define test data
    result_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    
    # Setup mock response data
    mock_result = {
        "id": result_id,
        "user_id": user_id,
        "analysis_type": "test_analysis",
        "result_type": "table",
        "storage_type": "database",
        "created_at": datetime.now().isoformat(),
        "metadata": {"test": "metadata"},
        "small_result": {"data": "test_data"}
    }
    mock_httpx_client.get.return_value.json.return_value = mock_result
    
    # Get the result
    success, message, result = await get_analysis_result(result_id, user_id)
    
    # Check result
    assert success is True
    assert message == "Analysis result retrieved successfully"
    assert result == mock_result
    
    # Check API call
    mock_httpx_client.get.assert_called_once()
    args, kwargs = mock_httpx_client.get.call_args
    assert args[0].endswith(f"/analysis-results/{result_id}")
    assert kwargs["params"]["userId"] == user_id


@pytest.mark.asyncio
async def test_update_analysis_result(mock_httpx_client):
    """Test updating an analysis result."""
    # Define test data
    result_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    updates = {
        "metadata": {"updated": "metadata"},
        "small_result": {"updated": "data"}
    }
    
    # Update the result
    success, message = await update_analysis_result(result_id, user_id, updates)
    
    # Check result
    assert success is True
    assert message == "Analysis result updated successfully"
    
    # Check API call
    mock_httpx_client.patch.assert_called_once()
    args, kwargs = mock_httpx_client.patch.call_args
    assert args[0].endswith(f"/analysis-results/{result_id}")
    assert kwargs["json"]["userId"] == user_id
    assert kwargs["json"]["metadata"] == updates["metadata"]
    assert kwargs["json"]["small_result"] == updates["small_result"]


@pytest.mark.asyncio
async def test_list_analysis_results(mock_httpx_client):
    """Test listing analysis results."""
    # Define test data
    user_id = str(uuid.uuid4())
    analysis_type = "test_analysis"
    result_type = "table"
    
    # Setup mock response data
    mock_results = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "analysis_type": analysis_type,
            "result_type": result_type,
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "analysis_type": analysis_type,
            "result_type": result_type,
            "created_at": datetime.now().isoformat()
        }
    ]
    mock_httpx_client.get.return_value.json.return_value = mock_results
    
    # List the results
    success, message, results = await list_analysis_results(
        user_id=user_id,
        analysis_type=analysis_type,
        result_type=result_type,
        limit=10,
        offset=0
    )
    
    # Check result
    assert success is True
    assert "Found" in message
    assert results == mock_results
    
    # Check API call
    mock_httpx_client.get.assert_called_once()
    args, kwargs = mock_httpx_client.get.call_args
    assert args[0].endswith("/analysis-results")
    assert kwargs["params"]["userId"] == user_id
    assert kwargs["params"]["analysisType"] == analysis_type
    assert kwargs["params"]["resultType"] == result_type
    assert kwargs["params"]["limit"] == 10
    assert kwargs["params"]["offset"] == 0


@pytest.mark.asyncio
async def test_delete_analysis_result(mock_httpx_client):
    """Test deleting an analysis result."""
    # Define test data
    result_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    
    # Delete the result
    success, message = await delete_analysis_result(result_id, user_id)
    
    # Check result
    assert success is True
    assert message == "Analysis result deleted successfully"
    
    # Check API call
    mock_httpx_client.delete.assert_called_once()
    args, kwargs = mock_httpx_client.delete.call_args
    assert args[0].endswith(f"/analysis-results/{result_id}")
    assert kwargs["params"]["userId"] == user_id


@pytest.mark.asyncio
async def test_error_handling():
    """Test error handling in the DAL."""
    # Test with a failing client
    with patch('fastapi_backend.app.graph_storage.httpx.AsyncClient') as mock_client:
        # Setup client to raise exception
        mock_context_mgr = MagicMock()
        mock_context_mgr.__aenter__.side_effect = Exception("Test error")
        mock_client.return_value = mock_context_mgr
        
        # Try an operation
        success, message, result_id = await insert_analysis_result(
            user_id=str(uuid.uuid4()),
            analysis_type="test",
            result_type="test",
            storage_type="test"
        )
        
        # Check error handling
        assert success is False
        assert "Error" in message
        assert result_id is None