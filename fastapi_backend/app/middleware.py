"""
Middleware for the FastAPI application.
"""
import logging
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from .drizzle import sync_user_with_drizzle
from .users import current_active_user, User

logger = logging.getLogger(__name__)

class DrizzleSyncMiddleware(BaseHTTPMiddleware):
    """
    Middleware that synchronizes user data between SQLAlchemy and Drizzle.
    
    This middleware intercepts requests after authentication and ensures that 
    user data in the Drizzle database (used by the frontend) is synchronized
    with the user data in the SQLAlchemy database (used by FastAPI Users).
    """
    
    def __init__(self, app: ASGIApp):
        """
        Initialize the middleware.
        
        Args:
            app: ASGI application
        """
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process an incoming request.
        
        Args:
            request: FastAPI request object
            call_next: Function to call the next middleware
            
        Returns:
            Response: FastAPI response object
        """
        # Extract the current user if available, but don't raise an exception
        # if the user is not authenticated
        user: Optional[User] = None
        try:
            user = await current_active_user(request)
        except:
            # User is probably not authenticated, continue without syncing
            pass
        
        # If a user is authenticated, sync them with Drizzle
        if user:
            try:
                drizzle_user = await sync_user_with_drizzle(user)
                logger.debug(f"Synchronized user {user.email} with Drizzle database")
            except Exception as e:
                logger.error(f"Failed to sync user {user.email} with Drizzle: {str(e)}")
        
        # Process the request and get the response
        response = await call_next(request)
        return response