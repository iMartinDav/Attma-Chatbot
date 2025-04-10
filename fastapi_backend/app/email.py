"""
Email functionality for the application.
Handles sending emails and verifying tokens.
"""
import secrets
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Union
import os
from pathlib import Path

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

from .models import User
from .config import settings
from .drizzle import execute, query

# Configure logger
logger = logging.getLogger(__name__)

# Configure FastAPI Mail
# Use absolute path for template folder
current_dir = Path(__file__).parent
template_path = current_dir / settings.TEMPLATE_DIR

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS,
    TEMPLATE_FOLDER=str(template_path)
)

# Create FastMail instance
fast_mail = FastMail(conf)


async def send_email(
    email: EmailStr,
    subject: str,
    body: str,
    template_name: Optional[str] = None,
    template_body: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Send an email using FastAPI Mail.
    
    Args:
        email: Recipient email address
        subject: Email subject
        body: Plain text email body (used if template_name is None)
        template_name: Optional template name to use
        template_body: Optional template context data
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    try:
        message = MessageSchema(
            subject=subject,
            recipients=[email],
            body=body if template_name is None else None,
            template_body=template_body,
            subtype=MessageType.html
        )
        
        if template_name:
            await fast_mail.send_message(message, template_name=template_name)
        else:
            await fast_mail.send_message(message)
        
        logger.info(f"Email sent successfully to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {email}: {e}")
        return False


async def send_reset_password_email(user: User, token: str) -> bool:
    """
    Send password reset email to user with reset token.
    
    Args:
        user: User to send the email to
        token: Password reset token
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    # Store token in Drizzle database
    try:
        # First delete any existing token for this user
        await execute(
            'DELETE FROM "PasswordReset" WHERE "userId" = $1',
            str(user.id)
        )
        
        # Create new token entry
        token_id = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=24)  # Token valid for 24 hours
        
        await execute(
            """
            INSERT INTO "PasswordReset" ("id", "userId", "token", "expiresAt", "createdAt")
            VALUES ($1, $2, $3, $4, $5)
            """,
            token_id,
            str(user.id),
            token,
            expires_at,
            datetime.utcnow()
        )
        
        logger.info(f"Password reset token stored for user {user.id}")
    except Exception as e:
        logger.error(f"Failed to store password reset token for user {user.id}: {e}")
    
    # Compose email
    subject = "Password Reset Request"
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    template_body = {
        "project_name": settings.MAIL_FROM_NAME,
        "username": user.email,
        "email": user.email,
        "valid_hours": 24,
        "reset_link": reset_link,
        "token": token,
    }
    
    return await send_email(
        email=user.email,
        subject=subject,
        body=f"Click the link to reset your password: {reset_link}",
        template_name="password_reset.html",
        template_body=template_body
    )


async def verify_password_reset_token(token: str) -> Optional[str]:
    """
    Verify a password reset token from the Drizzle database.
    
    Args:
        token: Password reset token
        
    Returns:
        Optional[str]: User ID if token is valid, None otherwise
    """
    try:
        # Check if token exists and is not expired
        results = await query(
            """
            SELECT "userId" FROM "PasswordReset"
            WHERE "token" = $1 AND "expiresAt" > $2
            """,
            token,
            datetime.utcnow()
        )
        
        if not results:
            logger.warning(f"Invalid or expired password reset token: {token}")
            return None
        
        # Return user ID from valid token
        user_id = results[0]["userId"]
        logger.info(f"Valid password reset token for user {user_id}")
        return user_id
    except Exception as e:
        logger.error(f"Error verifying password reset token: {e}")
        return None


async def send_verification_email(user: User, token: str) -> bool:
    """
    Send email verification email to user.
    
    Args:
        user: User to send the email to
        token: Verification token
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    # Store verification token in database
    try:
        # We're not storing this in Drizzle since FastAPI Users handles this internally
        # But we're preparing for future migration
        pass
    except Exception as e:
        logger.error(f"Failed to store verification token for user {user.id}: {e}")
    
    # Compose email
    subject = "Please verify your email"
    verification_link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    
    template_body = {
        "project_name": settings.MAIL_FROM_NAME,
        "username": user.email,
        "email": user.email,
        "verify_link": verification_link,
        "token": token,
    }
    
    return await send_email(
        email=user.email,
        subject=subject,
        body=f"Click the link to verify your email: {verification_link}",
        template_name="verification.html",
        template_body=template_body
    )
