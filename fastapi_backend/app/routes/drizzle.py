"""
Routes for interacting with the Drizzle-managed database.

These routes provide direct access to data in the frontend's PostgreSQL database
through the backend's Drizzle connection layer.
"""
from typing import Dict, List, Any, Optional
from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from pydantic import BaseModel

from ..drizzle import query, execute, get_user_by_email
from ..users import current_active_user, User
from ..schemas import (
    ApiResponse, 
    DrizzleUser, 
    Chat, 
    ChatCreate, 
    ChatUpdate,
    Message, 
    MessageCreate,
    ChatWithMessages
)

# Get logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drizzle", tags=["drizzle"])


@router.get("/users/me", response_model=ApiResponse)
async def get_current_user(user: User = Depends(current_active_user)):
    """
    Get the current user's data from the Drizzle database.
    
    Args:
        user: The authenticated user
        
    Returns:
        ApiResponse: User data from the Drizzle database
    """
    try:
        drizzle_user = await get_user_by_email(user.email)
        if not drizzle_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="User not found in Drizzle database"
            )
        
        return ApiResponse(success=True, data=DrizzleUser(**drizzle_user))
    except Exception as e:
        logger.error(f"Error fetching current user: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.get("/users/{user_id}", response_model=ApiResponse)
async def get_user_by_id(
    user_id: UUID = Path(..., title="The ID of the user to get"),
    current_user: User = Depends(current_active_user)
):
    """
    Get a user by ID from the Drizzle database.
    Only accessible to authenticated users.
    
    Args:
        user_id: The user ID to look up
        current_user: The authenticated user making the request
        
    Returns:
        ApiResponse: User data from the Drizzle database
    """
    try:
        sql = 'SELECT * FROM "User" WHERE "id" = $1'
        results = await query(sql, str(user_id))
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="User not found"
            )
        
        return ApiResponse(success=True, data=DrizzleUser(**results[0]))
    except HTTPException as e:
        return ApiResponse(success=False, error=e.detail)
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.get("/chats", response_model=ApiResponse)
async def get_chats(
    limit: int = Query(20, ge=1, le=100, description="Maximum number of chats to return"),
    offset: int = Query(0, ge=0, description="Number of chats to skip"),
    user: User = Depends(current_active_user)
):
    """
    Get all chats for the current user from the Drizzle database.
    
    Args:
        limit: Maximum number of chats to return
        offset: Number of chats to skip
        user: The authenticated user
        
    Returns:
        ApiResponse: List of chats from the Drizzle database
    """
    try:
        sql = '''
            SELECT * FROM "Chat" 
            WHERE "userId" = $1 
            ORDER BY "createdAt" DESC
            LIMIT $2 OFFSET $3
        '''
        results = await query(sql, str(user.id), limit, offset)
        
        # Get total count for pagination
        count_sql = 'SELECT COUNT(*) as total FROM "Chat" WHERE "userId" = $1'
        count_results = await query(count_sql, str(user.id))
        total = count_results[0]['total'] if count_results else 0
        
        # Convert to Chat models
        chats = [Chat.model_validate(chat) for chat in results]
        
        return ApiResponse(
            success=True, 
            data=chats,
            meta={
                "total": total,
                "limit": limit,
                "offset": offset
            }
        )
    except Exception as e:
        logger.error(f"Error fetching chats for user {user.id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.post("/chats", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    chat_data: ChatCreate,
    user: User = Depends(current_active_user)
):
    """
    Create a new chat in the Drizzle database.
    
    Args:
        chat_data: Chat creation data
        user: The authenticated user
        
    Returns:
        ApiResponse: Created chat data
    """
    try:
        # Generate a new UUID
        chat_id = str(UUID(int=0).int)  # Generate a proper UUID in real code
        
        sql = '''
            INSERT INTO "Chat" ("id", "userId", "title", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING *
        '''
        results = await query(sql, chat_id, str(user.id), chat_data.title)
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create chat"
            )
            
        return ApiResponse(success=True, data=Chat.model_validate(results[0]))
    except Exception as e:
        logger.error(f"Error creating chat for user {user.id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.get("/chats/{chat_id}", response_model=ApiResponse)
async def get_chat(
    chat_id: UUID = Path(..., title="The ID of the chat to get"),
    user: User = Depends(current_active_user)
):
    """
    Get a specific chat by ID from the Drizzle database.
    
    Args:
        chat_id: The chat ID to look up
        user: The authenticated user
        
    Returns:
        ApiResponse: Chat data from the Drizzle database
    """
    try:
        sql = 'SELECT * FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
        results = await query(sql, str(chat_id), str(user.id))
        
        if not results:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
        
        return ApiResponse(success=True, data=Chat.model_validate(results[0]))
    except HTTPException as e:
        return ApiResponse(success=False, error=e.detail)
    except Exception as e:
        logger.error(f"Error fetching chat {chat_id} for user {user.id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.patch("/chats/{chat_id}", response_model=ApiResponse)
async def update_chat(
    chat_data: ChatUpdate,
    chat_id: UUID = Path(..., title="The ID of the chat to update"),
    user: User = Depends(current_active_user)
):
    """
    Update a specific chat by ID in the Drizzle database.
    
    Args:
        chat_data: Chat update data
        chat_id: The chat ID to update
        user: The authenticated user
        
    Returns:
        ApiResponse: Updated chat data
    """
    try:
        # First verify the chat exists and belongs to the user
        check_sql = 'SELECT * FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
        check_results = await query(check_sql, str(chat_id), str(user.id))
        
        if not check_results:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
        
        # Update the chat
        update_sql = '''
            UPDATE "Chat" 
            SET "title" = $3, "updatedAt" = NOW()
            WHERE "id" = $1 AND "userId" = $2
            RETURNING *
        '''
        update_results = await query(
            update_sql, 
            str(chat_id), 
            str(user.id), 
            chat_data.title
        )
        
        return ApiResponse(success=True, data=Chat.model_validate(update_results[0]))
    except HTTPException as e:
        return ApiResponse(success=False, error=e.detail)
    except Exception as e:
        logger.error(f"Error updating chat {chat_id} for user {user.id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.delete("/chats/{chat_id}", response_model=ApiResponse)
async def delete_chat(
    chat_id: UUID = Path(..., title="The ID of the chat to delete"),
    user: User = Depends(current_active_user)
):
    """
    Delete a specific chat by ID from the Drizzle database.
    
    Args:
        chat_id: The chat ID to delete
        user: The authenticated user
        
    Returns:
        ApiResponse: Success status
    """
    try:
        # First verify the chat exists and belongs to the user
        check_sql = 'SELECT * FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
        check_results = await query(check_sql, str(chat_id), str(user.id))
        
        if not check_results:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
        
        # Delete all messages first (cascade delete not always reliable across APIs)
        delete_messages_sql = 'DELETE FROM "Message" WHERE "chatId" = $1'
        await execute(delete_messages_sql, str(chat_id))
        
        # Delete the chat
        delete_chat_sql = 'DELETE FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
        await execute(delete_chat_sql, str(chat_id), str(user.id))
        
        return ApiResponse(success=True, data={"message": "Chat deleted successfully"})
    except HTTPException as e:
        return ApiResponse(success=False, error=e.detail)
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id} for user {user.id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.get("/chats/{chat_id}/messages", response_model=ApiResponse)
async def get_chat_messages(
    chat_id: UUID = Path(..., title="The ID of the chat to get messages for"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of messages to return"),
    offset: int = Query(0, ge=0, description="Number of messages to skip"),
    user: User = Depends(current_active_user)
):
    """
    Get all messages for a specific chat from the Drizzle database.
    
    Args:
        chat_id: The chat ID to get messages for
        limit: Maximum number of messages to return
        offset: Number of messages to skip
        user: The authenticated user
        
    Returns:
        ApiResponse: List of messages from the Drizzle database
    """
    try:
        # First verify that the chat belongs to the user
        chat_sql = 'SELECT "id" FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
        chat_results = await query(chat_sql, str(chat_id), str(user.id))
        
        if not chat_results:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
        
        # Fetch the messages with pagination
        msg_sql = '''
            SELECT * FROM "Message" 
            WHERE "chatId" = $1 AND "isDeleted" = false
            ORDER BY "createdAt" ASC
            LIMIT $2 OFFSET $3
        '''
        msg_results = await query(msg_sql, str(chat_id), limit, offset)
        
        # Get total count for pagination
        count_sql = 'SELECT COUNT(*) as total FROM "Message" WHERE "chatId" = $1 AND "isDeleted" = false'
        count_results = await query(count_sql, str(chat_id))
        total = count_results[0]['total'] if count_results else 0
        
        # Convert to Message models
        messages = [Message.model_validate(msg) for msg in msg_results]
        
        return ApiResponse(
            success=True, 
            data=messages,
            meta={
                "total": total,
                "limit": limit,
                "offset": offset
            }
        )
    except HTTPException as e:
        return ApiResponse(success=False, error=e.detail)
    except Exception as e:
        logger.error(f"Error fetching messages for chat {chat_id}, user {user.id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))


@router.post("/chats/{chat_id}/messages", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    message_data: MessageCreate,
    chat_id: UUID = Path(..., title="The ID of the chat to add a message to"),
    user: User = Depends(current_active_user)
):
    """
    Create a new message in a specific chat.
    
    Args:
        message_data: Message creation data
        chat_id: The chat ID to add the message to
        user: The authenticated user
        
    Returns:
        ApiResponse: Created message data
    """
    try:
        # First verify that the chat belongs to the user
        chat_sql = 'SELECT "id" FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
        chat_results = await query(chat_sql, str(chat_id), str(user.id))
        
        if not chat_results:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
        
        # Verify that the message's chatId matches the URL chatId
        if str(chat_id) != message_data.chatId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message chatId does not match URL chat_id"
            )
        
        # Generate a new UUID for the message
        message_id = str(UUID(int=0).int)  # Generate a proper UUID in real code
        
        # Insert the message
        msg_sql = '''
            INSERT INTO "Message" ("id", "chatId", "content", "role", "createdAt", "updatedAt", "isDeleted")
            VALUES ($1, $2, $3, $4, NOW(), NOW(), false)
            RETURNING *
        '''
        msg_results = await query(
            msg_sql,
            message_id,
            str(chat_id),
            message_data.content,
            message_data.role
        )
        
        if not msg_results:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create message"
            )
        
        # Update the chat's lastMessageAt timestamp
        update_chat_sql = '''
            UPDATE "Chat"
            SET "lastMessageAt" = NOW(), "updatedAt" = NOW()
            WHERE "id" = $1
        '''
        await execute(update_chat_sql, str(chat_id))
        
        return ApiResponse(success=True, data=Message.model_validate(msg_results[0]))
    except HTTPException as e:
        return ApiResponse(success=False, error=e.detail)
    except Exception as e:
        logger.error(f"Error creating message in chat {chat_id} for user {user.id}: {str(e)}")
        return ApiResponse(success=False, error=str(e))