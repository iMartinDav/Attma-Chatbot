from pathlib import Path
import urllib.parse
from datetime import datetime, timedelta
import uuid

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from .config import settings
from .models import User
from .drizzle import execute, query


def get_email_config():
    """Create and return the FastAPI Mail configuration."""
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
        TEMPLATE_FOLDER=Path(__file__).parent / settings.TEMPLATE_DIR,
    )
    return conf


async def send_reset_password_email(user: User, token: str):
    """
    Send a password reset email using FastAPI Mail.
    Also stores the token in the Drizzle database.
    
    Args:
        user: The user requesting the password reset
        token: The password reset token
    """
    # Create email configuration
    conf = get_email_config()
    email = user.email
    
    # Generate reset link for frontend
    base_url = f"{settings.FRONTEND_URL}/password-recovery/confirm?"
    params = {"token": token}
    encoded_params = urllib.parse.urlencode(params)
    link = f"{base_url}{encoded_params}"
    
    # Create message
    message = MessageSchema(
        subject="Password recovery",
        recipients=[email],
        template_body={"username": email, "link": link},
        subtype=MessageType.html,
    )

    # Send email
    fm = FastMail(conf)
    await fm.send_message(message, template_name="password_reset.html")
    
    # Store token in Drizzle database
    token_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    # Check if there's an existing token for this user and delete it
    delete_sql = 'DELETE FROM "PasswordReset" WHERE "userId" = $1'
    await execute(delete_sql, str(user.id))
    
    # Insert new token
    insert_sql = '''
    INSERT INTO "PasswordReset" ("id", "userId", "token", "expiresAt", "createdAt")
    VALUES ($1, $2, $3, $4, $5)
    '''
    await execute(
        insert_sql,
        token_id,
        str(user.id),
        token,
        expires_at,
        datetime.utcnow()
    )


async def verify_password_reset_token(token: str):
    """
    Verify a password reset token from the Drizzle database.
    
    Args:
        token: The password reset token
        
    Returns:
        Optional[str]: User ID if token is valid, None otherwise
    """
    # Get the token from the database
    now = datetime.utcnow()
    sql = '''
    SELECT * FROM "PasswordReset"
    WHERE "token" = $1 AND "expiresAt" > $2
    '''
    results = await query(sql, token, now)
    
    if results:
        reset_data = results[0]
        return reset_data["userId"]
    
    return None
