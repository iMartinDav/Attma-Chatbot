"""
Enhanced authentication routes that integrate with both SQLAlchemy and Drizzle.

These routes extend the standard FastAPI Users authentication system with
additional functionality for working with the Drizzle database.
"""
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr

from ..users import (
    UnifiedUserManager, 
    get_user_manager, 
    auth_backend, 
    fastapi_users,
    current_active_user,
)
from ..models import User
from ..schemas import (
    UserRead, 
    UserCreate, 
    UserUpdate, 
    PasswordResetCreate, 
    PasswordResetConfirm,
)
from ..drizzle import execute, query, get_user_by_email

router = APIRouter(prefix="/auth/extended", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
async def register_user(
    user_create: UserCreate,
    user_manager: UnifiedUserManager = Depends(get_user_manager),
    request: Request = None,
):
    """
    Register a new user in both SQLAlchemy and Drizzle databases.
    
    Args:
        user_create: User creation data
        user_manager: User manager dependency
        request: Request object
    
    Returns:
        UserRead: The created user data
    """
    user = await user_manager.create(user_create, safe=True, request=request)
    return UserRead.model_validate(user)


@router.post("/forgot-password", status_code=202)
async def forgot_password(
    body: PasswordResetCreate,
    user_manager: UnifiedUserManager = Depends(get_user_manager),
    request: Request = None,
):
    """
    Request a password reset for a user.
    
    Args:
        body: Email for password reset
        user_manager: User manager dependency
        request: Request object
    """
    email = body.email
    user = await user_manager.get_by_email(email)
    
    if user is not None and user.is_active:
        token = await user_manager.forgot_password(user, request)
        await user_manager.on_after_forgot_password(user, token, request)
    
    # Always return 202 to prevent email enumeration
    return {"detail": "If the email exists, a password reset token has been sent."}


@router.post("/reset-password")
async def reset_password(
    body: PasswordResetConfirm,
    user_manager: UnifiedUserManager = Depends(get_user_manager),
    request: Request = None,
):
    """
    Reset a user's password using a token.
    
    Args:
        body: Password reset token and new password
        user_manager: User manager dependency
        request: Request object
    """
    await user_manager.reset_password(body.token, body.password, request)
    return {"detail": "Password has been reset successfully."}


@router.post("/sync-user")
async def sync_user_databases(
    user: User = Depends(current_active_user),
    user_manager: UnifiedUserManager = Depends(get_user_manager),
):
    """
    Manually synchronize a user between SQLAlchemy and Drizzle databases.
    
    Args:
        user: Current user
        user_manager: User manager dependency
    """
    # Sync SQLAlchemy -> Drizzle
    drizzle_user = await get_user_by_email(user.email)
    
    if drizzle_user:
        # Update existing Drizzle user with SQLAlchemy data
        sql = """
        UPDATE "User" 
        SET 
            "email" = $2,
            "password" = $3,
            "updatedAt" = $4
        WHERE "id" = $1
        RETURNING *
        """
        results = await query(
            sql, 
            str(user.id), 
            user.email, 
            user.hashed_password,
            datetime.utcnow()
        )
        
        return {"detail": "User synchronized successfully", "user": results[0] if results else None}
    else:
        # Create new Drizzle user
        sql = """
        INSERT INTO "User" ("id", "email", "password", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """
        now = datetime.utcnow()
        results = await query(
            sql,
            str(user.id),
            user.email,
            user.hashed_password,
            now,
            now
        )
        
        return {"detail": "User created in Drizzle database", "user": results[0] if results else None}


@router.post("/jwt/login/extended")
async def login_extended(
    response: Response,
    credentials: OAuth2PasswordRequestForm = Depends(),
    user_manager: UnifiedUserManager = Depends(get_user_manager),
    strategy = Depends(auth_backend.get_strategy),
):
    """
    Extended login endpoint that handles users from both databases.
    
    Args:
        response: Response object for setting cookies
        credentials: Login credentials
        user_manager: User manager dependency
        strategy: JWT strategy
    
    Returns:
        Dict: Access token and token type
    """
    # Try to authenticate with FastAPI Users
    try:
        user = await user_manager.authenticate(credentials)
    except HTTPException as e:
        # If FastAPI Users authentication fails, try Drizzle directly
        if e.status_code == status.HTTP_400_BAD_REQUEST and credentials.username:
            drizzle_user = await get_user_by_email(credentials.username)
            if drizzle_user:
                # Create user in SQLAlchemy and then authenticate again
                user_dict = {
                    "email": drizzle_user["email"],
                    "hashed_password": drizzle_user["password"],
                    "is_active": True,
                    "is_superuser": False,
                    "is_verified": True,
                }
                
                if "id" in drizzle_user:
                    user_dict["id"] = uuid.UUID(drizzle_user["id"])
                
                await user_manager.user_db.create(user_dict)
                
                # Try authentication again
                user = await user_manager.authenticate(credentials)
            else:
                # Re-raise the original exception if the user is not in Drizzle either
                raise e
        else:
            raise
            
    # Create access token
    token = await strategy.write_token(user)
    
    # Update last login time in Drizzle
    try:
        sql = 'UPDATE "User" SET "lastLogin" = $2 WHERE "id" = $1'
        await execute(sql, str(user.id), datetime.utcnow())
    except Exception:
        # Don't fail login if this update fails
        pass
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "is_superuser": user.is_superuser,
        }
    }


