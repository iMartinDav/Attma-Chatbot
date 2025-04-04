"""
Integration tests for the bioflow module and FastAPI.
"""

import os
import tempfile
import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from fastapi import FastAPI

from ...app.main import app
from ...bioflow.biodata import MatrixStructure, BioinformaticsProcessor


@pytest.fixture
def api_client():
    """Fixture for creating a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def test_matrix_file():
    """Create a test matrix file."""
    content = """gene\tcell1\tcell2\tcell3
GATA1\t1.2\t0.0\t0.5
BCL11A\t0.0\t2.3\t1.1
MYB\t3.4\t0.0\t0.0
"""
    fd, path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        f.write(content)
    
    yield path
    
    # Cleanup
    if os.path.exists(path):
        os.unlink(path)


def test_direct_api_access(test_matrix_file):
    """Test direct Python API access to bioflow functionality."""
    matrix = MatrixStructure(test_matrix_file)
    
    assert matrix.data_type == "matrix"
    assert matrix.delimiter == "\t"
    assert matrix.has_header_row
    assert matrix.has_header_column
    assert matrix.num_rows == 3
    assert matrix.num_columns == 3
    assert matrix.column_names == ["cell1", "cell2", "cell3"]


def test_api_upload_and_analyze(api_client, test_matrix_file):
    """Test uploading and analyzing a matrix file through the API."""
    # Upload file
    with open(test_matrix_file, "rb") as f:
        response = api_client.post(
            "/bioflow/upload/",
            files={"file": ("matrix.tsv", f, "text/plain")}
        )
    
    assert response.status_code == 200
    file_id = response.json()["file_id"]
    
    # Analyze the uploaded file
    response = api_client.post(
        "/bioflow/analyze/",
        json={"file_id": file_id}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["data_type"] == "matrix"
    assert data["delimiter"] == "\t"
    assert data["has_header_row"] is True
    assert data["has_header_column"] is True
    assert data["num_rows"] == 3
    assert data["num_columns"] == 3
    assert data["column_names_sample"] == ["cell1", "cell2", "cell3"]


def test_workflow_list(api_client):
    """Test listing available workflows."""
    response = api_client.get("/bioflow/workflows/")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "workflows" in data
    assert isinstance(data["workflows"], list)
    # Check if our built-in workflows are available
    assert "count_matrix" in data["workflows"]
    assert "normalize_matrix" in data["workflows"] 