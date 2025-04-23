"""
Graph Storage Module.

This module provides data access layer (DAL) functionality for storing and retrieving
graph visualizations and other analysis results in the database and Vercel Blob Storage.
"""

import io
import os
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Tuple, List, Union
import httpx

from .blob_storage import upload_to_blob
from .database import execute_db, query_db

# Configure logging
logger = logging.getLogger(__name__)

# API URL for database operations
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000/api")

async def store_graph_visualization(
    graph_bytes: bytes,
    file_name: str,
    graph_type: str,
    user_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Tuple[str, str]:
    """
    Store a graph visualization in Vercel Blob Storage and record metadata in the database.
    
    Args:
        graph_bytes: The bytes of the graph visualization.
        file_name: The original file name.
        graph_type: The type of graph (e.g., 'langgraph', 'plotly', 'matplotlib').
        user_id: Optional user ID associated with the graph.
        workflow_id: Optional workflow ID associated with the graph.
        metadata: Optional additional metadata to store with the graph.
        
    Returns:
        Tuple containing (graph_id, blob_url)
    """
    # Generate unique ID for this graph
    graph_id = str(uuid.uuid4())
    
    # Ensure file has proper extension
    if not file_name.lower().endswith(('.png', '.jpg', '.jpeg', '.svg', '.pdf')):
        file_name += '.png'  # Default to PNG if no extension
    
    # Convert bytes to file-like object for blob upload
    file_obj = io.BytesIO(graph_bytes)
    file_obj.seek(0)
    
    # Upload to Vercel Blob Storage
    blob_info = await upload_to_blob(file_obj, file_name, content_type=f"image/{file_name.split('.')[-1]}")
    blob_url = blob_info["url"]
    blob_id = blob_info["blob_id"]
    
    # Prepare metadata JSON
    full_metadata = metadata or {}
    full_metadata.update({
        "graph_type": graph_type,
        "original_filename": file_name,
        "created_at": datetime.utcnow().isoformat(),
    })
    
    # Store metadata in database
    query = """
    INSERT INTO graph_visualizations 
    (id, blob_id, url, user_id, workflow_id, metadata) 
    VALUES (%s, %s, %s, %s, %s, %s)
    """
    
    await execute_db(
        query, 
        (graph_id, blob_id, blob_url, user_id, workflow_id, full_metadata)
    )
    
    return graph_id, blob_url


async def get_graph_visualization(graph_id: str) -> Dict[str, Any]:
    """
    Retrieve graph visualization metadata from the database.
    
    Args:
        graph_id: The ID of the graph to retrieve.
        
    Returns:
        Dictionary with graph metadata and URL.
    """
    query = """
    SELECT id, blob_id, url, user_id, workflow_id, metadata, created_at
    FROM graph_visualizations
    WHERE id = %s
    """
    
    results = await query_db(query, (graph_id,))
    
    if not results:
        raise ValueError(f"Graph visualization with ID {graph_id} not found")
    
    graph_data = results[0]
    return {
        "id": graph_data[0],
        "blob_id": graph_data[1],
        "url": graph_data[2],
        "user_id": graph_data[3],
        "workflow_id": graph_data[4],
        "metadata": graph_data[5],
        "created_at": graph_data[6].isoformat() if graph_data[6] else None
    }


async def list_user_graphs(
    user_id: str, 
    limit: int = 20, 
    offset: int = 0,
    graph_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    List graph visualizations for a specific user.
    
    Args:
        user_id: The user ID to list graphs for.
        limit: Maximum number of results to return.
        offset: Pagination offset.
        graph_type: Optional filter by graph type.
        
    Returns:
        Dictionary with list of graphs and total count.
    """
    query_params = [user_id]
    where_clause = "WHERE user_id = %s"
    
    if graph_type:
        where_clause += " AND metadata->>'graph_type' = %s"
        query_params.append(graph_type)
    
    count_query = f"""
    SELECT COUNT(*) FROM graph_visualizations {where_clause}
    """
    
    list_query = f"""
    SELECT id, url, metadata, created_at
    FROM graph_visualizations
    {where_clause}
    ORDER BY created_at DESC
    LIMIT %s OFFSET %s
    """
    
    # Add limit and offset to params
    query_params.extend([limit, offset])
    
    # Execute both queries
    count_result = await query_db(count_query, query_params[:-2])
    list_result = await query_db(list_query, query_params)
    
    total = count_result[0][0] if count_result else 0
    
    graphs = [
        {
            "id": row[0],
            "url": row[1],
            "metadata": row[2],
            "created_at": row[3].isoformat() if row[3] else None
        }
        for row in list_result
    ]
    
    return {
        "total": total,
        "graphs": graphs
    }

async def insert_analysis_result(
    user_id: str,
    analysis_type: str,
    result_type: str,
    storage_type: str,
    metadata: Optional[Dict[str, Any]] = None,
    small_result: Optional[Dict[str, Any]] = None,
    result_location: Optional[str] = None,
    large_result_blob_id: Optional[str] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Insert an analysis result record into the database.
    
    Args:
        user_id: ID of the user who created the analysis
        analysis_type: Type of analysis performed
        result_type: Type of result (table, plot, text, etc.)
        storage_type: How the result is stored (database, blob)
        metadata: Additional metadata about the analysis
        small_result: Small results stored directly in the database
        result_location: Path or URL if stored externally
        large_result_blob_id: Reference to a large result blob
        
    Returns:
        Tuple of (success, message, record_id if successful)
    """
    try:
        # Generate a unique ID for the result
        result_id = str(uuid.uuid4())
        
        # Prepare payload for database insertion
        payload = {
            "id": result_id,
            "userId": user_id,
            "analysisType": analysis_type,
            "resultType": result_type,
            "storageType": storage_type,
            "metadata": metadata or {},
            "smallResult": small_result,
            "resultLocation": result_location,
            "largeResultBlobId": large_result_blob_id
        }
        
        # Insert into database
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE_URL}/analysis-results",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code not in (200, 201):
                return (False, f"Failed to insert analysis result: {response.text}", None)
            
            result = response.json()
            return (True, "Analysis result inserted successfully", result_id)
    except Exception as e:
        logger.error(f"Error inserting analysis result: {str(e)}")
        return (False, f"Error inserting analysis result: {str(e)}", None)

async def get_analysis_result(
    result_id: str,
    user_id: str
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Retrieve an analysis result from the database.
    
    Args:
        result_id: ID of the analysis result to retrieve
        user_id: ID of the user who owns the result
        
    Returns:
        Tuple of (success, message, result data if successful)
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE_URL}/analysis-results/{result_id}",
                params={"userId": user_id}
            )
            
            if response.status_code == 404:
                return (False, "Analysis result not found", None)
            elif response.status_code != 200:
                return (False, f"Failed to retrieve analysis result: {response.text}", None)
            
            result = response.json()
            return (True, "Analysis result retrieved successfully", result)
    except Exception as e:
        logger.error(f"Error retrieving analysis result: {str(e)}")
        return (False, f"Error retrieving analysis result: {str(e)}", None)

