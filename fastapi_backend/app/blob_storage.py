"""
Blob Storage utilities for handling file storage with Vercel Blob Storage.
"""
import os
import requests
import json
from typing import Optional, Dict, Any
import uuid
from datetime import datetime
import httpx
from fastapi import HTTPException
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Vercel Blob Storage API endpoint
VERCEL_BLOB_API_URL = "https://blob.vercel-storage.com"
BLOB_STORE_ID = os.getenv("BLOB_STORE_ID", "")
VERCEL_BLOB_TOKEN = os.getenv("VERCEL_BLOB_TOKEN", "")

# Check if the required environment variables are set
if not BLOB_STORE_ID or not VERCEL_BLOB_TOKEN:
    logger.warning(
        "BLOB_STORE_ID or VERCEL_BLOB_TOKEN not set. Vercel Blob Storage operations will fail."
    )

class BlobStorageError(Exception):
    """Exception raised for errors in Blob Storage operations."""
    pass

async def store_blob(
    content_bytes: bytes,
    content_type: str = "image/png",
    filename: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Store content in Vercel Blob Storage.
    
    Args:
        content_bytes: The binary content to store
        content_type: The MIME type of the content
        filename: Optional filename (if not provided, a UUID will be generated)
        metadata: Optional metadata to associate with the blob
        
    Returns:
        Dict with the blob information including URL and ID
    """
    if not BLOB_STORE_ID or not VERCEL_BLOB_TOKEN:
        raise BlobStorageError("Blob storage credentials are not configured")
    
    # Generate a filename if not provided
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"graph_{timestamp}_{uuid.uuid4().hex[:8]}.png"
    
    # Prepare headers
    headers = {
        "Authorization": f"Bearer {VERCEL_BLOB_TOKEN}",
        "X-Vercel-Blob-Store-ID": BLOB_STORE_ID,
        "Content-Type": content_type,
    }
    
    # Add optional metadata if provided
    if metadata:
        headers["X-Vercel-Blob-Metadata"] = json.dumps(metadata)
    
    try:
        # Make the API request to upload the blob
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{VERCEL_BLOB_API_URL}/{filename}",
                headers=headers,
                content=content_bytes
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to upload to blob storage: {response.text}")
                raise BlobStorageError(f"Failed to upload to blob storage: {response.status_code}")
            
            # Parse the response
            result = response.json()
            
            return {
                "url": result.get("url"),
                "blob_id": result.get("id"),
                "filename": filename,
                "size": len(content_bytes),
                "content_type": content_type,
                "timestamp": datetime.now().isoformat()
            }
    
    except Exception as e:
        logger.exception(f"Error uploading to blob storage: {str(e)}")
        raise BlobStorageError(f"Error uploading to blob storage: {str(e)}")

async def delete_blob(blob_url: str) -> bool:
    """
    Delete a blob from Vercel Blob Storage.
    
    Args:
        blob_url: The URL of the blob to delete
        
    Returns:
        bool: True if deletion was successful, False otherwise
    """
    if not BLOB_STORE_ID or not VERCEL_BLOB_TOKEN:
        raise BlobStorageError("Blob storage credentials are not configured")
    
    # Extract filename from URL
    filename = blob_url.split("/")[-1]
    
    # Prepare headers
    headers = {
        "Authorization": f"Bearer {VERCEL_BLOB_TOKEN}",
        "X-Vercel-Blob-Store-ID": BLOB_STORE_ID
    }
    
    try:
        # Make the API request to delete the blob
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{VERCEL_BLOB_API_URL}/{filename}",
                headers=headers
            )
            
            return response.status_code == 200
    
    except Exception as e:
        logger.exception(f"Error deleting blob: {str(e)}")
        return False