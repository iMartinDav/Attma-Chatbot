"""
Bioflow module for workflow management and analysis in single-cell RNA-seq.

This module provides tools for creating, managing, and executing analysis workflows
for single-cell RNA-seq data.
"""
import logging
from pathlib import Path
import os

logger = logging.getLogger(__name__)

def initialize_bioflow():
    """
    Initialize the bioflow module.
    
    This function sets up necessary directories and configurations for the bioflow module.
    It is called during FastAPI application startup.
    """
    # Create necessary directories
    data_dir = os.getenv("SINGLE_CELL_DATA_DIR", "/tmp/single_cell_data")
    bioflow_dir = Path(data_dir) / "bioflow"
    bioflow_dir.mkdir(parents=True, exist_ok=True)
    
    # Create workflows directory
    workflows_dir = bioflow_dir / "workflows"
    workflows_dir.mkdir(exist_ok=True)
    
    # Create results directory
    results_dir = bioflow_dir / "results"
    results_dir.mkdir(exist_ok=True)
    
    logger.info(f"Bioflow initialized with directory: {bioflow_dir}")
    logger.info(f"Workflows directory: {workflows_dir}")
    logger.info(f"Results directory: {results_dir}")
    
    return {
        "bioflow_dir": str(bioflow_dir),
        "workflows_dir": str(workflows_dir),
        "results_dir": str(results_dir)
    }