async def update_analysis_result(
    result_id: str,
    user_id: str,
    updates: Dict[str, Any]
) -> Tuple[bool, str]:
    """
    Update an existing analysis result in the database.
    
    Args:
        result_id: ID of the analysis result to update
        user_id: ID of the user who owns the result
        updates: Dictionary of fields to update
        
    Returns:
        Tuple of (success, message)
    """
    try:
        # Prepare payload for database update
        payload = {
            "userId": user_id,
            **updates
        }
        
        # Update the database record
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{API_BASE_URL}/analysis-results/{result_id}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 404:
                return (False, "Analysis result not found")
            elif response.status_code != 200:
                return (False, f"Failed to update analysis result: {response.text}")
            
            return (True, "Analysis result updated successfully")
    except Exception as e:
        logger.error(f"Error updating analysis result: {str(e)}")
        return (False, f"Error updating analysis result: {str(e)}")

async def list_analysis_results(
    user_id: str,
    analysis_type: Optional[str] = None,
    result_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> Tuple[bool, str, Optional[List[Dict[str, Any]]]]:
    """
    List analysis results for a user with optional filtering.
    
    Args:
        user_id: ID of the user whose results to list
        analysis_type: Optional filter by analysis type
        result_type: Optional filter by result type
        limit: Maximum number of results to return
        offset: Offset for pagination
        
    Returns:
        Tuple of (success, message, list of results if successful)
    """
    try:
        # Prepare query parameters
        params = {
            "userId": user_id,
            "limit": limit,
            "offset": offset
        }
        
        if analysis_type:
            params["analysisType"] = analysis_type
        
        if result_type:
            params["resultType"] = result_type
        
        # Query the database
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE_URL}/analysis-results",
                params=params
            )
            
            if response.status_code != 200:
                return (False, f"Failed to list analysis results: {response.text}", None)
            
            results = response.json()
            return (True, f"Found {len(results)} analysis results", results)
    except Exception as e:
        logger.error(f"Error listing analysis results: {str(e)}")
        return (False, f"Error listing analysis results: {str(e)}", None)

async def delete_analysis_result(
    result_id: str,
    user_id: str
) -> Tuple[bool, str]:
    """
    Delete an analysis result from the database.
    
    Args:
        result_id: ID of the analysis result to delete
        user_id: ID of the user who owns the result
        
    Returns:
        Tuple of (success, message)
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{API_BASE_URL}/analysis-results/{result_id}",
                params={"userId": user_id}
            )
            
            if response.status_code == 404:
                return (False, "Analysis result not found")
            elif response.status_code != 200:
                return (False, f"Failed to delete analysis result: {response.text}")
            
            return (True, "Analysis result deleted successfully")
    except Exception as e:
        logger.error(f"Error deleting analysis result: {str(e)}")
        return (False, f"Error deleting analysis result: {str(e)}")