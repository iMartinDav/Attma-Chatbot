"""
Middleware for the FastAPI application.
"""
import logging
import time
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from .drizzle import sync_user_with_drizzle
from .users import current_active_user, User

logger = logging.getLogger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs API requests and processing time.
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
        Process an incoming request and log details.
        
        Args:
            request: FastAPI request object
            call_next: Function to call the next middleware
            
        Returns:
            Response: FastAPI response object
        """
        # Log the incoming request
        path = request.url.path
        method = request.method
        content_type = request.headers.get("Content-Type", "")
        
        logger.info(f"Request: {method} {path} from {request.client.host if request.client else 'unknown'} | Content-Type: {content_type}")
        
        # Process the request and measure timing
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        status_code = response.status_code
        
        # Log response details
        logger.info(f"Response: {method} {path} - Status: {status_code} - Process time: {process_time:.4f}s")
        
        return response


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
        except Exception as auth_error:
            # User is probably not authenticated, continue without syncing
            logger.debug(f"Authentication check in middleware: {str(auth_error)}")
        
        # If a user is authenticated, sync them with Drizzle
        if user:
            try:
                start_sync_time = time.time()
                drizzle_user = await sync_user_with_drizzle(user)
                sync_time = time.time() - start_sync_time
                logger.debug(f"Synchronized user {user.email} with Drizzle database in {sync_time:.4f}s")
            except Exception as e:
                logger.error(f"Failed to sync user {user.email} with Drizzle: {str(e)}", exc_info=True)
                # We don't want to block the request if sync fails
                # Just log the error and continue
        
        # Process the request and get the response
        response = await call_next(request)
        return response