@router.post("/verify-email")
async def verify_email(
    token: str = Body(..., embed=True),
    user_manager: UnifiedUserManager = Depends(get_user_manager),
    request: Request = None,
):
    """
    Verify a user's email using a verification token.
    
    Args:
        token: Email verification token
        user_manager: User manager dependency
        request: Request object
    """
    try:
        # Verify token using FastAPI Users manager
        user_id = await user_manager.verify_email(token, request)
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token",
            )
        
        # Also update verification status in Drizzle
        try:
            verification_time = datetime.utcnow()
            sql = 'UPDATE "User" SET "emailVerified" = $2 WHERE "id" = $1'
            await execute(sql, str(user_id), verification_time)
        except Exception as e:
            # Log error but don't fail verification if Drizzle update fails
            print(f"Failed to update email verification status in Drizzle: {e}")
        
        return {"detail": "Email successfully verified"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error verifying email: {str(e)}",
        )


@router.post("/request-verify-email")
async def request_verification_email(
    email: EmailStr = Body(..., embed=True),
    user_manager: UnifiedUserManager = Depends(get_user_manager),
    request: Request = None,
):
    """
    Request a new verification email.
    
    Args:
        email: User email address
        user_manager: User manager dependency
        request: Request object
    """
    user = await user_manager.get_by_email(email)
    
    if user is None:
        # Return 202 even if user doesn't exist to prevent email enumeration
        return {"detail": "If the email is valid, a verification email has been sent."}
    
    if user.is_verified:
        return {"detail": "Email already verified"}
    
    # Generate verification token
    token = await user_manager.request_verify(user, request)
    
    # Send verification email
    await user_manager.on_after_request_verify(user, token, request)
    
    return {"detail": "Verification email has been sent"}


@router.post("/session-info")
async def get_session_info(
    user: User = Depends(current_active_user),
):
    """
    Get current user session information.
    
    Args:
        user: Current authenticated user
    
    Returns:
        Dict: User session information
    """
    # Get session data from Drizzle if available
    session_data = None
    try:
        sql = """
        SELECT s.*
        FROM "Session" s
        WHERE s."userId" = $1 AND s."expiresAt" > $2
        ORDER BY s."expiresAt" DESC
        LIMIT 1
        """
        results = await query(sql, str(user.id), datetime.utcnow())
        if results:
            session_data = results[0]
    except Exception as e:
        print(f"Error retrieving session data: {e}")
    
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "is_superuser": user.is_superuser,
        },
        "session": session_data
    }