import uuid
import re
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Union, List

from fastapi import Depends, Request, HTTPException
from fastapi_users import (
    BaseUserManager,
    FastAPIUsers,
    UUIDIDMixin,
    InvalidPasswordException,
)

from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase

from .config import settings
from .database import get_user_db
# Removed email import
from .models import User
from .schemas import UserCreate, UserUpdate, UserRead
from .drizzle import sync_user_with_drizzle, get_user_by_email, query, execute

# Configure logger
logger = logging.getLogger(__name__)

AUTH_URL_PATH = "auth"


class UnifiedUserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    """
    Enhanced user manager that works with both SQLAlchemy and Drizzle databases.
    Handles user operations across both databases to keep them synchronized.
    """
    reset_password_token_secret = settings.RESET_PASSWORD_SECRET_KEY
    verification_token_secret = settings.VERIFICATION_SECRET_KEY

    async def create(
        self, user_create: UserCreate, safe: bool = False, request: Optional[Request] = None
    ) -> User:
        """
        Create a user in both SQLAlchemy and Drizzle databases.
        
        Args:
            user_create: User creation data
            safe: If True, perform additional validations
            request: Optional request object
            
        Returns:
            User: The created user
        """
        await self.validate_password(user_create.password, user_create)

        # Create user in SQLAlchemy
        existing_user = await self.user_db.get_by_email(user_create.email)
        if existing_user is not None:
            raise HTTPException(
                status_code=400,
                detail="A user with this email already exists."
            )
            
        user_dict = user_create.create_update_dict()
        password = user_dict.pop("password")
        user_dict["hashed_password"] = self.password_helper.hash(password)
        user_dict["is_active"] = True
        user_dict["is_superuser"] = False
        user_dict["is_verified"] = False
        
        # Create in SQLAlchemy
        created_user = await self.user_db.create(user_dict)
        
        # Now sync with Drizzle
        try:
            await sync_user_with_drizzle(created_user)
            logger.info(f"User {created_user.id} created and synced with Drizzle")
        except Exception as e:
            logger.error(f"Failed to sync user with Drizzle: {e}")
            # Consider whether to roll back the SQLAlchemy user creation
            # For now we'll keep it to avoid breaking core functionality
        
        # Fire the after_register event
        await self.on_after_register(created_user, request)
        
        return created_user
        
    async def update(
        self,
        user_update: Union[UserUpdate, Dict[str, Any]],
        user: User,
        safe: bool = False,
        request: Optional[Request] = None,
    ) -> User:
        """
        Update a user in both SQLAlchemy and Drizzle databases.
        
        Args:
            user_update: User update data
            user: User to update
            safe: If True, perform additional validations
            request: Optional request object
            
        Returns:
            User: The updated user
        """
        # Get update dict from pydantic model if needed
        update_dict = user_update if isinstance(user_update, dict) else user_update.create_update_dict()
        
        # Handle password update
        if "password" in update_dict and update_dict["password"] is not None:
            password = update_dict.pop("password")
            update_dict["hashed_password"] = self.password_helper.hash(password)
        
        # Update in SQLAlchemy
        updated_user = await self.user_db.update(user, update_dict)
        
        # Sync with Drizzle
        try:
            await sync_user_with_drizzle(updated_user)
            logger.info(f"User {updated_user.id} updated and synced with Drizzle")
        except Exception as e:
            logger.error(f"Failed to sync updated user with Drizzle: {e}")
        
        # Fire the on_after_update event
        await self.on_after_update(updated_user, update_dict, request)
        
        return updated_user
    
    async def delete(self, user: User) -> None:
        """
        Delete a user from both SQLAlchemy and Drizzle databases.
        
        Args:
            user: User to delete
        """
        # Delete from Drizzle first
        try:
            sql = 'DELETE FROM "User" WHERE "id" = $1'
            await execute(sql, str(user.id))
            logger.info(f"User {user.id} deleted from Drizzle")
        except Exception as e:
            logger.error(f"Failed to delete user from Drizzle: {e}")
        
        # Then delete from SQLAlchemy
        await self.user_db.delete(user)
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """
        Get a user by email from SQLAlchemy, checking Drizzle as fallback.
        
        Args:
            email: Email address
            
        Returns:
            Optional[User]: The user if found, None otherwise
        """
        # First try SQLAlchemy
        user = await self.user_db.get_by_email(email)
        if user is not None:
            return user
        
        # If not in SQLAlchemy, check Drizzle and create if found
        try:
            drizzle_user = await get_user_by_email(email)
            if drizzle_user is not None:
                # Create a corresponding user in SQLAlchemy
                user_dict = {
                    "email": drizzle_user["email"],
                    "hashed_password": drizzle_user["password"],
                    "is_active": True,
                    "is_superuser": False,
                    "is_verified": True,  # Assume verified if in Drizzle
                }
                if "id" in drizzle_user:
                    user_dict["id"] = uuid.UUID(drizzle_user["id"])
                
                user = await self.user_db.create(user_dict)
                logger.info(f"User {user.id} imported from Drizzle to SQLAlchemy")
                return user
        except Exception as e:
            logger.error(f"Error checking Drizzle for user by email: {e}")
        
        return None

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        """Callback for after user registration."""
        logger.info(f"User {user.id} has registered.")
        await sync_user_with_drizzle(user)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """Callback for after forgot password request."""
        # Email functionality removed as part of backend email service removal
        # Frontend will handle sending password reset emails
        logger.info(f"Password reset requested for user {user.id}. Token: {token}")
        
        # Store the token in Drizzle database
        try:
            # First delete any existing token for this user
            await execute(
                'DELETE FROM "PasswordReset" WHERE "userId" = $1',
                str(user.id)
            )
            
            # Create new token entry
            import secrets
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

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """Callback for after verification request."""
        logger.info(f"Verification requested for user {user.id}. Verification token: {token}")

    async def validate_password(
        self,
        password: str,
        user: UserCreate,
    ) -> None:
        """
        Validate password strength according to security policies.
        
        Args:
            password: Password to validate
            user: User creation data
            
        Raises:
            InvalidPasswordException: If the password is invalid
        """
        errors: List[str] = []

        if len(password) < 8:
            errors.append("Password should be at least 8 characters.")
        if user.email in password:
            errors.append("Password should not contain e-mail.")
        if not any(char.isupper() for char in password):
            errors.append("Password should contain at least one uppercase letter.")
        if not any(char.isdigit() for char in password):
            errors.append("Password should contain at least one number.")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password should contain at least one special character.")

        if errors:
            raise InvalidPasswordException(reason=errors)

    async def reset_password(
        self, token: str, password: str, request: Optional[Request] = None
    ):
        """
        Reset user password using token stored in Drizzle.
        
        Args:
            token: Password reset token
            password: New password
            request: Optional request object
            
        Returns:
            User: The updated user
            
        Raises:
            HTTPException: If the token is invalid or expired
        """
        # Verify password reset token function implementation (moved from email.py)
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
                raise self.password_reset_exception
            
            # Get user ID from valid token
            user_id = results[0]["userId"]
            logger.info(f"Valid password reset token for user {user_id}")
        except Exception as e:
            logger.error(f"Error verifying password reset token: {e}")
            raise self.password_reset_exception
        
        user_uuid = uuid.UUID(user_id)
        user = await self.get(user_uuid)
        if user is None:
            raise self.password_reset_exception
        
        updated_user = await self.update(
            user_update={"password": password},
            user=user,
            safe=False,
            request=request,
        )
        
        # Also update the password in Drizzle
        try:
            sql = 'UPDATE "User" SET "password" = $2 WHERE "id" = $1'
            await execute(sql, str(user.id), self.password_helper.hash(password))
            
            # Delete the used token
            delete_token_sql = 'DELETE FROM "PasswordReset" WHERE "token" = $1'
            await execute(delete_token_sql, token)
            
            logger.info(f"Password reset completed for user {user.id}")
        except Exception as e:
            logger.error(f"Failed to update password in Drizzle: {e}")
        
        return updated_user

    async def on_after_verify(
        self, user: User, request: Optional[Request] = None
    ):
        """Callback for after email verification."""
        logger.info(f"User {user.id} has verified their email.")
        
        # Update verification status in both databases
        user.is_verified = True
        await self.user_db.update(user, {"is_verified": True})
        
        # Update in Drizzle
        try:
            sql = 'UPDATE "User" SET "emailVerified" = $2 WHERE "id" = $1'
            await execute(sql, str(user.id), datetime.utcnow())
        except Exception as e:
            logger.error(f"Failed to update verification status in Drizzle: {e}")
        
        await sync_user_with_drizzle(user)

    async def on_after_update(
        self, user: User, update_dict: dict, request: Optional[Request] = None
    ):
        """Callback for after user update."""
        logger.info(f"User {user.id} has been updated.")
        await sync_user_with_drizzle(user)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    """Get the user manager dependency."""
    yield UnifiedUserManager(user_db)

bearer_transport = BearerTransport(tokenUrl=f"{AUTH_URL_PATH}/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.ACCESS_SECRET_KEY,
        lifetime_seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS,
    )


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
