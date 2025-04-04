"""
Tests for the utility module.

This module contains tests for utility functions used in single-cell data analysis.
"""

import pytest
import numpy as np
import pandas as pd
import anndata
import tempfile
import os
from pathlib import Path
import h5py
from unittest.mock import patch, MagicMock

from ..utility import (
    load_h5ad_file,
    save_h5ad_file,
    convert_sparse_matrix,
    generate_color_mapping,
    sanitize_dataframe
)


@pytest.fixture
def mock_adata():
    """Create a mock AnnData object for testing."""
    # Create random data
    n_obs = 50  # number of cells
    n_vars = 30  # number of genes
    X = np.random.rand(n_obs, n_vars)
    
    # Create cell metadata
    obs = pd.DataFrame({
        'cell_id': [f'cell_{i}' for i in range(n_obs)],
        'cell_type': np.random.choice(['T Cell', 'B Cell', 'NK Cell'], n_obs),
        'batch': np.random.choice(['Batch1', 'Batch2'], n_obs)
    })
    obs.set_index('cell_id', inplace=True)
    
    # Create gene metadata
    var = pd.DataFrame({
        'gene_id': [f'gene_{i}' for i in range(n_vars)],
        'gene_name': [f'GENE_{i}' for i in range(n_vars)]
    })
    var.set_index('gene_id', inplace=True)
    
    # Create AnnData object
    adata = anndata.AnnData(X=X, obs=obs, var=var)
    adata.uns = {'metadata': {'organism': 'human'}}
    
    return adata


def test_load_h5ad_file():
    """Test the load_h5ad_file function."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a mock h5ad file
        mock_path = Path(tmpdir) / "test_data.h5ad"
        
        # Create a simple AnnData object to save
        adata = anndata.AnnData(X=np.random.rand(10, 5))
        adata.write_h5ad(mock_path)
        
        # Test loading the file
        loaded_adata = load_h5ad_file(mock_path)
        
        # Verify the loaded data
        assert isinstance(loaded_adata, anndata.AnnData)
        assert loaded_adata.shape == (10, 5)
        
        # Test error handling for non-existent file
        with pytest.raises(FileNotFoundError):
            load_h5ad_file(Path(tmpdir) / "nonexistent.h5ad")


def test_save_h5ad_file(mock_adata):
    """Test the save_h5ad_file function."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Define output path
        output_path = Path(tmpdir) / "saved_data.h5ad"
        
        # Save the AnnData object
        save_h5ad_file(mock_adata, output_path)
        
        # Verify the file was created
        assert output_path.exists()
        
        # Verify the content by loading it back
        loaded_adata = anndata.read_h5ad(output_path)
        assert loaded_adata.shape == mock_adata.shape
        assert np.allclose(loaded_adata.X, mock_adata.X)
        assert set(loaded_adata.obs.columns) == set(mock_adata.obs.columns)
        assert set(loaded_adata.var.columns) == set(mock_adata.var.columns)


def test_convert_sparse_matrix():
    """Test the convert_sparse_matrix function."""
    # Create a dense matrix
    dense_matrix = np.random.rand(10, 5)
    
    # Convert to sparse
    sparse_matrix = convert_sparse_matrix(dense_matrix, format="csr")
    
    # Verify the conversion
    assert sparse_matrix.shape == dense_matrix.shape
    assert np.allclose(sparse_matrix.toarray(), dense_matrix)
    
    # Test conversion with different formats
    coo_matrix = convert_sparse_matrix(dense_matrix, format="coo")
    assert np.allclose(coo_matrix.toarray(), dense_matrix)
    
    # Test converting already sparse matrix
    same_sparse = convert_sparse_matrix(sparse_matrix, format="csr")
    assert np.allclose(same_sparse.toarray(), dense_matrix)


def test_generate_color_mapping():
    """Test the generate_color_mapping function."""
    # Test with categorical data
    categories = ['A', 'B', 'C', 'D']
    color_map = generate_color_mapping(categories)
    
    # Verify the color mapping
    assert isinstance(color_map, dict)
    assert set(color_map.keys()) == set(categories)
    assert len(color_map) == len(categories)
    
    # Each value should be a valid color string
    for color in color_map.values():
        assert isinstance(color, str)
        # Check if it's a valid hex color or named color
        assert color.startswith('#') or color in ['red', 'blue', 'green', 'purple', 'orange']
    
    # Test with empty list
    empty_map = generate_color_mapping([])
    assert isinstance(empty_map, dict)
    assert len(empty_map) == 0


def test_sanitize_dataframe():
    """Test the sanitize_dataframe function."""
    # Create a test DataFrame with problematic values
    df = pd.DataFrame({
        'numeric': [1, 2, None, np.nan, np.inf, -np.inf],
        'text': ['a', 'b', None, np.nan, '', ' '],
        'mixed': [1, 'text', None, np.nan, np.inf, '']
    })
    
    # Sanitize the DataFrame
    cleaned_df = sanitize_dataframe(df)
    
    # Verify the sanitization
    assert cleaned_df.shape == df.shape
    
    # Check that NaN values are properly handled
    assert not cleaned_df['numeric'].isna().any()
    assert not cleaned_df['text'].isna().any()
    assert not cleaned_df['mixed'].isna().any()
    
    # Check that infinite values are properly handled
    assert not np.isinf(cleaned_df['numeric']).any()
    
    # Check that empty strings are properly handled
    assert (cleaned_df['text'].str.len() > 0).all()
    
    # Test with custom fill values
    custom_df = sanitize_dataframe(df, numeric_fill=999, text_fill="MISSING")
    assert (custom_df['numeric'].replace(999, pd.NA).dropna() == df['numeric'].dropna()).all()
    assert "MISSING" in custom_df['text'].values 