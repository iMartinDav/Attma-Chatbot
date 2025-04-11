"""
Tests for the Drizzle API endpoints.
"""
import pytest
from unittest.mock import AsyncMock, patch
import uuid
from fastapi import status

from app.models import User


@pytest.mark.asyncio
async def test_get_current_user(authenticated_drizzle_user, test_client, drizzle_transaction):
    """Test getting current user from Drizzle database."""
    # Mock the get_user_by_email function
    with patch("app.routes.drizzle.get_user_by_email", new=AsyncMock()) as mock_get_user:
        mock_get_user.return_value = {
            "id": str(authenticated_drizzle_user["user_id"]),
            "email": authenticated_drizzle_user["email"],
            "name": "Test User",
            "image": None
        }
        
        # Make the request
        response = await test_client.get(
            "/drizzle/users/me", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == authenticated_drizzle_user["email"]
        assert data["name"] == "Test User"
        assert data["image"] is None
        
        # Verify the function was called with the right parameters
        mock_get_user.assert_called_once_with(authenticated_drizzle_user["email"])


@pytest.mark.asyncio
async def test_get_current_user_not_found(authenticated_drizzle_user, test_client):
    """Test getting current user when not in Drizzle database."""
    # Mock the get_user_by_email function to return None
    with patch("app.routes.drizzle.get_user_by_email", new=AsyncMock(return_value=None)) as mock_get_user:
        # Make the request
        response = await test_client.get(
            "/drizzle/users/me", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "User not found" in data["detail"]


@pytest.mark.asyncio
async def test_get_user_by_id(authenticated_drizzle_user, test_client):
    """Test getting a user by ID from Drizzle database."""
    user_id = uuid.uuid4()
    
    # Mock the query function
    with patch("app.routes.drizzle.query", new=AsyncMock()) as mock_query:
        mock_query.return_value = [{
            "id": str(user_id),
            "email": "other@example.com",
            "name": "Other User",
            "image": None
        }]
        
        # Make the request
        response = await test_client.get(
            f"/drizzle/users/{user_id}", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == "other@example.com"
        assert data["name"] == "Other User"
        
        # Verify the query was called with the right parameters
        mock_query.assert_called_once()
        args = mock_query.call_args[0]
        assert 'SELECT * FROM "User"' in args[0]
        assert args[1] == str(user_id)


@pytest.mark.asyncio
async def test_get_user_by_id_not_found(authenticated_drizzle_user, test_client):
    """Test getting a non-existent user by ID."""
    user_id = uuid.uuid4()
    
    # Mock the query function to return an empty list
    with patch("app.routes.drizzle.query", new=AsyncMock(return_value=[])) as mock_query:
        # Make the request
        response = await test_client.get(
            f"/drizzle/users/{user_id}", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "User not found" in data["detail"]


@pytest.mark.asyncio
async def test_get_chats(authenticated_drizzle_user, test_client):
    """Test getting all chats for the current user."""
    # Mock the query function
    with patch("app.routes.drizzle.query", new=AsyncMock()) as mock_query:
        mock_query.return_value = [
            {
                "id": str(uuid.uuid4()),
                "title": "Chat 1",
                "userId": str(authenticated_drizzle_user["user_id"]),
                "createdAt": "2025-04-10T12:00:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Chat 2",
                "userId": str(authenticated_drizzle_user["user_id"]),
                "createdAt": "2025-04-11T12:00:00Z"
            }
        ]
        
        # Make the request
        response = await test_client.get(
            "/drizzle/chats", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["title"] == "Chat 1"
        assert data[1]["title"] == "Chat 2"
        
        # Verify the query was called with the right parameters
        mock_query.assert_called_once()
        args = mock_query.call_args[0]
        assert 'SELECT * FROM "Chat"' in args[0]
        assert args[1] == str(authenticated_drizzle_user["user_id"])


@pytest.mark.asyncio
async def test_get_chat(authenticated_drizzle_user, test_client):
    """Test getting a specific chat by ID."""
    chat_id = uuid.uuid4()
    
    # Mock the query function
    with patch("app.routes.drizzle.query", new=AsyncMock()) as mock_query:
        mock_query.return_value = [{
            "id": str(chat_id),
            "title": "Test Chat",
            "userId": str(authenticated_drizzle_user["user_id"]),
            "createdAt": "2025-04-11T12:00:00Z"
        }]
        
        # Make the request
        response = await test_client.get(
            f"/drizzle/chats/{chat_id}", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "Test Chat"
        assert data["id"] == str(chat_id)
        
        # Verify the query was called with the right parameters
        mock_query.assert_called_once()
        args = mock_query.call_args[0]
        assert 'SELECT * FROM "Chat"' in args[0]
        assert args[1] == str(chat_id)
        assert args[2] == str(authenticated_drizzle_user["user_id"])


@pytest.mark.asyncio
async def test_get_chat_not_found(authenticated_drizzle_user, test_client):
    """Test getting a non-existent chat."""
    chat_id = uuid.uuid4()
    
    # Mock the query function to return an empty list
    with patch("app.routes.drizzle.query", new=AsyncMock(return_value=[])) as mock_query:
        # Make the request
        response = await test_client.get(
            f"/drizzle/chats/{chat_id}", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "Chat not found" in data["detail"]


@pytest.mark.asyncio
async def test_get_chat_messages(authenticated_drizzle_user, test_client):
    """Test getting all messages for a specific chat."""
    chat_id = uuid.uuid4()
    
    # Mock the query function
    with patch("app.routes.drizzle.query", new=AsyncMock()) as mock_query:
        # First query returns the chat
        # Second query returns the messages
        mock_query.side_effect = [
            [{"id": str(chat_id)}],  # Chat exists
            [
                {
                    "id": str(uuid.uuid4()),
                    "content": "Message 1",
                    "chatId": str(chat_id),
                    "createdAt": "2025-04-11T12:00:00Z"
                },
                {
                    "id": str(uuid.uuid4()),
                    "content": "Message 2",
                    "chatId": str(chat_id),
                    "createdAt": "2025-04-11T12:05:00Z"
                }
            ]
        ]
        
        # Make the request
        response = await test_client.get(
            f"/drizzle/chats/{chat_id}/messages", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["content"] == "Message 1"
        assert data[1]["content"] == "Message 2"
        
        # Verify the queries were called with the right parameters
        assert mock_query.call_count == 2
        
        # First call should verify the chat exists and belongs to the user
        chat_args = mock_query.call_args_list[0][0]
        assert 'SELECT "id" FROM "Chat"' in chat_args[0]
        assert chat_args[1] == str(chat_id)
        assert chat_args[2] == str(authenticated_drizzle_user["user_id"])
        
        # Second call should get the messages
        msg_args = mock_query.call_args_list[1][0]
        assert 'SELECT * FROM "Message"' in msg_args[0]
        assert msg_args[1] == str(chat_id)


@pytest.mark.asyncio
async def test_get_chat_messages_chat_not_found(authenticated_drizzle_user, test_client):
    """Test getting messages for a non-existent chat."""
    chat_id = uuid.uuid4()
    
    # Mock the query function to return an empty list for the chat
    with patch("app.routes.drizzle.query", new=AsyncMock(return_value=[])) as mock_query:
        # Make the request
        response = await test_client.get(
            f"/drizzle/chats/{chat_id}/messages", 
            headers=authenticated_drizzle_user["headers"]
        )
        
        # Verify the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "Chat not found" in data["detail"]