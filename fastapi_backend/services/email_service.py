"""
Email service for sending emails through the frontend API.

This module provides a service for sending emails using the frontend email API.
It supports different email templates and handles communication with the frontend.
"""

import json
import logging
from enum import Enum
from typing import Any, Dict, Optional
import httpx
from httpx import AsyncClient

from app.config import settings

logger = logging.getLogger(__name__)


class EmailTemplate(str, Enum):
    """Supported email templates."""
    
    MAGIC_LINK = "magic-link"
    RESET_PASSWORD = "reset-password"
    WELCOME = "welcome"


class EmailService:
    """Service for sending emails through the frontend API."""
    
    def __init__(
        self,
        frontend_url: str = settings.FRONTEND_URL,
        api_endpoint: str = settings.EMAIL_API_ENDPOINT,
        api_token: str = settings.EMAIL_API_TOKEN,
        max_retries: int = settings.EMAIL_API_MAX_RETRIES,
        retry_delay_ms: int = settings.EMAIL_API_RETRY_DELAY_MS,
    ):
        """Initialize the email service.
        
        Args:
            frontend_url: Base URL of the frontend.
            api_endpoint: Endpoint for the email API.
            api_token: Authentication token for the email API.
            max_retries: Maximum number of retry attempts for failed requests.
            retry_delay_ms: Delay between retry attempts in milliseconds.
        """
        self.frontend_url = frontend_url.rstrip('/')
        self.api_endpoint = api_endpoint.lstrip('/')
        self.api_url = f"{self.frontend_url}/{self.api_endpoint}"
        self.api_token = api_token
        self.max_retries = max_retries
        self.retry_delay_ms = retry_delay_ms
        
    async def send_email(
        self,
        to: str,
        template: EmailTemplate,
        subject: str,
        data: Dict[str, Any],
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an email using the frontend API.
        
        Args:
            to: Recipient email address.
            template: Email template to use.
            subject: Email subject.
            data: Template data.
            from_email: Sender email address (optional).
            from_name: Sender name (optional).
            
        Returns:
            Dictionary containing the response from the email API.
            
        Raises:
            httpx.HTTPStatusError: If the API returns an error status code.
            httpx.RequestError: If there's a network-related error.
            ValueError: If the API response is invalid.
        """
        payload = {
            "to": to,
            "template": template,
            "subject": subject,
            "data": data,
        }
        
        if from_email:
            payload["from"] = from_email
            
        if from_name:
            payload["fromName"] = from_name
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}"
        }
        
        retry_count = 0
        last_error = None
        
        while retry_count <= self.max_retries:
            try:
                async with AsyncClient() as client:
                    response = await client.post(
                        self.api_url,
                        json=payload,
                        headers=headers,
                        timeout=10.0
                    )
                    response.raise_for_status()
                    
                    try:
                        return response.json()
                    except json.JSONDecodeError:
                        # Return a generic response if the response is not JSON
                        return {"status": "success", "message": "Email sent successfully"}
                        
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                last_error = e
                logger.error(f"Email sending attempt {retry_count + 1} failed: {str(e)}")
                
                if retry_count < self.max_retries:
                    # Exponential backoff
                    await httpx.AsyncClient().sleep(
                        self.retry_delay_ms * (2 ** retry_count) / 1000
                    )
                    retry_count += 1
                else:
                    break
        
        # If we get here, all retries failed
        logger.error(f"Failed to send email after {self.max_retries} retries")
        raise last_error or ValueError("Failed to send email")


# Create a singleton instance
email_service = EmailService()