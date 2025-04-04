"""
Data preparation package for single-cell analysis.

This package provides utilities for loading, preprocessing, and preparing
single-cell RNA-seq data for analysis.
"""
import logging
from pathlib import Path
import os

logger = logging.getLogger(__name__)

def initialize_dataprep():
    """
    Initialize the dataprep module.
    
    This function sets up necessary directories and configurations for the dataprep module.
    It is called during FastAPI application startup.
    """
    # Create necessary directories
    data_dir = os.getenv("SINGLE_CELL_DATA_DIR", "/tmp/single_cell_data")
    Path(data_dir).mkdir(parents=True, exist_ok=True)
    
    # Create cache directory
    cache_dir = Path(data_dir) / "cache"
    cache_dir.mkdir(exist_ok=True)
    
    # Create data output directory
    output_dir = Path(data_dir) / "output"
    output_dir.mkdir(exist_ok=True)
    
    logger.info(f"Dataprep initialized with data directory: {data_dir}")
    logger.info(f"Cache directory: {cache_dir}")
    logger.info(f"Output directory: {output_dir}")
    
    return {
        "data_dir": str(data_dir),
        "cache_dir": str(cache_dir),
        "output_dir": str(output_dir)
    }
