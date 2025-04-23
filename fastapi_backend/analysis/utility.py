import os
import shutil
import functools
import json
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import plotly.express as px
import boto3
from backend import global_variables
from botocore.exceptions import ClientError
import zipfile
from io import BytesIO
import requests
from datetime import datetime
import uuid
from typing import Optional, Dict, Any, Union, Tuple
import httpx
import asyncio

# AWS S3 Configuration
s3_client = boto3.client(
    "s3",
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    region_name=os.environ.get("AWS_REGION", global_variables.AWS_REGION),
)

# Vercel Blob Storage configuration
VERCEL_BLOB_STORE_ID = os.environ.get("VERCEL_BLOB_STORE_ID")
VERCEL_API_TOKEN = os.environ.get("VERCEL_API_TOKEN")
VERCEL_BLOB_API_URL = "https://blob.vercel-storage.com"

# API URL for database operations
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000/api")

def plot_violin_mitochondrial_genes(df, plotly=True):
    """
    Create a violin plot of mitochondrial gene percentages.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        DataFrame containing the data with columns 'orig.ident' and 'percent.mt'
    plotly : bool
        Whether to use Plotly (interactive) or Seaborn (static) for plotting
    """
    if not plotly:
        plt.figure(figsize=(10, 6))
        sns.violinplot(
            x="orig.ident", y="percent.mt", data=df, palette="Set2", inner="point"
        )
        sns.stripplot(
            x="orig.ident", y="percent.mt", data=df, color="k", alpha=0.6, jitter=True
        )
        plt.title("Violin Plot of Mitochondrial Genes (Seaborn)")
        plt.ylabel("Percentage of Mitochondrial Genes")
        plt.xlabel("Origin Ident")
        plt.xticks(rotation=45)
        plt.show()
    else:
        fig = px.violin(
            df,
            x="orig.ident",
            y="percent.mt",
            color="orig.ident",
            box=True,
            points="all",
            title="Violin Plot of Mitochondrial Genes (Plotly)",
        )
        fig.update_xaxes(tickangle=45)
        fig.show()

async def store_in_vercel_blob(
    data: bytes, 
    filename: str, 
    content_type: str = "image/png"
) -> Tuple[bool, str, Optional[str]]:
    """
    Store data in Vercel Blob Storage
    
    Args:
        data: Bytes data to store
        filename: Name of the file
        content_type: MIME type of the content
        
    Returns:
        Tuple of (success, message, url if successful)
    """
    if not VERCEL_BLOB_STORE_ID or not VERCEL_API_TOKEN:
        return (False, "Vercel Blob Storage credentials not configured", None)
    
    # Generate a unique filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    filename_with_timestamp = f"{filename.split('.')[0]}_{timestamp}_{unique_id}.{filename.split('.')[-1]}"
    
    try:
        headers = {
            "Authorization": f"Bearer {VERCEL_API_TOKEN}",
            "X-Store-ID": VERCEL_BLOB_STORE_ID,
            "Content-Type": content_type
        }
        
        async with httpx.AsyncClient() as client:
            # Get upload URL
            upload_response = await client.post(
                f"{VERCEL_BLOB_API_URL}/upload",
                headers=headers,
                json={"contentType": content_type, "multipart": False}
            )
            
            if upload_response.status_code != 200:
                return (False, f"Failed to get upload URL: {upload_response.text}", None)
            
            upload_data = upload_response.json()
            upload_url = upload_data.get("uploadUrl")
            blob_url = upload_data.get("url")
            
            # Upload the data
            put_response = await client.put(
                upload_url,
                headers={"Content-Type": content_type},
                content=data
            )
            
            if put_response.status_code not in (200, 201):
                return (False, f"Failed to upload data: {put_response.text}", None)
            
            return (True, "Upload successful", blob_url)
    except Exception as e:
        return (False, f"Error uploading to Vercel Blob Storage: {str(e)}", None)

