"""
Authentication middleware to synchronize users between FastAPI and Next.js.

This module provides middleware for FastAPI that synchronizes user data
between the SQLAlchemy backend and the Drizzle-managed frontend database.
"""
from typing import Callable, Awaitable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from .drizzle import sync_user_with_drizzle
from .users import get_user_manager


class DrizzleSyncMiddleware(BaseHTTPMiddleware):
    """
    Middleware to synchronize users between FastAPI and Drizzle.
    
    This middleware intercepts requests to authentication endpoints
    and syncs user data with the Drizzle database after login/register.
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """
        Process the request and sync user data if needed.
        
        Args:
            request: The incoming request
            call_next: The next request handler
            
        Returns:
            Response: The outgoing response
        """
        # Get the path to check if it's an auth endpoint
        path = request.url.path
        method = request.method
        
        # Process the request first
        response = await call_next(request)
        
        # Check if this is a successful auth request (login or register)
        if (
            (path.endswith("/auth/jwt/login") and method == "POST" and response.status_code == 200) or
            (path.endswith("/auth/register") and method == "POST" and response.status_code == 201)
        ):
            # Get the user from the session
            try:
                user_manager = get_user_manager()
                if path.endswith("/auth/jwt/login"):
                    # Extract user email from the login form
                    form_data = await request.form()
                    email = form_data.get("username")  # FastAPI Users uses username for email
                    
                    if email:
                        # Get the user by email
                        user = await user_manager.get_by_email(email)
                        if user:
                            # Sync the user with Drizzle
                            await sync_user_with_drizzle(user)
                elif path.endswith("/auth/register"):
                    # Extract user data from the response
                    user_data = await request.json()
                    email = user_data.get("email")
                    
                    if email:
                        # Get the user by email
                        user = await user_manager.get_by_email(email)
                        if user:
                            # Sync the user with Drizzle
                            await sync_user_with_drizzle(user)
            except Exception as e:
                # Log the error but don't block the response
                print(f"Error syncing user with Drizzle: {e}")
        
        return response