"""
Tests for the analysis functions module.

This module contains tests for the various analysis functions used for
single-cell data processing and visualization.
"""

import pytest
import numpy as np
import pandas as pd
import anndata
import scanpy as sc
import os
import tempfile
from pathlib import Path
import plotly.graph_objs as go
import matplotlib.pyplot as plt
from unittest.mock import patch, MagicMock

from ..functions import (
    get_call_signature,
    add_result,
    get_result,
    log_normalize,
    plot_cell_type_dist_bar
)


@pytest.fixture
def mock_adata():
    """Create a mock AnnData object for testing."""
    # Create random data
    n_obs = 100  # number of cells
    n_vars = 50  # number of genes
    X = np.random.rand(n_obs, n_vars)
    
    # Create cell metadata
    obs = pd.DataFrame({
        'cell_id': [f'cell_{i}' for i in range(n_obs)],
        'majority_voting': np.random.choice(['T Cell', 'B Cell', 'NK Cell'], n_obs)
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
    adata.uns = {}
    
    return adata


def test_get_call_signature():
    """Test the get_call_signature function."""
    # Test with empty args
    result = get_call_signature("test_function", {}, verbose=False)
    assert result == "test_function()"
    
    # Test with multiple args
    args = {"arg1": 10, "arg2": "test"}
    result = get_call_signature("complex_function", args, verbose=False)
    assert "complex_function(" in result
    assert "arg1=10" in result
    assert "arg2=test" in result


def test_add_result(mock_adata):
    """Test the add_result function."""
    # Test adding summary
    call = "test_function()"
    summary = {"metric1": 0.9, "metric2": 0.8}
    
    result_adata = add_result(mock_adata, call, summary)
    
    assert "summaries" in result_adata.uns
    assert call in result_adata.uns["summaries"]
    assert result_adata.uns["summaries"][call] == summary
    
    # Test adding plot
    plot = {"fig": "mock_figure"}
    result_adata = add_result(mock_adata, call, summary, plot)
    
    assert "plots" in result_adata.uns
    assert call in result_adata.uns["plots"]
    assert result_adata.uns["plots"][call] == plot


def test_get_result(mock_adata):
    """Test the get_result function."""
    # Setup
    call = "test_function()"
    summary = {"metric": 0.9}
    plot = {"fig": "mock_figure"}
    
    mock_adata.uns["summaries"] = {call: summary}
    mock_adata.uns["plots"] = {call: plot}
    
    # Test without plot
    result = get_result(mock_adata, call)
    assert result["adata"] is mock_adata
    assert result["summary"] == summary
    assert "plot" not in result
    
    # Test with plot
    result = get_result(mock_adata, call, plot=True)
    assert result["adata"] is mock_adata
    assert result["summary"] == summary
    assert result["plot"] == plot


def test_log_normalize(mock_adata):
    """Test the log_normalize function."""
    # Test first normalization
    result_adata = log_normalize(mock_adata)
    
    assert 'called_functions' in result_adata.uns
    assert any('log_normalize' in func for func in result_adata.uns['called_functions'])
    
    # Ensure values are log-normalized
    # After normalization, values should be on log scale
    assert np.max(result_adata.X) < np.log1p(10000)
    
    # Test idempotence (calling twice shouldn't change results)
    X_after_first = result_adata.X.copy()
    result_adata = log_normalize(result_adata)
    
    # The data shouldn't change on second call
    assert np.array_equal(X_after_first, result_adata.X)


@pytest.mark.parametrize("plot_y_relative,plot_plotly", [
    (True, True),
    (False, True),
    (True, False),
    (False, False)
])
def test_plot_cell_type_dist_bar(mock_adata, plot_y_relative, plot_plotly):
    """Test the plot_cell_type_dist_bar function with different parameters."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock the file path creation
        tmp_dir = Path(tmpdir)
        
        with patch('os.path.dirname') as mock_dirname, \
             patch('os.makedirs') as mock_makedirs, \
             patch.object(go.Figure, 'write_html') as mock_write_html, \
             patch.object(plt, 'savefig') as mock_savefig:
            
            # Configure mocks
            mock_dirname.return_value = str(tmp_dir)
            
            # Run the function
            result = plot_cell_type_dist_bar(
                mock_adata,
                group_by='majority_voting',
                plot_y_relative=plot_y_relative,
                plot_plotly=plot_plotly
            )
            
            # Verify function call was recorded
            assert 'called_functions' in mock_adata.uns
            assert any('plot_cell_type_dist_bar' in func for func in mock_adata.uns['called_functions'])
            
            # Verify plot was created
            if plot_plotly:
                # For Plotly plots
                assert mock_write_html.called
                assert isinstance(result['plot'], go.Figure)
            else:
                # For Matplotlib plots
                assert mock_savefig.called 