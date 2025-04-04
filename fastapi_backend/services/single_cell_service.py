import os
import tempfile
import zipfile
import uuid
import scanpy as sc
import numpy as np
import pandas as pd
import anndata as ad
from typing import Dict, List, Optional, Union, Tuple, Any
import boto3
from scipy import sparse
import json

import plotly.express as px
import plotly.graph_objects as go
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server deployment

from anndata import AnnData

from fastapi_backend.utils.logging import get_logger
from fastapi_backend.utils.exceptions import (
    DataLoadingError, 
    InvalidDataFormatError, 
    AnalysisError, 
    ResourceNotFoundError,
    S3OperationError,
    PlottingError
)
from fastapi_backend.utils.cache import cached, cache

# Configure logger for this module
logger = get_logger(__name__)


class SingleCellService:
    """
    Service for single-cell RNA-seq analysis, replacing the R-based Seurat functionality
    with Python-based scanpy functionality.
    """
    
    def __init__(self, data_dir: str = "/tmp/fastapi_data", s3_bucket: Optional[str] = None):
        self.data_dir = data_dir
        self.s3_bucket = s3_bucket
        self.cache_dir = os.path.join(data_dir, "cache")
        self.results_dir = os.path.join(data_dir, "results")
        self.plots_dir = os.path.join(data_dir, "plots")
        self._setup_directories()
        self._cache = {}
        self._results = {}
        self._plots = {}
        self._summaries = {}
        
    def _setup_directories(self):
        """Create necessary directories if they don't exist."""
        for directory in [self.data_dir, self.cache_dir, self.results_dir, self.plots_dir]:
            os.makedirs(directory, exist_ok=True)
            
    def _get_call_signature(self, function_name: str, args: Dict[str, Any]) -> str:
        """Generate a unique signature for a function call."""
        # Sort args to ensure consistent ordering
        sorted_args = sorted(args.items())
        args_str = ", ".join(f"{k}={v}" for k, v in sorted_args)
        return f"{function_name}({args_str})"
        
    def _is_cached(self, call_signature: str) -> bool:
        """Check if a function call is cached."""
        return call_signature in self._cache
        
    def _add_to_cache(self, call_signature: str, result: Any):
        """Add a result to the cache."""
        self._cache[call_signature] = result
        
    def _get_cached_result(self, call_signature: str) -> Any:
        """Retrieve a cached result."""
        return self._cache.get(call_signature)
        
    def _add_result(self, call_signature: str, result: Any, plot: Optional[Any] = None, summary: Optional[str] = None):
        """Add a result, plot, and summary to storage."""
        self._results[call_signature] = result
        if plot is not None:
            self._plots[call_signature] = plot
        if summary is not None:
            self._summaries[call_signature] = summary
            
    def _get_result(self, call_signature: str, plot: bool = False) -> Any:
        """Retrieve a result, optionally with its plot."""
        if plot and call_signature in self._plots:
            return self._plots[call_signature]
        return self._results.get(call_signature)
        
    def _save_plot(self, plot: Any, filename: str, format: str = "html"):
        """Save a plot to file."""
        filepath = os.path.join(self.plots_dir, filename)
        if format == "html":
            plot.write_html(filepath)
        else:
            plot.write_image(filepath)
            
    def _clear_cache(self):
        """Clear all cached data."""
        self._cache.clear()
        self._results.clear()
        self._plots.clear()
        self._summaries.clear()
        
    def _get_plot_path(self, plot_id: str) -> str:
        """Get the path to a saved plot."""
        return os.path.join(self.plots_dir, f"{plot_id}.html")
        
    def _get_result_path(self, result_id: str) -> str:
        """Get the path to a saved result."""
        return os.path.join(self.results_dir, f"{result_id}.json")
        
    def _save_result(self, result: Any, result_id: str):
        """Save a result to file."""
        filepath = self._get_result_path(result_id)
        with open(filepath, 'w') as f:
            json.dump(result, f)
            
    def _load_result(self, result_id: str) -> Any:
        """Load a result from file."""
        filepath = self._get_result_path(result_id)
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return None
    
    def _get_adata(self, adata_id: str) -> AnnData:
        """
        Get the AnnData object with the given ID.
        
        Args:
            adata_id: The ID of the AnnData object to get
            
        Returns:
            The AnnData object
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
        """
        if adata_id not in self.adata_dict:
            # Check if the file exists on disk
            filepath = os.path.join(self.data_dir, f"{adata_id}.h5ad")
            if os.path.exists(filepath):
                self.adata_dict[adata_id] = sc.read_h5ad(filepath)
            else:
                raise ResourceNotFoundError(f"AnnData object with ID {adata_id} not found")
        return self.adata_dict[adata_id]
    
    def _save_adata(self, adata: AnnData, adata_id: Optional[str] = None) -> str:
        """
        Save an AnnData object and return its ID.
        
        Args:
            adata: The AnnData object to save
            adata_id: Optional ID of the saved AnnData object
            
        Returns:
            The ID of the saved AnnData object
        """
        if adata_id is None:
            adata_id = str(uuid.uuid4())
        self.adata_dict[adata_id] = adata
        
        # Save to disk
        filepath = os.path.join(self.data_dir, f"{adata_id}.h5ad")
        adata.write_h5ad(filepath)
        
        return adata_id
    
    def download_s3_file(self, object_key: str, target_dir: Optional[str] = None) -> str:
        """
        Download a file from S3.
        
        Args:
            object_key: The S3 object key
            target_dir: The directory to save the file to (default: temporary directory)
            
        Returns:
            The path to the downloaded file
            
        Raises:
            S3OperationError: If the download fails
        """
        if not self.s3_client:
            raise S3OperationError("S3 client not initialized")
        
        if target_dir is None:
            target_dir = tempfile.mkdtemp()
        else:
            os.makedirs(target_dir, exist_ok=True)
            
        local_file_path = os.path.join(target_dir, os.path.basename(object_key))
        
        try:
            logger.info(f"Downloading {object_key} from {self.s3_bucket} to {local_file_path}")
            self.s3_client.download_file(self.s3_bucket, object_key, local_file_path)
            return local_file_path
        except Exception as e:
            raise S3OperationError(f"Failed to download file from S3: {e}")
    
    @cached()
    def load_single_cell_data(
        self, 
        data_path: str, 
        project_name: str,
        metadata_path: Optional[str] = None,
        coordinates_path: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Load single-cell data from various formats into an AnnData object.
        Equivalent to the 'create_seurat_object' function in R.
        
        Args:
            data_path: Path to the data file or directory
            project_name: Name of the project
            metadata_path: Path to metadata file (optional)
            coordinates_path: Path to coordinates file (optional)
            
        Returns:
            Tuple containing:
                - The ID of the loaded AnnData object
                - A summary dictionary with metadata about the dataset
                
        Raises:
            DataLoadingError: If data loading fails
            InvalidDataFormatError: If the data format is not supported
        """
        logger.info(f"Loading single-cell data from {data_path}")
        
        if not os.path.exists(data_path):
            raise DataLoadingError(f"File or directory doesn't exist: {data_path}")
        
        adata = None
        
        # Check if it's a ZIP file and extract if needed
        if data_path.lower().endswith('.zip'):
            extract_dir = os.path.join(self.data_dir, os.path.basename(data_path).replace('.zip', ''))
            os.makedirs(extract_dir, exist_ok=True)
            
            logger.info(f"Extracting ZIP file to {extract_dir}")
            with zipfile.ZipFile(data_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            data_path = extract_dir
        
        # Check if it's a directory with 10X data
        if os.path.isdir(data_path):
            logger.info(f"Reading 10X data from directory: {data_path}")
            try:
                # Look for matrix files in the directory
                matrix_file = None
                for f in os.listdir(data_path):
                    if f.lower() == 'matrix.mtx' or f.lower() == 'matrix.mtx.gz':
                        matrix_file = f
                        break
                
                if matrix_file:
                    # Read as 10X data
                    adata = sc.read_10x_mtx(
                        data_path,
                        var_names='gene_symbols',
                        cache=True
                    )
                else:
                    # Try reading other formats
                    h5_files = [f for f in os.listdir(data_path) if f.lower().endswith(('.h5', '.h5ad'))]
                    if h5_files:
                        h5_path = os.path.join(data_path, h5_files[0])
                        if h5_path.lower().endswith('.h5ad'):
                            adata = sc.read_h5ad(h5_path)
                        else:
                            adata = sc.read_10x_h5(h5_path)
            except Exception as e:
                raise DataLoadingError(f"Failed to read 10X data from directory: {e}")
        
        # Check if it's an h5ad file
        elif data_path.lower().endswith('.h5ad'):
            logger.info(f"Reading H5AD file: {data_path}")
            try:
                adata = sc.read_h5ad(data_path)
            except Exception as e:
                raise DataLoadingError(f"Failed to read H5AD file: {e}")
        
        # Check if it's an h5 file
        elif data_path.lower().endswith(('.h5', '.hdf5', '.hdf')):
            logger.info(f"Reading H5 file: {data_path}")
            try:
                adata = sc.read_10x_h5(data_path)
            except Exception as e:
                raise DataLoadingError(f"Failed to read H5 file: {e}")
        
        # Otherwise assume it's a matrix file
        else:
            logger.info(f"Reading matrix file: {data_path}")
            try:
                if data_path.lower().endswith('.mtx') or data_path.lower().endswith('.mtx.gz'):
                    # Read as sparse matrix
                    dir_path = os.path.dirname(data_path)
                    basename = os.path.basename(data_path)
                    
                    # Check for barcodes and features files
                    barcodes_file = None
                    features_file = None
                    for f in os.listdir(dir_path):
                        if f.lower() in ('barcodes.tsv', 'barcodes.tsv.gz'):
                            barcodes_file = f
                        elif f.lower() in ('features.tsv', 'genes.tsv', 'features.tsv.gz', 'genes.tsv.gz'):
                            features_file = f
                    
                    if barcodes_file and features_file:
                        adata = sc.read_mtx(os.path.join(dir_path, basename))
                        # Read barcodes (cell names)
                        barcodes = pd.read_csv(os.path.join(dir_path, barcodes_file), header=None)[0].values
                        adata.obs_names = barcodes
                        
                        # Read features (gene names)
                        features = pd.read_csv(os.path.join(dir_path, features_file), header=None, sep='\t')
                        if features.shape[1] > 1:
                            # If multiple columns, use second column as gene symbols
                            gene_ids = features[0].values
                            gene_symbols = features[1].values
                            adata.var_names = gene_symbols
                            adata.var['gene_ids'] = gene_ids
                        else:
                            adata.var_names = features[0].values
                    else:
                        raise DataLoadingError("Cannot find barcodes.tsv and features.tsv files")
                else:
                    # Read as regular matrix
                    df = pd.read_csv(data_path, sep='\t', index_col=0)
                    adata = ad.AnnData(df.T)  # Transpose to get cells as rows
            except Exception as e:
                raise DataLoadingError(f"Failed to read matrix file: {e}")
        
        if adata is None:
            raise InvalidDataFormatError("Unsupported file format")
        
        # Add project name to the AnnData object
        adata.uns['project'] = project_name
        
        # Load metadata if provided
        if metadata_path and os.path.exists(metadata_path):
            logger.info(f"Loading metadata from {metadata_path}")
            try:
                metadata = pd.read_csv(metadata_path, sep='\t', index_col=0)
                for col in metadata.columns:
                    adata.obs[col] = metadata.loc[adata.obs_names, col].values
            except Exception as e:
                logger.warning(f"Failed to load metadata: {e}")
        
        # Load coordinates if provided
        if coordinates_path and os.path.exists(coordinates_path):
            logger.info(f"Loading coordinates from {coordinates_path}")
            try:
                coordinates = pd.read_csv(coordinates_path, sep='\t', header=None)
                if coordinates.shape[1] >= 3:  # cell_id, x, y
                    coords_df = coordinates.set_index(0)
                    # Check if all cells are in the dataset
                    common_cells = set(coords_df.index).intersection(set(adata.obs_names))
                    if len(common_cells) < len(adata.obs_names):
                        logger.warning(f"Missing cells in coordinates file. Only {len(common_cells)} of {len(adata.obs_names)} cells have coordinates.")
                    
                    if len(common_cells) > 0:
                        # Create a new dataframe with the coordinates of common cells
                        coords_subset = coords_df.loc[list(common_cells)]
                        
                        # Create embedding
                        adata.obsm['X_tsne'] = coords_subset[[1, 2]].values
            except Exception as e:
                logger.warning(f"Failed to load coordinates: {e}")
        
        # Calculate basic stats for summary
        n_cells = adata.n_obs
        n_genes = adata.n_vars
        total_counts = adata.X.sum()
        counts_per_cell = adata.X.sum(axis=1)
        counts_per_gene = adata.X.sum(axis=0)
        
        # Create summary
        summary = {
            'project': project_name,
            'n_cells': n_cells,
            'n_genes': n_genes,
            'total_counts': float(total_counts),
            'median_counts_per_cell': float(np.median(counts_per_cell)),
            'median_genes_per_cell': float(np.median((adata.X > 0).sum(axis=1))),
            'source_file': data_path
        }
        
        # Save the AnnData object
        adata_id = self._save_adata(adata)
        
        logger.info(f"Successfully loaded data with {n_cells} cells and {n_genes} genes")
        return adata_id, summary
    
    @cached()
    def subset_randomly(self, adata_id: str, subset_size: int) -> Tuple[str, Dict[str, Any]]:
        """
        Subset an AnnData object by randomly selecting a specified number of cells.
        Equivalent to the 'subset_seurat_obj' function in R.
        
        Args:
            adata_id: The ID of the AnnData object to subset
            subset_size: The number of cells to include in the subset
            
        Returns:
            Tuple containing:
                - The ID of the subsetted AnnData object
                - A summary dictionary with metadata about the subset
                
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If subset_size is greater than the number of cells
        """
        logger.info(f"Subsetting AnnData {adata_id} to {subset_size} cells")
        
        # Get the original AnnData object
        adata = self._get_adata(adata_id)
        
        if subset_size >= adata.n_obs:
            logger.warning(f"Subset size {subset_size} is greater than the number of cells {adata.n_obs}")
            return adata_id, {"n_cells": adata.n_obs, "message": "No subsetting performed"}
        
        # Randomly select cells
        np.random.seed(42)  # For reproducibility
        indices = np.random.choice(adata.n_obs, subset_size, replace=False)
        adata_subset = adata[indices].copy()
        
        # Create summary
        summary = {
            'original_n_cells': adata.n_obs,
            'subset_n_cells': adata_subset.n_obs,
            'subset_size': subset_size
        }
        
        # Save the subsetted AnnData object
        new_adata_id = self._save_adata(adata_subset)
        
        logger.info(f"Successfully subsetted data to {subset_size} cells")
        return new_adata_id, summary
    
    @cached()
    def filter_features(self, adata_id: str, features: List[str]) -> Tuple[str, Dict[str, Any]]:
        """
        Filter an AnnData object to keep only specified features (genes).
        Equivalent to the 'filter_seurat_obj_features' function in R.
        
        Args:
            adata_id: The ID of the AnnData object to filter
            features: List of feature (gene) names to keep
            
        Returns:
            Tuple containing:
                - The ID of the filtered AnnData object
                - A summary dictionary with metadata about the filtering
                
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If no features are found
        """
        logger.info(f"Filtering AnnData {adata_id} to keep {len(features)} features")
        
        # Get the original AnnData object
        adata = self._get_adata(adata_id)
        
        # Find the intersection of requested features and available features
        features_to_keep = [f for f in features if f in adata.var_names]
        
        if not features_to_keep:
            raise ValueError("None of the specified features were found in the data")
        
        if len(features_to_keep) < len(features):
            logger.warning(f"Only {len(features_to_keep)} of {len(features)} requested features were found")
        
        # Subset the AnnData object to keep only the specified features
        adata_subset = adata[:, features_to_keep].copy()
        
        # Create summary
        summary = {
            'original_n_features': adata.n_vars,
            'filtered_n_features': adata_subset.n_vars,
            'requested_features': len(features),
            'kept_features': len(features_to_keep)
        }
        
        # Save the filtered AnnData object
        new_adata_id = self._save_adata(adata_subset)
        
        logger.info(f"Successfully filtered data to {len(features_to_keep)} features")
        return new_adata_id, summary
    
    @cached()
    def filter_by_metadata(
        self, 
        adata_id: str, 
        column: str, 
        values: List[Any]
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Filter an AnnData object based on metadata column values.
        Equivalent to the 'filter_seurat_by_metadata' function in R.
        
        Args:
            adata_id: The ID of the AnnData object to filter
            column: The metadata column to filter on
            values: The values to keep
            
        Returns:
            Tuple containing:
                - The ID of the filtered AnnData object
                - A summary dictionary with metadata about the filtering
                
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If the metadata column doesn't exist
        """
        logger.info(f"Filtering AnnData {adata_id} by metadata column {column}")
        
        # Get the original AnnData object
        adata = self._get_adata(adata_id)
        
        # Check if the column exists
        if column not in adata.obs.columns:
            raise ValueError(f"Metadata column '{column}' not found")
        
        # Create a boolean mask for the cells to keep
        mask = adata.obs[column].isin(values)
        
        if not mask.any():
            raise ValueError(f"No cells match the specified values for column '{column}'")
        
        # Subset the AnnData object
        adata_subset = adata[mask].copy()
        
        # Create summary
        summary = {
            'original_n_cells': adata.n_obs,
            'filtered_n_cells': adata_subset.n_obs,
            'filter_column': column,
            'filter_values': values
        }
        
        # Save the filtered AnnData object
        new_adata_id = self._save_adata(adata_subset)
        
        logger.info(f"Successfully filtered data to {adata_subset.n_obs} cells")
        return new_adata_id, summary
    
    @cached()
    def exclude_features(self, adata_id: str, features: List[str]) -> Tuple[str, Dict[str, Any]]:
        """
        Filter an AnnData object to exclude specified features (genes).
        Equivalent to the 'exclude_seurat_obj_features' function in R.
        
        Args:
            adata_id: The ID of the AnnData object to filter
            features: List of feature (gene) names to exclude
            
        Returns:
            Tuple containing:
                - The ID of the filtered AnnData object
                - A summary dictionary with metadata about the filtering
                
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
        """
        logger.info(f"Excluding {len(features)} features from AnnData {adata_id}")
        
        # Get the original AnnData object
        adata = self._get_adata(adata_id)
        
        # Find the features to exclude that are actually in the data
        features_to_exclude = [f for f in features if f in adata.var_names]
        
        if not features_to_exclude:
            logger.warning("None of the specified features to exclude were found in the data")
            return adata_id, {"n_features": adata.n_vars, "message": "No features excluded"}
        
        # Create a boolean mask for the features to keep
        mask = ~adata.var_names.isin(features_to_exclude)
        
        # Subset the AnnData object
        adata_subset = adata[:, mask].copy()
        
        # Create summary
        summary = {
            'original_n_features': adata.n_vars,
            'filtered_n_features': adata_subset.n_vars,
            'excluded_features': len(features_to_exclude)
        }
        
        # Save the filtered AnnData object
        new_adata_id = self._save_adata(adata_subset)
        
        logger.info(f"Successfully excluded {len(features_to_exclude)} features")
        return new_adata_id, summary
        
    def calculate_qc_metrics(self, adata_id: str, mito_pattern: str = "^MT-") -> Dict[str, Any]:
        """Calculate quality control metrics for an AnnData object."""
        call_signature = self._get_call_signature('calculate_qc_metrics', {'adata_id': adata_id, 'mito_pattern': mito_pattern})
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Calculate mitochondrial percentage
        sc.pp.calculate_qc_metrics(adata, inplace=True, percent_top=None, log1p=False, mito_pattern=mito_pattern)
        
        # Calculate additional metrics
        metrics = {
            'n_cells': adata.n_obs,
            'n_genes': adata.n_vars,
            'total_counts': float(adata.obs['total_counts'].mean()),
            'n_genes_by_counts': float(adata.obs['n_genes_by_counts'].mean()),
            'pct_counts_in_top_50_genes': float(adata.obs['pct_counts_in_top_50_genes'].mean()),
            'pct_counts_mt': float(adata.obs['pct_counts_mt'].mean()),
            'pct_counts_ribo': float(adata.obs['pct_counts_ribo'].mean()),
            'pct_counts_hb': float(adata.obs['pct_counts_hb'].mean()),
            'n_counts': float(adata.obs['n_counts'].mean())
        }
        
        self._add_to_cache(call_signature, metrics)
        return metrics
        
    def filter_cells_by_qc(self, adata_id: str, 
                          min_genes: Optional[int] = None,
                          max_genes: Optional[int] = None,
                          min_counts: Optional[int] = None,
                          max_counts: Optional[int] = None,
                          max_pct_mt: Optional[float] = None) -> str:
        """Filter cells based on QC metrics."""
        call_signature = self._get_call_signature('filter_cells_by_qc', {
            'adata_id': adata_id,
            'min_genes': min_genes,
            'max_genes': max_genes,
            'min_counts': min_counts,
            'max_counts': max_counts,
            'max_pct_mt': max_pct_mt
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Calculate QC metrics if not already done
        if 'n_genes_by_counts' not in adata.obs.columns:
            self.calculate_qc_metrics(adata_id)
            
        # Create filter mask
        mask = np.ones(adata.n_obs, dtype=bool)
        
        if min_genes is not None:
            mask &= adata.obs['n_genes_by_counts'] >= min_genes
        if max_genes is not None:
            mask &= adata.obs['n_genes_by_counts'] <= max_genes
        if min_counts is not None:
            mask &= adata.obs['total_counts'] >= min_counts
        if max_counts is not None:
            mask &= adata.obs['total_counts'] <= max_counts
        if max_pct_mt is not None:
            mask &= adata.obs['pct_counts_mt'] <= max_pct_mt
            
        # Filter the AnnData object
        adata = adata[mask].copy()
        
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
        
    def normalize_data(self, adata_id: str, 
                      method: str = "log",
                      scale_factor: float = 10000.0,
                      log1p: bool = True,
                      highly_variable: bool = True) -> str:
        """Normalize the data in an AnnData object."""
        call_signature = self._get_call_signature('normalize_data', {
            'adata_id': adata_id,
            'method': method,
            'scale_factor': scale_factor,
            'log1p': log1p,
            'highly_variable': highly_variable
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Normalize
        if method == "log":
            sc.pp.normalize_total(adata, target_sum=scale_factor)
            if log1p:
                sc.pp.log1p(adata)
        elif method == "sct":
            sc.pp.normalize_total(adata, target_sum=scale_factor)
            sc.pp.log1p(adata)
            sc.pp.scale(adata, max_value=10)
            
        # Find highly variable genes if requested
        if highly_variable:
            sc.pp.highly_variable_genes(adata, min_mean=0.0125, max_mean=3, min_disp=0.5)
            adata = adata[:, adata.var.highly_variable].copy()
            
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
        
    def scale_data(self, adata_id: str,
                  zero_center: bool = True,
                  max_value: Optional[float] = None,
                  regress_out: Optional[List[str]] = None) -> str:
        """Scale the data in an AnnData object."""
        call_signature = self._get_call_signature('scale_data', {
            'adata_id': adata_id,
            'zero_center': zero_center,
            'max_value': max_value,
            'regress_out': regress_out
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Scale the data
        sc.pp.scale(adata, zero_center=zero_center, max_value=max_value)
        
        # Regress out variables if specified
        if regress_out:
            sc.pp.regress_out(adata, regress_out)
            
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
    
    @cached()
    def find_highly_variable_genes(
        self, 
        adata_id: str, 
        n_top_genes: int = 2000,
        flavor: str = 'seurat',
        min_mean: float = 0.0125,
        max_mean: float = 3,
        min_disp: float = 0.5
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Find highly variable genes in the dataset.
        Equivalent to the 'highly_variable_genes' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            n_top_genes: Number of top genes to keep
            flavor: Method to use ('seurat' or 'cell_ranger')
            min_mean: Minimum mean expression
            max_mean: Maximum mean expression
            min_disp: Minimum dispersion
            
        Returns:
            Tuple containing:
                - The ID of the AnnData object with highly variable genes
                - A summary dictionary with details about the selected genes
                
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
        """
        logger.info(f"Finding highly variable genes for AnnData {adata_id}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Make sure the data is normalized
        if 'normalization' not in adata.uns:
            logger.warning("Data not normalized. Highly variable gene detection works best on normalized data.")
        
        # Find highly variable genes
        sc.pp.highly_variable_genes(
            adata,
            n_top_genes=n_top_genes,
            flavor=flavor,
            min_mean=min_mean,
            max_mean=max_mean,
            min_disp=min_disp
        )
        
        # Get the number of selected genes
        n_highly_variable = sum(adata.var['highly_variable'])
        
        # Create summary
        summary = {
            'n_highly_variable': int(n_highly_variable),
            'n_top_genes': n_top_genes,
            'flavor': flavor,
            'min_mean': min_mean,
            'max_mean': max_mean,
            'min_disp': min_disp,
            'highly_variable_genes': adata.var_names[adata.var['highly_variable']].tolist()[:10] + 
                                    ['...'] + 
                                    adata.var_names[adata.var['highly_variable']].tolist()[-10:]
        }
        
        # Save the AnnData object with highly variable genes
        new_adata_id = self._save_adata(adata)
        
        logger.info(f"Successfully identified {n_highly_variable} highly variable genes")
        return new_adata_id, summary
    
    def run_pca(self, adata_id: str,
                n_comps: int = 50,
                use_highly_variable: bool = True,
                svd_solver: str = "arpack") -> str:
        """Run PCA on an AnnData object."""
        call_signature = self._get_call_signature('run_pca', {
            'adata_id': adata_id,
            'n_comps': n_comps,
            'use_highly_variable': use_highly_variable,
            'svd_solver': svd_solver
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Run PCA
        sc.tl.pca(adata, 
                 n_comps=n_comps,
                 use_highly_variable=use_highly_variable,
                 svd_solver=svd_solver)
        
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
        
    def run_umap(self, adata_id: str,
                 n_neighbors: int = 15,
                 min_dist: float = 0.5,
                 spread: float = 1.0,
                 n_components: int = 2,
                 use_pca: bool = True) -> str:
        """Run UMAP on an AnnData object."""
        call_signature = self._get_call_signature('run_umap', {
            'adata_id': adata_id,
            'n_neighbors': n_neighbors,
            'min_dist': min_dist,
            'spread': spread,
            'n_components': n_components,
            'use_pca': use_pca
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Run UMAP
        sc.tl.umap(adata,
                  n_neighbors=n_neighbors,
                  min_dist=min_dist,
                  spread=spread,
                  n_components=n_components,
                  use_rep='X_pca' if use_pca else None)
        
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
        
    def run_tsne(self, adata_id: str,
                 perplexity: float = 30,
                 early_exaggeration: float = 12,
                 learning_rate: float = 1000,
                 n_jobs: int = -1,
                 use_pca: bool = True) -> str:
        """Run t-SNE on an AnnData object."""
        call_signature = self._get_call_signature('run_tsne', {
            'adata_id': adata_id,
            'perplexity': perplexity,
            'early_exaggeration': early_exaggeration,
            'learning_rate': learning_rate,
            'n_jobs': n_jobs,
            'use_pca': use_pca
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Run t-SNE
        sc.tl.tsne(adata,
                  perplexity=perplexity,
                  early_exaggeration=early_exaggeration,
                  learning_rate=learning_rate,
                  n_jobs=n_jobs,
                  use_rep='X_pca' if use_pca else None)
        
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
        
    def compute_neighbors(self, adata_id: str,
                         n_neighbors: int = 15,
                         n_pcs: int = 50,
                         use_rep: str = "X_pca",
                         metric: str = "euclidean") -> str:
        """Compute the neighborhood graph of cells."""
        call_signature = self._get_call_signature('compute_neighbors', {
            'adata_id': adata_id,
            'n_neighbors': n_neighbors,
            'n_pcs': n_pcs,
            'use_rep': use_rep,
            'metric': metric
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Compute neighbors
        sc.pp.neighbors(adata,
                       n_neighbors=n_neighbors,
                       n_pcs=n_pcs,
                       use_rep=use_rep,
                       metric=metric)
        
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
        
    def run_clustering(self, adata_id: str,
                      method: str = "leiden",
                      resolution: float = 0.5,
                      n_clusters: Optional[int] = None,
                      key_added: str = "clusters") -> str:
        """Run clustering on the neighborhood graph."""
        call_signature = self._get_call_signature('run_clustering', {
            'adata_id': adata_id,
            'method': method,
            'resolution': resolution,
            'n_clusters': n_clusters,
            'key_added': key_added
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Run clustering
        if method == "leiden":
            sc.tl.leiden(adata,
                        resolution=resolution,
                        key_added=key_added)
        elif method == "louvain":
            sc.tl.louvain(adata,
                         resolution=resolution,
                         key_added=key_added)
        elif method == "kmeans":
            if n_clusters is None:
                raise ValueError("n_clusters must be specified for k-means clustering")
            sc.tl.kmeans(adata,
                        n_clusters=n_clusters,
                        key_added=key_added)
        else:
            raise ValueError(f"Unsupported clustering method: {method}")
        
        # Generate new ID and save
        new_id = str(uuid.uuid4())
        self._save_adata(adata, new_id)
        
        self._add_to_cache(call_signature, new_id)
        return new_id
    
    @cached()
    def plot_violin_mitochondrial_genes(
        self,
        adata_id: str,
        groupby: Optional[str] = None,
        figsize: Tuple[int, int] = (10, 6),
        save_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Plot the percentage of mitochondrial genes across cells.
        Equivalent to the 'plot_violin_mitochondrial_genes' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            groupby: Column in adata.obs to group cells by
            figsize: Figure size (width, height)
            save_path: Path to save the plot to
            
        Returns:
            Dictionary with the plot details
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If 'pct_counts_mt' is not in adata.obs
            ValueError: If groupby is specified but not found in adata.obs
        """
        logger.info(f"Plotting violin plot of mitochondrial genes for AnnData {adata_id}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Check if mitochondrial percentage has been calculated
        if 'pct_counts_mt' not in adata.obs:
            raise ValueError("Mitochondrial percentage not found. Run calculate_qc_metrics first.")
            
        # Check if groupby is valid
        if groupby is not None and groupby not in adata.obs:
            raise ValueError(f"Group variable '{groupby}' not found in the data.")
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Plot violin
        sc.pl.violin(
            adata,
            keys='pct_counts_mt',
            groupby=groupby,
            show=False
        )
        
        # Save the plot if requested
        if save_path:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        # Get the plot as a PNG
        import io
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
        
        canvas = FigureCanvas(plt.gcf())
        buffer = io.BytesIO()
        canvas.print_png(buffer)
        
        # Create a unique signature for this plot
        plot_id = str(uuid.uuid4())
        
        # Store the plot in the cache
        signature = f"plot_violin_mitochondrial_genes_{plot_id}"
        cache.add_call(self.plot_violin_mitochondrial_genes, (adata_id, groupby, figsize, save_path), {})
        
        # Close the figure to free memory
        plt.close()
        
        # Return plot details
        return {
            'plot_id': plot_id,
            'plot_type': 'violin_plot',
            'variable': 'pct_counts_mt',
            'groupby': groupby,
            'n_cells': adata.n_obs,
            'plot_data': buffer.getvalue()
        }
    
    @cached()
    def plot_embedding(
        self,
        adata_id: str,
        basis: str = 'umap',
        color: Optional[Union[str, List[str]]] = None,
        groups: Optional[List[str]] = None,
        figsize: Tuple[int, int] = (10, 6),
        save_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Plot embeddings (t-SNE, UMAP, PCA) with optional coloring.
        Equivalent to the 'plot_embedding' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            basis: Embedding to plot ('umap', 'tsne', or 'pca')
            color: Keys for coloring cells
            groups: Subset of groups to plot
            figsize: Figure size (width, height)
            save_path: Path to save the plot to
            
        Returns:
            Dictionary with the plot details
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If the requested embedding is not available
            ValueError: If a coloring variable is not found
        """
        logger.info(f"Plotting {basis} embedding for AnnData {adata_id}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Check if the embedding exists
        embedding_key = f'X_{basis}'
        if embedding_key not in adata.obsm:
            raise ValueError(f"Embedding '{basis}' not found. Run run_{basis} first.")
            
        # Validate color keys
        if color:
            if isinstance(color, str):
                color = [color]
                
            for c in color:
                if c not in adata.obs and c not in adata.var_names:
                    raise ValueError(f"Color variable '{c}' not found in the data.")
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Plot embedding
        sc.pl.embedding(
            adata,
            basis=basis,
            color=color,
            groups=groups,
            show=False
        )
        
        # Save the plot if requested
        if save_path:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        # Get the plot as a PNG
        import io
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
        
        canvas = FigureCanvas(plt.gcf())
        buffer = io.BytesIO()
        canvas.print_png(buffer)
        
        # Create a unique signature for this plot
        plot_id = str(uuid.uuid4())
        
        # Store the plot in the cache
        signature = f"plot_embedding_{plot_id}"
        cache.add_call(self.plot_embedding, (adata_id, basis, color, groups, figsize, save_path), {})
        
        # Close the figure to free memory
        plt.close()
        
        # Return plot details
        return {
            'plot_id': plot_id,
            'plot_type': 'embedding',
            'basis': basis,
            'color': color,
            'groups': groups,
            'n_cells': adata.n_obs,
            'plot_data': buffer.getvalue()
        }
    
    @cached()
    def plot_highly_variable_genes(
        self,
        adata_id: str,
        figsize: Tuple[int, int] = (10, 6),
        save_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Plot highly variable genes.
        Equivalent to the 'plot_highly_variable_genes' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            figsize: Figure size (width, height)
            save_path: Path to save the plot to
            
        Returns:
            Dictionary with the plot details
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If highly variable genes have not been calculated
        """
        logger.info(f"Plotting highly variable genes for AnnData {adata_id}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Check if highly variable genes have been calculated
        if 'highly_variable' not in adata.var:
            raise ValueError("Highly variable genes not found. Run find_highly_variable_genes first.")
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Plot highly variable genes
        sc.pl.highly_variable_genes(
            adata,
            show=False
        )
        
        # Save the plot if requested
        if save_path:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        # Get the plot as a PNG
        import io
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
        
        canvas = FigureCanvas(plt.gcf())
        buffer = io.BytesIO()
        canvas.print_png(buffer)
        
        # Create a unique signature for this plot
        plot_id = str(uuid.uuid4())
        
        # Store the plot in the cache
        signature = f"plot_highly_variable_genes_{plot_id}"
        cache.add_call(self.plot_highly_variable_genes, (adata_id, figsize, save_path), {})
        
        # Close the figure to free memory
        plt.close()
        
        # Return plot details
        return {
            'plot_id': plot_id,
            'plot_type': 'highly_variable_genes',
            'n_highly_variable': int(sum(adata.var['highly_variable'])),
            'plot_data': buffer.getvalue()
        }
    
    @cached()
    def plot_pca_variance(
        self,
        adata_id: str,
        n_pcs: int = 30,
        figsize: Tuple[int, int] = (10, 6),
        save_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Plot the explained variance of PCA components.
        Equivalent to the 'plot_pca_elbow' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            n_pcs: Number of principal components to show
            figsize: Figure size (width, height)
            save_path: Path to save the plot to
            
        Returns:
            Dictionary with the plot details
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If PCA has not been run
        """
        logger.info(f"Plotting PCA variance for AnnData {adata_id}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Check if PCA has been run
        if 'pca' not in adata.uns:
            raise ValueError("PCA not found. Run run_pca first.")
        
        # Get the variance ratio
        variance_ratio = adata.uns['pca']['variance_ratio'][:n_pcs]
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Plot elbow
        plt.plot(range(1, len(variance_ratio) + 1), variance_ratio, 'o-')
        plt.xlabel('PC')
        plt.ylabel('Explained Variance Ratio')
        plt.title('PCA Explained Variance')
        plt.xticks(range(1, len(variance_ratio) + 1))
        plt.axhline(y=0, color='gray', linestyle='-', alpha=0.3)
        plt.grid(True, alpha=0.3)
        
        # Save the plot if requested
        if save_path:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        # Get the plot as a PNG
        import io
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
        
        canvas = FigureCanvas(plt.gcf())
        buffer = io.BytesIO()
        canvas.print_png(buffer)
        
        # Create a unique signature for this plot
        plot_id = str(uuid.uuid4())
        
        # Store the plot in the cache
        signature = f"plot_pca_variance_{plot_id}"
        cache.add_call(self.plot_pca_variance, (adata_id, n_pcs, figsize, save_path), {})
        
        # Close the figure to free memory
        plt.close()
        
        # Return plot details
        return {
            'plot_id': plot_id,
            'plot_type': 'pca_variance',
            'n_pcs': n_pcs,
            'total_variance_explained': float(sum(variance_ratio)),
            'plot_data': buffer.getvalue()
        }
    
    @cached()
    def find_marker_genes(
        self,
        adata_id: str,
        cluster_key: str = 'leiden',
        method: str = 'wilcoxon',
        min_pct: float = 0.1,
        min_logfoldchange: float = 0.25,
        n_genes: int = 100
    ) -> Tuple[Dict[str, List[Dict[str, Any]]], Dict[str, Any]]:
        """
        Find marker genes for clusters.
        Equivalent to the 'cluster_marker_genes' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            cluster_key: Key in adata.obs for clusters
            method: Method for differential expression analysis
            min_pct: Minimum fraction of cells expressing the gene
            min_logfoldchange: Minimum log fold change
            n_genes: Maximum number of genes to return per cluster
            
        Returns:
            Tuple containing:
                - Dictionary mapping cluster IDs to lists of marker genes
                - Summary dictionary with details
                
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If the requested cluster key is not available
        """
        logger.info(f"Finding marker genes for AnnData {adata_id} using {method} method")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Check if the cluster key exists
        if cluster_key not in adata.obs:
            raise ValueError(f"Cluster key '{cluster_key}' not found. Run clustering first.")
        
        # Run marker gene detection
        sc.tl.rank_genes_groups(
            adata,
            groupby=cluster_key,
            method=method,
            key_added='rank_genes_groups'
        )
        
        # Extract results
        result = adata.uns['rank_genes_groups']
        groups = result['names'].dtype.names
        
        marker_genes = {}
        for group in groups:
            markers = []
            for i in range(min(n_genes, result['names'].shape[0])):
                gene_name = result['names'][i][group]
                logfoldchange = result['logfoldchanges'][i][group]
                pval = result['pvals'][i][group]
                pval_adj = result['pvals_adj'][i][group]
                pts = result['pts'][i][group]
                
                if pts < min_pct or logfoldchange < min_logfoldchange:
                    continue
                    
                markers.append({
                    'gene': gene_name,
                    'logfoldchange': float(logfoldchange),
                    'pval': float(pval),
                    'pval_adj': float(pval_adj),
                    'pts': float(pts)
                })
            
            marker_genes[group] = markers
        
        # Create summary
        summary = {
            'cluster_key': cluster_key,
            'method': method,
            'min_pct': min_pct,
            'min_logfoldchange': min_logfoldchange,
            'n_clusters': len(groups),
            'n_markers_per_cluster': {group: len(markers) for group, markers in marker_genes.items()}
        }
        
        # Store the marker genes in the AnnData object
        adata.uns['marker_genes'] = {
            'cluster_key': cluster_key,
            'method': method,
            'min_pct': min_pct,
            'min_logfoldchange': min_logfoldchange,
            'n_genes': n_genes,
            'markers': marker_genes
        }
        
        # Save the AnnData object with marker genes
        self._save_adata(adata)
        
        logger.info(f"Successfully found marker genes for {len(groups)} clusters")
        return marker_genes, summary
    
    @cached()
    def plot_dotplot(
        self,
        adata_id: str,
        genes: List[str],
        groupby: str = 'leiden',
        figsize: Tuple[int, int] = (10, 6),
        save_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a dot plot of gene expression across groups.
        Equivalent to the 'plot_dotplot' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            genes: List of genes to plot
            groupby: Column in adata.obs to group cells by
            figsize: Figure size (width, height)
            save_path: Path to save the plot to
            
        Returns:
            Dictionary with the plot details
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            ValueError: If the requested group key is not available
            ValueError: If none of the requested genes are found
        """
        logger.info(f"Creating dot plot for AnnData {adata_id}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Check if the group key exists
        if groupby not in adata.obs:
            raise ValueError(f"Group key '{groupby}' not found in the data.")
        
        # Check if the genes exist
        genes_found = [gene for gene in genes if gene in adata.var_names]
        if not genes_found:
            raise ValueError("None of the requested genes were found in the data.")
        
        if len(genes_found) < len(genes):
            logger.warning(f"Only {len(genes_found)} of {len(genes)} requested genes were found.")
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create dot plot
        sc.pl.dotplot(
            adata,
            genes_found,
            groupby=groupby,
            show=False
        )
        
        # Save the plot if requested
        if save_path:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        # Get the plot as a PNG
        import io
        from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
        
        canvas = FigureCanvas(plt.gcf())
        buffer = io.BytesIO()
        canvas.print_png(buffer)
        
        # Create a unique signature for this plot
        plot_id = str(uuid.uuid4())
        
        # Store the plot in the cache
        signature = f"plot_dotplot_{plot_id}"
        cache.add_call(self.plot_dotplot, (adata_id, genes, groupby, figsize, save_path), {})
        
        # Close the figure to free memory
        plt.close()
        
        # Return plot details
        return {
            'plot_id': plot_id,
            'plot_type': 'dotplot',
            'genes': genes_found,
            'groupby': groupby,
            'n_cells': adata.n_obs,
            'plot_data': buffer.getvalue()
        }
    
    def summarize_adata(self, adata_id: str) -> Dict[str, Any]:
        """
        Summarize an AnnData object.
        Equivalent to the 'summarize_seurat' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            
        Returns:
            Summary dictionary
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
        """
        logger.info(f"Summarizing AnnData {adata_id}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Create summary
        summary = {
            'n_cells': adata.n_obs,
            'n_genes': adata.n_vars,
            'obs_keys': list(adata.obs.columns),
            'var_keys': list(adata.var.columns),
            'obsm_keys': list(adata.obsm.keys()) if hasattr(adata, 'obsm') else [],
            'layers': list(adata.layers.keys()) if hasattr(adata, 'layers') else []
        }
        
        # Check for embeddings
        embeddings = [key for key in adata.obsm.keys() if key.startswith('X_')]
        if embeddings:
            summary['embeddings'] = embeddings
        
        # Check for clusters
        cluster_keys = [col for col in adata.obs.columns if col in ['leiden', 'louvain', 'kmeans']]
        if cluster_keys:
            summary['cluster_keys'] = cluster_keys
            summary['clusters'] = {
                key: adata.obs[key].value_counts().to_dict() for key in cluster_keys
            }
        
        # Check for marker genes
        if 'marker_genes' in adata.uns:
            marker_info = adata.uns['marker_genes']
            summary['marker_genes'] = {
                'cluster_key': marker_info['cluster_key'],
                'method': marker_info['method'],
                'n_clusters': len(marker_info['markers']),
                'n_markers': {cluster: len(markers) for cluster, markers in marker_info['markers'].items()}
            }
        
        logger.info("Successfully summarized AnnData object")
        return summary
        
    @cached()
    def convert_h5ad_to_seurat(self, adata_id: str, output_path: str) -> str:
        """
        Convert an AnnData object to a Seurat object and save it as an RDS file.
        Equivalent to the 'convert_h5ad_to_seurat' function in R.
        
        Args:
            adata_id: The ID of the AnnData object
            output_path: Path to save the Seurat RDS file
            
        Returns:
            Path to the saved RDS file
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            AnalysisError: If the conversion fails
        """
        logger.info(f"Converting AnnData {adata_id} to Seurat object")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        # Save as H5AD file first
        h5ad_path = os.path.join(self.data_dir, f"{adata_id}.h5ad")
        adata.write_h5ad(h5ad_path)
        
        try:
            import rpy2.robjects as ro
            from rpy2.robjects import pandas2ri
            from rpy2.robjects.conversion import localconverter
            import rpy2.robjects.packages as rpackages
            
            # Initialize R
            ro.r("options(warn = -1)")
            
            # Install necessary packages if not installed
            utils = rpackages.importr('utils')
            base = rpackages.importr('base')
            
            # Check if Seurat and SeuratDisk are installed
            try:
                seurat = rpackages.importr('Seurat')
                seuratdisk = rpackages.importr('SeuratDisk')
            except Exception as e:
                logger.warning(f"Failed to import R packages: {e}")
                logger.info("Installing required R packages...")
                
                # Install packages
                utils.install_packages("Seurat", repos="https://cloud.r-project.org")
                
                # Install SeuratDisk from GitHub
                ro.r("""
                    if (!requireNamespace("remotes", quietly = TRUE))
                        install.packages("remotes")
                    remotes::install_github("mojaveazure/seurat-disk")
                """)
                
                # Import again
                seurat = rpackages.importr('Seurat')
                seuratdisk = rpackages.importr('SeuratDisk')
            
            # Convert h5ad to h5Seurat
            ro.r(f"""
                SeuratDisk::Convert("{h5ad_path}", dest = "h5seurat")
            """)
            
            # Load h5Seurat as Seurat object
            h5seurat_path = h5ad_path.replace(".h5ad", ".h5seurat")
            ro.r(f"""
                seurat_obj <- SeuratDisk::LoadH5Seurat("{h5seurat_path}")
                saveRDS(seurat_obj, "{output_path}")
            """)
            
            logger.info(f"Successfully converted AnnData to Seurat object and saved to {output_path}")
            return output_path
            
        except Exception as e:
            raise AnalysisError(f"Failed to convert AnnData to Seurat object: {e}")
    
    @cached()
    def convert_seurat_to_h5ad(self, seurat_path: str, output_path: str) -> str:
        """
        Convert a Seurat object to an AnnData object and save it as an H5AD file.
        
        Args:
            seurat_path: Path to the Seurat RDS file
            output_path: Path to save the H5AD file
            
        Returns:
            Path to the saved H5AD file
            
        Raises:
            DataLoadingError: If the Seurat file cannot be loaded
            AnalysisError: If the conversion fails
        """
        logger.info(f"Converting Seurat object from {seurat_path} to AnnData")
        
        if not os.path.exists(seurat_path):
            raise DataLoadingError(f"Seurat file not found: {seurat_path}")
        
        try:
            import rpy2.robjects as ro
            from rpy2.robjects import pandas2ri
            from rpy2.robjects.conversion import localconverter
            import rpy2.robjects.packages as rpackages
            
            # Initialize R
            ro.r("options(warn = -1)")
            
            # Install necessary packages if not installed
            utils = rpackages.importr('utils')
            base = rpackages.importr('base')
            
            # Check if Seurat and SeuratDisk are installed
            try:
                seurat = rpackages.importr('Seurat')
                seuratdisk = rpackages.importr('SeuratDisk')
            except Exception as e:
                logger.warning(f"Failed to import R packages: {e}")
                logger.info("Installing required R packages...")
                
                # Install packages
                utils.install_packages("Seurat", repos="https://cloud.r-project.org")
                
                # Install SeuratDisk from GitHub
                ro.r("""
                    if (!requireNamespace("remotes", quietly = TRUE))
                        install.packages("remotes")
                    remotes::install_github("mojaveazure/seurat-disk")
                """)
                
                # Import again
                seurat = rpackages.importr('Seurat')
                seuratdisk = rpackages.importr('SeuratDisk')
            
            # Load Seurat object
            ro.r(f"""
                seurat_obj <- readRDS("{seurat_path}")
            """)
            
            # Save as h5Seurat
            h5seurat_path = seurat_path.replace(".rds", ".h5seurat")
            ro.r(f"""
                SeuratDisk::SaveH5Seurat(seurat_obj, filename = "{h5seurat_path}")
            """)
            
            # Convert to h5ad
            ro.r(f"""
                SeuratDisk::Convert("{h5seurat_path}", dest = "h5ad")
            """)
            
            # Move the file to the desired location
            h5ad_path = h5seurat_path.replace(".h5seurat", ".h5ad")
            if h5ad_path != output_path:
                import shutil
                shutil.move(h5ad_path, output_path)
            
            logger.info(f"Successfully converted Seurat object to AnnData and saved to {output_path}")
            return output_path
            
        except Exception as e:
            raise AnalysisError(f"Failed to convert Seurat object to AnnData: {e}")
            
    def load_adata_from_h5ad(self, h5ad_path: str) -> str:
        """
        Load an AnnData object from an H5AD file.
        
        Args:
            h5ad_path: Path to the H5AD file
            
        Returns:
            ID of the loaded AnnData object
            
        Raises:
            DataLoadingError: If the file cannot be loaded
        """
        logger.info(f"Loading AnnData from {h5ad_path}")
        
        try:
            # Load the AnnData object
            adata = sc.read_h5ad(h5ad_path)
            
            # Save the AnnData object
            adata_id = self._save_adata(adata)
            
            logger.info(f"Successfully loaded AnnData with {adata.n_obs} cells and {adata.n_vars} genes")
            return adata_id
            
        except Exception as e:
            raise DataLoadingError(f"Failed to load AnnData from {h5ad_path}: {e}")
    
    def save_adata_to_h5ad(self, adata_id: str, output_path: str) -> str:
        """
        Save an AnnData object to an H5AD file.
        
        Args:
            adata_id: ID of the AnnData object
            output_path: Path to save the H5AD file
            
        Returns:
            Path to the saved H5AD file
            
        Raises:
            ResourceNotFoundError: If the AnnData object doesn't exist
            AnalysisError: If the file cannot be saved
        """
        logger.info(f"Saving AnnData {adata_id} to {output_path}")
        
        # Get the AnnData object
        adata = self._get_adata(adata_id)
        
        try:
            # Create the directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save the AnnData object
            adata.write_h5ad(output_path)
            
            logger.info(f"Successfully saved AnnData to {output_path}")
            return output_path
            
        except Exception as e:
            raise AnalysisError(f"Failed to save AnnData to {output_path}: {e}")
    
    def clear_cache(self) -> None:
        """
        Clear the cache of AnnData objects.
        """
        logger.info("Clearing cache of AnnData objects")
        
        # Clear the cache
        self.adata_dict.clear()
        
        # Clear the disk cache
        for filename in os.listdir(self.data_dir):
            if filename.endswith(".h5ad"):
                try:
                    os.remove(os.path.join(self.data_dir, filename))
                except Exception as e:
                    logger.warning(f"Failed to remove file {filename}: {e}")
        
        # Clear the function call cache
        cache.clear()
        
        logger.info("Successfully cleared cache")

    def find_marker_genes(self, adata_id: str,
                         groupby: str = "clusters",
                         method: str = "wilcoxon",
                         min_in_group_fraction: float = 0.1,
                         min_fold_change: float = 1.0,
                         max_out_group_fraction: float = 0.5,
                         min_pct: float = 0.1) -> Dict[str, Any]:
        """Find marker genes for each group."""
        call_signature = self._get_call_signature('find_marker_genes', {
            'adata_id': adata_id,
            'groupby': groupby,
            'method': method,
            'min_in_group_fraction': min_in_group_fraction,
            'min_fold_change': min_fold_change,
            'max_out_group_fraction': max_out_group_fraction,
            'min_pct': min_pct
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Find marker genes
        sc.tl.rank_genes_groups(adata,
                              groupby=groupby,
                              method=method,
                              min_in_group_fraction=min_in_group_fraction,
                              min_fold_change=min_fold_change,
                              max_out_group_fraction=max_out_group_fraction)
        
        # Extract results
        results = {}
        for group in adata.uns['rank_genes_groups']['names'].dtype.names:
            group_results = {
                'names': adata.uns['rank_genes_groups']['names'][group].tolist(),
                'scores': adata.uns['rank_genes_groups']['scores'][group].tolist(),
                'pvals': adata.uns['rank_genes_groups']['pvals'][group].tolist(),
                'pvals_adj': adata.uns['rank_genes_groups']['pvals_adj'][group].tolist(),
                'logfoldchanges': adata.uns['rank_genes_groups']['logfoldchanges'][group].tolist(),
                'pts': adata.uns['rank_genes_groups']['pts'][group].tolist(),
                'pts_rest': adata.uns['rank_genes_groups']['pts_rest'][group].tolist()
            }
            results[group] = group_results
            
        self._add_to_cache(call_signature, results)
        return results
        
    def plot_violin(self, adata_id: str,
                   genes: List[str],
                   groupby: str = "clusters",
                   rotation: int = 45,
                   size: int = 1,
                   save: Optional[str] = None) -> Dict[str, Any]:
        """Plot violin plots for specified genes."""
        call_signature = self._get_call_signature('plot_violin', {
            'adata_id': adata_id,
            'genes': genes,
            'groupby': groupby,
            'rotation': rotation,
            'size': size,
            'save': save
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Create violin plots
        fig = sc.pl.violin(adata,
                          genes,
                          groupby=groupby,
                          rotation=rotation,
                          size=size,
                          show=False)
        
        # Save plot if requested
        if save:
            fig.savefig(save)
            
        # Convert to plotly
        plot = px.violin(adata.to_df(),
                        x=groupby,
                        y=genes[0],
                        box=True,
                        points="all")
        
        self._add_to_cache(call_signature, plot)
        return plot
        
    def plot_umap(self, adata_id: str,
                  color: Optional[str] = None,
                  size: int = 10,
                  save: Optional[str] = None) -> Dict[str, Any]:
        """Plot UMAP visualization."""
        call_signature = self._get_call_signature('plot_umap', {
            'adata_id': adata_id,
            'color': color,
            'size': size,
            'save': save
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Create UMAP plot
        fig = sc.pl.umap(adata,
                        color=color,
                        size=size,
                        show=False)
        
        # Save plot if requested
        if save:
            fig.savefig(save)
            
        # Convert to plotly
        plot = px.scatter(adata.obsm['X_umap'],
                         x=0,
                         y=1,
                         color=adata.obs[color] if color else None,
                         title="UMAP")
        
        self._add_to_cache(call_signature, plot)
        return plot
        
    def plot_heatmap(self, adata_id: str,
                    genes: List[str],
                    groupby: str = "clusters",
                    save: Optional[str] = None) -> Dict[str, Any]:
        """Plot heatmap of gene expression."""
        call_signature = self._get_call_signature('plot_heatmap', {
            'adata_id': adata_id,
            'genes': genes,
            'groupby': groupby,
            'save': save
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Create heatmap
        fig = sc.pl.heatmap(adata,
                           genes,
                           groupby=groupby,
                           show=False)
        
        # Save plot if requested
        if save:
            fig.savefig(save)
            
        # Convert to plotly
        plot = px.imshow(adata[:, genes].X,
                        labels=dict(x="Genes", y="Cells", color="Expression"),
                        title="Gene Expression Heatmap")
        
        self._add_to_cache(call_signature, plot)
        return plot
        
    def plot_dotplot(self, adata_id: str,
                    genes: List[str],
                    groupby: str = "clusters",
                    save: Optional[str] = None) -> Dict[str, Any]:
        """Plot dot plot of gene expression."""
        call_signature = self._get_call_signature('plot_dotplot', {
            'adata_id': adata_id,
            'genes': genes,
            'groupby': groupby,
            'save': save
        })
        
        if self._is_cached(call_signature):
            return self._get_cached_result(call_signature)
            
        adata = self._get_adata(adata_id)
        
        # Create dot plot
        fig = sc.pl.dotplot(adata,
                           genes,
                           groupby=groupby,
                           show=False)
        
        # Save plot if requested
        if save:
            fig.savefig(save)
            
        # Convert to plotly
        plot = px.scatter(adata.to_df(),
                         x=groupby,
                         y=genes[0],
                         size=genes[0],
                         color=genes[0],
                         title="Gene Expression Dot Plot")
        
        self._add_to_cache(call_signature, plot)
        return plot 