async def record_graph_metadata(
    blob_url: str,
    title: str,
    user_id: str,
    workflow_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Record graph metadata in the database
    
    Args:
        blob_url: URL to the stored blob
        title: Title of the graph
        user_id: ID of the user who created the graph
        workflow_id: Optional ID of the associated workflow
        metadata: Optional additional metadata
        
    Returns:
        Tuple of (success, message, record_id if successful)
    """
    try:
        from fastapi_backend.app.graph_storage import insert_analysis_result
        
        # Prepare the metadata
        full_metadata = metadata or {}
        full_metadata.update({
            "title": title,
            "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        
        # Insert the analysis result using our DAL
        success, message, record_id = await insert_analysis_result(
            user_id=user_id,
            analysis_type="visualization",
            result_type="graph",
            storage_type="blob",
            metadata=full_metadata,
            result_location=blob_url,
            large_result_blob_id=None  # We're storing the URL instead of the blob ID
        )
        
        return success, message, record_id
        
    except Exception as e:
        return (False, f"Error recording metadata: {str(e)}", None)

async def store_graph_visualization(
    graph_data: bytes,
    title: str,
    user_id: str,
    workflow_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Store a graph visualization in Vercel Blob Storage and record metadata
    
    Args:
        graph_data: The binary data of the graph visualization
        title: Title of the graph
        user_id: ID of the user who created the graph
        workflow_id: Optional ID of the associated workflow
        metadata: Optional additional metadata
        
    Returns:
        Tuple of (success, message, data if successful)
    """
    # Generate a filename for the graph
    filename = f"graph_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    
    # Store the graph in Vercel Blob Storage
    success, message, blob_url = await store_in_vercel_blob(
        data=graph_data,
        filename=filename,
        content_type="image/png"
    )
    
    if not success:
        return (False, message, None)
    
    # Record metadata in the database
    success, message, record_id = await record_graph_metadata(
        blob_url=blob_url,
        title=title,
        user_id=user_id,
        workflow_id=workflow_id,
        metadata=metadata
    )
    
    if not success:
        return (False, message, None)
    
    return (True, "Graph stored successfully", {
        "id": record_id,
        "url": blob_url,
        "title": title
    })

async def store_plot_visualization(
    plot_data: bytes,
    title: str,
    plot_type: str,
    user_id: str,
    analysis_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Store a visualization plot in Vercel Blob Storage and record metadata
    
    Args:
        plot_data: The binary data of the plot
        title: Title of the plot
        plot_type: Type of the plot (e.g., 'umap', 'violin', etc.)
        user_id: ID of the user who created the plot
        analysis_id: Optional ID of the associated analysis
        metadata: Optional additional metadata
        
    Returns:
        Tuple of (success, message, data if successful)
    """
    # Generate a filename for the plot
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{plot_type}_{timestamp}.png"
    
    # Store the plot in Vercel Blob Storage
    success, message, blob_url = await store_in_vercel_blob(
        data=plot_data,
        filename=filename,
        content_type="image/png"
    )
    
    if not success:
        return (False, message, None)
    
    # Record metadata in the database
    metadata = metadata or {}
    metadata.update({
        "plot_type": plot_type,
        "created_at": timestamp
    })
    
    success, message, record_id = await record_graph_metadata(
        blob_url=blob_url,
        title=title,
        user_id=user_id,
        workflow_id=analysis_id,
        metadata=metadata
    )
    
    if not success:
        return (False, message, None)
    
    return (True, "Plot stored successfully", {
        "id": record_id,
        "url": blob_url,
        "title": title,
        "plot_type": plot_type
    })

def get_last_uploaded_file_info_from_s3():
    """Get information about the last uploaded file in S3"""
    response = s3_client.list_objects_v2(Bucket=global_variables.S3_BUCKET)
    files = response.get("Contents", [])
    if not files:
        return None  # No files in the bucket

    # Sort files by last modified date
    files.sort(key=lambda x: x["LastModified"], reverse=True)
    last_file = files[0]

    # Get the file metadata
    file_name = last_file["Key"]
    file_size_bytes = last_file["Size"]
    last_modified = last_file["LastModified"]

    # Get content type
    head_response = s3_client.head_object(Bucket=global_variables.S3_BUCKET, Key=file_name)
    content_type = head_response.get("ContentType", "")

    def human_readable_size(size_bytes):
        if size_bytes < 1024:
            return f"{size_bytes} Bytes"
        elif size_bytes < 1024**2:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024**3:
            return f"{size_bytes / (1024 ** 2):.2f} MB"
        else:
            return f"{size_bytes / (1024 ** 3):.2f} GB"

    # Size conversion
    file_size_human_readable = human_readable_size(file_size_bytes)

    # Create a formatted string with file information
    file_info_string = (
        f"'FileName': '{file_name}' "
        f"'SizeInBytes': {file_size_bytes} "
        f"'SizeReadable': '{file_size_human_readable}' "
        f"'LastModified': {last_modified} "
        f"'ContentType': '{content_type}'"
    )

    return file_info_string

def delete_html_and_tables_files():
    """Clean up temporary files and directories"""
    tmp_path = os.path.join(global_variables.ROOT_PATH, "web/tmp")
    print(f"\033[92m{global_variables.ROOT_PATH}\033[0m")

    def cleanup_tmp_dir():
        if not os.path.exists(tmp_path):
            try:
                os.makedirs(tmp_path, exist_ok=True)
                print(f"[DEBUG] Created the directory {tmp_path}.")
            except Exception as e:
                print(f"Error while creating the directory {tmp_path}: {e}")
        else:
            print(f"[DEBUG] The {tmp_path} directory already exists, no changes made.")
            # Delete all subdirectories at the first level
            for item in os.listdir(tmp_path):
                item_path = os.path.join(tmp_path, item)
                if os.path.isdir(item_path):
                    try:
                        shutil.rmtree(item_path)
                        print(f"[DEBUG] Deleted directory {item_path}.")
                    except Exception as e:
                        print(f"Error while deleting directory {item_path}: {e}")

    def delete_html_files(tmp_path):
        """Delete HTML files in the temporary directory"""
        if os.path.exists(tmp_path):
            for file in os.listdir(tmp_path):
                if file.endswith(".html"):
                    file_path = os.path.join(tmp_path, file)
                    try:
                        os.remove(file_path)
                        print(f"[DEBUG] Deleted HTML file {file_path}.")
                    except Exception as e:
                        print(f"Error while deleting HTML file {file_path}: {e}")

    def setup_tmp_dir(tmp_path):
        """Set up the temporary directory"""
        try:
            if not os.path.exists(tmp_path):
                os.makedirs(tmp_path)
                print(f"[DEBUG] Created directory {tmp_path}.")
            else:
                print(f"[DEBUG] Directory {tmp_path} already exists.")
        except Exception as e:
            print(f"Error while setting up directory {tmp_path}: {e}")

    def cleanup_tmp_dir(tmp_path):
        """Clean up the temporary directory"""
        try:
            if os.path.exists(tmp_path):
                shutil.rmtree(tmp_path)
                print(f"[DEBUG] Deleted directory {tmp_path}.")
            os.makedirs(tmp_path)
            print(f"[DEBUG] Created new directory {tmp_path}.")
        except Exception as e:
            print(f"Error while cleaning up directory {tmp_path}: {e}")

    # Execute cleanup functions
    cleanup_tmp_dir()
    delete_html_files(tmp_path)
    setup_tmp_dir(tmp_path)

def pre_and_post_process_tool(func):
    """Decorator for handling temporary directory setup and cleanup"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        tmp_path = os.path.join(global_variables.ROOT_PATH, "web/tmp")
        
        # Pre-processing
        setup_tmp_dir(tmp_path)
        
        try:
            # Execute the function
            result = func(*args, **kwargs)
            return result
        except Exception as e:
            print(f"Error in {func.__name__}: {e}")
            raise
        finally:
            # Post-processing
            cleanup_tmp_dir(tmp_path)
    
    return wrapper

@pre_and_post_process_tool
def example_function():
    """Example function using the temporary directory"""
    tmp_path = os.path.join(global_variables.ROOT_PATH, "web/tmp")
    print(f"Working in {tmp_path}")
    return "Example function completed"

@pre_and_post_process_tool
def do_something():
    """Another example function using the temporary directory"""
    tmp_path = os.path.join(global_variables.ROOT_PATH, "web/tmp")
    print(f"Doing something in {tmp_path}")
    return "Operation completed"
