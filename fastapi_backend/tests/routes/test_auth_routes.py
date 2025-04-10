"""
Tests for the extended authentication routes.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from fastapi import FastAPI

from app.users import UnifiedUserManager
from app.models import User
from app.schemas import UserCreate, PasswordResetCreate, PasswordResetConfirm

# Create a simple mock user for testing
async def mock_get_user_by_email(email):
    """Mock implementation of get_user_by_email for testing."""
    if email == "existing@example.com":
        return {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "email": "existing@example.com",
            "password": "hashed_password"
        }
    return None

# Patch the necessary dependencies
@pytest.mark.asyncio
@patch("app.drizzle.get_user_by_email", mock_get_user_by_email)
@patch("app.drizzle.query", AsyncMock(return_value=[{"id": "user123", "email": "user@example.com"}]))
@patch("app.drizzle.execute", AsyncMock(return_value="OK"))
@patch.object(UnifiedUserManager, "create", AsyncMock())
@patch.object(UnifiedUserManager, "authenticate", AsyncMock())
@patch.object(UnifiedUserManager, "forgot_password", AsyncMock(return_value="mock_token"))
@patch.object(UnifiedUserManager, "reset_password", AsyncMock())
async def test_register_user(app: FastAPI, test_client: AsyncClient):
    """Test user registration."""
    # Setup mock for user creation
    mock_user = User(
        id=uuid.uuid4(),
        email="new@example.com",
        hashed_password="hashed_password",
        is_active=True,
        is_verified=False,
        is_superuser=False
    )
    UnifiedUserManager.create.return_value = mock_user

    # Register a new user
    response = await test_client.post(
        "/auth/extended/register",
        json={"email": "new@example.com", "password": "StrongPassword1!"}
    )
    
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"
    assert UnifiedUserManager.create.called

@pytest.mark.asyncio
@patch("app.drizzle.get_user_by_email", mock_get_user_by_email)
@patch("app.drizzle.execute", AsyncMock(return_value="OK"))
@patch.object(UnifiedUserManager, "reset_password", AsyncMock())
async def test_reset_password(app: FastAPI, test_client: AsyncClient):
    """Test password reset."""
    # Reset password with valid token
    response = await test_client.post(
        "/auth/extended/reset-password",
        json={"token": "valid_token", "password": "NewStrongPassword1!"}
    )
    
    assert response.status_code == 200
    assert response.json()["detail"] == "Password has been reset successfully."
    assert UnifiedUserManager.reset_password.called

@pytest.mark.asyncio
@patch("app.drizzle.get_user_by_email", mock_get_user_by_email)
@patch("app.users.get_user_by_email", mock_get_user_by_email)
@patch("app.drizzle.query", AsyncMock(return_value=[{"id": "user123", "email": "existing@example.com"}]))
@patch("app.drizzle.execute", AsyncMock(return_value="OK"))
@patch.object(UnifiedUserManager, "get_by_email", AsyncMock())
@patch.object(UnifiedUserManager, "forgot_password", AsyncMock(return_value="mock_token"))
@patch.object(UnifiedUserManager, "on_after_forgot_password", AsyncMock())
async def test_forgot_password(app: FastAPI, test_client: AsyncClient):
    """Test forgot password flow."""
    # Setup mock for the user
    mock_user = User(
        id=uuid.uuid4(),
        email="existing@example.com",
        hashed_password="hashed_password",
        is_active=True,
        is_verified=True,
        is_superuser=False
    )
    UnifiedUserManager.get_by_email.return_value = mock_user

    # Request password reset
    response = await test_client.post(
        "/auth/extended/forgot-password",
        json={"email": "existing@example.com"}
    )
    
    assert response.status_code == 202
    assert "detail" in response.json()
    assert UnifiedUserManager.forgot_password.called
    assert UnifiedUserManager.on_after_forgot_password.called

@pytest.mark.asyncio
@patch("app.drizzle.get_user_by_email", mock_get_user_by_email)
@patch("app.drizzle.query", AsyncMock(return_value=[{"id": "user123", "email": "existing@example.com"}]))
@patch("app.drizzle.execute", AsyncMock(return_value="OK"))
async def test_sync_user(app: FastAPI, test_client: AsyncClient, authenticated_client: AsyncClient):
    """Test user database synchronization (requires authentication)."""
    # Try to sync without authentication should fail
    response = await test_client.post("/auth/extended/sync-user")
    assert response.status_code in (401, 403)  # Either unauthorized or forbidden
    
    # Try to sync with authentication should succeed
    # This assumes authenticated_client fixture is available and working
    response = await authenticated_client.post("/auth/extended/sync-user")
    assert response.status_code == 200
    assert "detail" in response.json()
    assert "user" in response.json()