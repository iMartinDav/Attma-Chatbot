import os
import pytest
import pytest_asyncio
import tempfile
import uuid
from pathlib import Path
from unittest import mock
from fastapi import FastAPI
from httpx import AsyncClient
import json
from io import BytesIO

# Import the test fixtures
from .conftest import test_client, authenticated_user, db_session


@pytest.fixture
def test_mtx_content():
    """Create a simple MTX format content for testing"""
    return (
        "%%MatrixMarket matrix coordinate real general\n"
        "% This is a test matrix\n"
        "3 3 5\n"
        "1 1 1.5\n"
        "2 1 2.0\n"
        "2 2 2.5\n"
        "3 2 3.0\n"
        "3 3 3.5\n"
    )


@pytest.fixture
def mock_processor():
    """Mock for the BioinformaticsProcessor class"""
    with mock.patch("bioflow.biodata.BioinformaticsProcessor") as mock_proc:
        # Configure the mock matrix structure
        mock_proc.return_value.matrix_structure.data_type = "numeric"
        mock_proc.return_value.matrix_structure.num_rows = 3
        mock_proc.return_value.matrix_structure.num_columns = 3
        mock_proc.return_value.matrix_structure.has_header_row = False
        mock_proc.return_value.matrix_structure.has_header_column = False
        mock_proc.return_value.generate_matrix_subset.return_value = Path("/tmp/subset.mtx")
        yield mock_proc


@pytest_asyncio.fixture
async def test_file_upload(test_client, authenticated_user, test_mtx_content):
    """Fixture to upload a test file and return the response"""
    # Create a test file
    content = BytesIO(test_mtx_content.encode())
    
    # Upload the file
    response = await test_client.post(
        "/bioflow/upload/",
        files={"file": ("test_matrix.mtx", content, "text/plain")},
        headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
    )
    
    return response


@pytest.mark.asyncio
async def test_upload_bioinformatics_file(test_client, authenticated_user, test_mtx_content, mock_processor):
    """Test uploading a bioinformatics file"""
    # Create a test file
    content = BytesIO(test_mtx_content.encode())
    
    # Mock the background task execution
    with mock.patch("fastapi.BackgroundTasks.add_task") as mock_task:
        # Upload the file
        response = await test_client.post(
            "/bioflow/upload/",
            files={"file": ("test_matrix.mtx", content, "text/plain")},
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check the response
        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data
        assert "analysis_task_id" in data
        assert data["original_name"] == "test_matrix.mtx"
        assert data["needs_processing"] == True
        
        # Verify background task was added
        mock_task.assert_called_once()


@pytest.mark.asyncio
async def test_get_analysis_status(test_client, authenticated_user, test_file_upload, mock_processor):
    """Test getting the status of an analysis task"""
    upload_response = test_file_upload
    data = upload_response.json()
    
    # Mock the database query for analysis status
    with mock.patch("app.database.query_db") as mock_query:
        mock_query.return_value = [{
            "id": data["analysis_task_id"],
            "user_id": str(authenticated_user["user"].id),  # Use .id to access the user ID directly
            "file_id": data["file_id"],
            "status": "processing",
            "created_at": "2025-04-21T12:00:00",
            "updated_at": "2025-04-21T12:00:00"
        }]
        
        # Get analysis status
        response = await test_client.get(
            f"/bioflow/analysis/{data['analysis_task_id']}/status",
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == 200
        status_data = response.json()
        assert status_data["id"] == data["analysis_task_id"]
        assert status_data["status"] == "processing"


@pytest.mark.asyncio
async def test_get_analysis_result(test_client, authenticated_user, mock_processor):
    """Test getting analysis results"""
    result_id = str(uuid.uuid4())
    
    # Mock the query_db function to return a result
    with mock.patch("app.database.query_db") as mock_query:
        mock_query.return_value = [{
            "id": result_id,
            "user_id": str(authenticated_user["user"].id),  # Use .id to access the user ID
            "analysis_type": "matrix_structure",
            "created_at": "2025-04-21T12:00:00",
            "metadata": json.dumps({
                "original_filename": "test_matrix.mtx",
                "file_size": 1024,
                "file_type": ".mtx",
                "content_type": "text/plain"
            }),
            "result_type": "table",
            "storage_type": "database",
            "result_location": None,
            "small_result": json.dumps({
                "data_type": "numeric",
                "num_rows": 3,
                "num_columns": 3,
                "file_type": ".mtx",
                "has_header_row": False,
                "has_header_column": False
            }),
            "large_result_blob_id": None
        }]
        
        # Get analysis result
        response = await test_client.get(
            f"/bioflow/analysis/result/{result_id}",
            headers={"Authorization": f"Bearer {authenticated_user['access_token']}"}
        )
        
        # Check response
        assert response.status_code == 200
        result_data = response.json()
        assert result_data["id"] == result_id
        assert result_data["analysis_type"] == "matrix_structure"
        assert result_data["result_type"] == "table"
        assert "small_result" in result_data


@pytest.mark.asyncio
async def test_database_schema_bioflow_tables(db_session):
    """Test that the bioflow-related database tables were created correctly"""
    from sqlalchemy import text
    
    # Query to check if tables exist
    tables_query = text("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'uploaded_files'
    ) as uploaded_files_exists,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'analysis_jobs'
    ) as analysis_jobs_exists,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'analysis_results'
    ) as analysis_results_exists
    """)
    
    # Execute query
    result = await db_session.execute(tables_query)
    tables = result.fetchone()
    
    # Check that all tables exist
    assert tables.uploaded_files_exists, "uploaded_files table should exist"
    assert tables.analysis_jobs_exists, "analysis_jobs table should exist"
    assert tables.analysis_results_exists, "analysis_results table should exist"
    
    # Now check column structure of uploaded_files table
    columns_query = text("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'uploaded_files'
    """)
    result = await db_session.execute(columns_query)
    columns = {row.column_name: row.data_type for row in result.fetchall()}
    
    # Verify key columns exist with correct types
    assert "id" in columns
    assert "user_id" in columns
    assert "original_name" in columns
    assert "content_type" in columns
    assert "is_bioinformatics_file" in columns