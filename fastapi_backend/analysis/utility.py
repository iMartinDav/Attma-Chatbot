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

# AWS S3 Configuration
s3_client = boto3.client(
    "s3",
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    region_name=os.environ.get("AWS_REGION", global_variables.AWS_REGION),
)

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
