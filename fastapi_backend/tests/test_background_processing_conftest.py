"""
Simplified conftest module for background processing tests.

This module provides test fixtures specifically for testing the background 
processing system without dependencies on other complex fixtures.
"""
import pytest
import pytest_asyncio
import uuid
from unittest.mock import patch, MagicMock
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def mock_user():
    """Mock user for tests."""
    class MockUser:
        def __init__(self):
            self.id = uuid.uuid4()
            self.email = "test@example.com"
            self.is_active = True
    
    return MockUser()


@pytest.fixture
def mock_app():
    """Mock FastAPI app."""
    return FastAPI()


@pytest.fixture
def test_client(mock_app):
    """Test client for FastAPI."""
    return TestClient(mock_app)


@pytest.fixture
def access_token():
    """Mock access token."""
    return "test_access_token"


@pytest.fixture
def authenticated_headers(access_token):
    """Authentication headers."""
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def authenticated_user(mock_user, access_token):
    """Authenticated user with access token."""
    return {
        "user": mock_user,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"}
    }