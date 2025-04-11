import uuid
from typing import Optional
from datetime import datetime

from fastapi_users import schemas
from pydantic import BaseModel, EmailStr, Field, UUID4
from uuid import UUID


class UserRead(BaseModel):
    """Schema for user data returned to clients."""
    id: UUID4
    email: EmailStr
    is_active: bool
    is_superuser: bool
    is_verified: bool


class UserCreate(BaseModel):
    """Schema for user creation."""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for user updates."""
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    is_verified: Optional[bool] = None


class PasswordResetCreate(BaseModel):
    """Schema for password reset request."""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for confirming password reset."""
    token: str
    password: str


class ItemBase(BaseModel):
    name: str
    description: str | None = None
    quantity: int | None = None


class ItemCreate(ItemBase):
    pass


class ItemRead(ItemBase):
    id: UUID
    user_id: UUID

    model_config = {"from_attributes": True}


# Drizzle schema types for Next.js frontend integration

class UserTable(BaseModel):
    """Schema representing a User in the Drizzle database."""
    id: str = Field(..., description="UUID primary key")
    email: str = Field(..., description="User email address")
    password: Optional[str] = Field(None, description="Hashed password")
    name: Optional[str] = Field(None, description="User name")
    image: Optional[str] = Field(None, description="User profile image URL")
    emailVerified: Optional[datetime] = Field(None, description="When email was verified")
    createdAt: datetime = Field(..., description="When user was created")
    updatedAt: datetime = Field(..., description="When user was last updated")
    lastLogin: Optional[datetime] = Field(None, description="When user last logged in")


class PasswordResetTable(BaseModel):
    """Schema representing a password reset token in the Drizzle database."""
    id: str = Field(..., description="UUID primary key")
    userId: str = Field(..., description="User ID reference")
    token: str = Field(..., description="Reset token")
    expiresAt: datetime = Field(..., description="Token expiration")
    createdAt: datetime = Field(..., description="When token was created")


class SessionTable(BaseModel):
    """Schema representing a user session in the Drizzle database."""
    id: str = Field(..., description="UUID primary key")
    userId: str = Field(..., description="User ID reference")
    expiresAt: datetime = Field(..., description="Session expiration")
    createdAt: datetime = Field(..., description="When session was created")


class AccountTable(BaseModel):
    """Schema representing an OAuth account in the Drizzle database."""
    id: str = Field(..., description="UUID primary key")
    userId: str = Field(..., description="User ID reference")
    type: str = Field(..., description="Account type (e.g., 'oauth')")
    provider: str = Field(..., description="Provider name")
    providerAccountId: str = Field(..., description="Provider's account ID")
    refreshToken: Optional[str] = Field(None, description="OAuth refresh token")
    accessToken: Optional[str] = Field(None, description="OAuth access token")
    expiresAt: Optional[int] = Field(None, description="Token expiration timestamp")
    tokenType: Optional[str] = Field(None, description="Token type")
    scope: Optional[str] = Field(None, description="OAuth scope")
    idToken: Optional[str] = Field(None, description="OAuth ID token")
    sessionState: Optional[str] = Field(None, description="Session state")


class ChatTable(BaseModel):
    """Schema representing a chat in the Drizzle database."""
    id: str = Field(..., description="UUID primary key")
    userId: str = Field(..., description="User ID reference")
    title: str = Field(..., description="Chat title")
    createdAt: datetime = Field(..., description="When chat was created")
    updatedAt: datetime = Field(..., description="When chat was last updated")
    lastMessageAt: Optional[datetime] = Field(None, description="When last message was sent")


class MessageTable(BaseModel):
    """Schema representing a message in the Drizzle database."""
    id: str = Field(..., description="UUID primary key")
    chatId: str = Field(..., description="Chat ID reference")
    content: str = Field(..., description="Message content")
    role: str = Field(..., description="Message role (user/assistant)")
    createdAt: datetime = Field(..., description="When message was created")
    updatedAt: datetime = Field(..., description="When message was last updated")
    isDeleted: bool = Field(False, description="Whether message is deleted")


from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, HttpUrl, ConfigDict

# New schemas for Drizzle API
class DrizzleUserBase(BaseModel):
    """Base schema for a user in the Drizzle database."""
    email: EmailStr
    name: Optional[str] = None
    image: Optional[str] = None

class DrizzleUserCreate(DrizzleUserBase):
    """Schema for creating a user in the Drizzle database."""
    password: str


class DrizzleUserUpdate(DrizzleUserBase):
    """Schema for updating a user in the Drizzle database."""
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class DrizzleUser(DrizzleUserBase):
    """Schema for a user in the Drizzle database."""
    id: str
    
    model_config = ConfigDict(from_attributes=True)


class ChatBase(BaseModel):
    """Base schema for a chat."""
    title: str


class ChatCreate(ChatBase):
    """Schema for creating a chat."""
    pass


class ChatUpdate(BaseModel):
    """Schema for updating a chat."""
    title: Optional[str] = None


class Chat(ChatBase):
    """Schema for a chat."""
    id: str
    userId: str
    createdAt: datetime
    updatedAt: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class MessageBase(BaseModel):
    """Base schema for a message."""
    content: str
    role: str = Field(default="user")


class MessageCreate(MessageBase):
    """Schema for creating a message."""
    chatId: str


class Message(MessageBase):
    """Schema for a message."""
    id: str
    chatId: str
    createdAt: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ChatWithMessages(Chat):
    """Schema for a chat with messages."""
    messages: List[Message] = []


class ApiResponse(BaseModel):
    """Schema for a standardized API response."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
