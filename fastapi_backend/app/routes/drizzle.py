"""
Routes for interacting with the Drizzle-managed database.

These routes provide direct access to data in the frontend's PostgreSQL database
through the backend's Drizzle connection layer.
"""
from typing import Dict, List, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..drizzle import query, execute, get_user_by_email
from ..users import current_active_user, User


router = APIRouter(prefix="/drizzle", tags=["drizzle"])


class DrizzleUser(BaseModel):
    """Schema for a user in the Drizzle database."""
    id: str
    email: str
    name: str = None
    image: str = None


@router.get("/users/me", response_model=DrizzleUser)
async def get_current_user(user: User = Depends(current_active_user)):
    """
    Get the current user's data from the Drizzle database.
    
    Args:
        user: The authenticated user
        
    Returns:
        DrizzleUser: User data from the Drizzle database
    """
    drizzle_user = await get_user_by_email(user.email)
    if not drizzle_user:
        raise HTTPException(status_code=404, detail="User not found in Drizzle database")
    
    return DrizzleUser(**drizzle_user)


@router.get("/users/{user_id}", response_model=DrizzleUser)
async def get_user_by_id(
    user_id: UUID,
    current_user: User = Depends(current_active_user)
):
    """
    Get a user by ID from the Drizzle database.
    Only accessible to authenticated users.
    
    Args:
        user_id: The user ID to look up
        current_user: The authenticated user making the request
        
    Returns:
        DrizzleUser: User data from the Drizzle database
    """
    sql = 'SELECT * FROM "User" WHERE "id" = $1'
    results = await query(sql, str(user_id))
    
    if not results:
        raise HTTPException(status_code=404, detail="User not found")
    
    return DrizzleUser(**results[0])


@router.get("/chats", response_model=List[Dict[str, Any]])
async def get_chats(user: User = Depends(current_active_user)):
    """
    Get all chats for the current user from the Drizzle database.
    
    Args:
        user: The authenticated user
        
    Returns:
        List[Dict[str, Any]]: List of chats from the Drizzle database
    """
    sql = 'SELECT * FROM "Chat" WHERE "userId" = $1 ORDER BY "createdAt" DESC'
    results = await query(sql, str(user.id))
    
    return results


@router.get("/chats/{chat_id}", response_model=Dict[str, Any])
async def get_chat(
    chat_id: UUID, 
    user: User = Depends(current_active_user)
):
    """
    Get a specific chat by ID from the Drizzle database.
    
    Args:
        chat_id: The chat ID to look up
        user: The authenticated user
        
    Returns:
        Dict[str, Any]: Chat data from the Drizzle database
    """
    sql = 'SELECT * FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
    results = await query(sql, str(chat_id), str(user.id))
    
    if not results:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return results[0]


@router.get("/chats/{chat_id}/messages", response_model=List[Dict[str, Any]])
async def get_chat_messages(
    chat_id: UUID, 
    user: User = Depends(current_active_user)
):
    """
    Get all messages for a specific chat from the Drizzle database.
    
    Args:
        chat_id: The chat ID to get messages for
        user: The authenticated user
        
    Returns:
        List[Dict[str, Any]]: List of messages from the Drizzle database
    """
    # First verify that the chat belongs to the user
    chat_sql = 'SELECT "id" FROM "Chat" WHERE "id" = $1 AND "userId" = $2'
    chat_results = await query(chat_sql, str(chat_id), str(user.id))
    
    if not chat_results:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Fetch the messages
    msg_sql = 'SELECT * FROM "Message" WHERE "chatId" = $1 ORDER BY "createdAt" ASC'
    msg_results = await query(msg_sql, str(chat_id))
    
    return msg_results