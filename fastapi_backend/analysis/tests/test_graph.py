"""
Tests for the graph module.

This module contains tests for the graph-based analysis and visualization 
functions used for single-cell data processing.
"""

import pytest
import numpy as np
import pandas as pd
import anndata
import networkx as nx
import scanpy as sc
from unittest.mock import patch, MagicMock

from ..graph import (
    build_knn_graph,
    compute_graph_layout,
    add_graph_info_to_adata,
    visualize_graph
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
        'cell_type': np.random.choice(['T Cell', 'B Cell', 'NK Cell'], n_obs)
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
    
    # Add PCA representation
    adata.obsm = {
        'X_pca': np.random.rand(n_obs, 10)
    }
    
    return adata


@pytest.fixture
def mock_graph():
    """Create a mock graph for testing."""
    G = nx.Graph()
    
    # Add nodes
    for i in range(10):
        G.add_node(i, x=np.random.random(), y=np.random.random())
    
    # Add edges
    for i in range(10):
        for j in range(i+1, 10):
            if np.random.random() < 0.3:  # 30% chance of edge
                G.add_edge(i, j, weight=np.random.random())
    
    return G


def test_build_knn_graph(mock_adata):
    """Test the build_knn_graph function."""
    # Mock scanpy's pp.neighbors function
    with patch('scanpy.pp.neighbors') as mock_neighbors:
        mock_neighbors.side_effect = lambda adata, **kwargs: setattr(adata, 'obsp', {'connectivities': np.random.rand(100, 100)})
        
        # Call the function
        G = build_knn_graph(mock_adata, n_neighbors=10, use_rep='X_pca')
        
        # Verify the graph structure
        assert isinstance(G, nx.Graph)
        assert G.number_of_nodes() == mock_adata.n_obs
        
        # Check that neighbors was called with correct params
        mock_neighbors.assert_called_once()
        args, kwargs = mock_neighbors.call_args
        assert kwargs.get('n_neighbors') == 10
        assert kwargs.get('use_rep') == 'X_pca'


def test_compute_graph_layout(mock_graph):
    """Test the compute_graph_layout function."""
    # Test with different layout algorithms
    for layout_algo in ['fr', 'kk', 'spectral']:
        pos = compute_graph_layout(mock_graph, layout=layout_algo)
        
        # Verify the layout results
        assert isinstance(pos, dict)
        assert len(pos) == mock_graph.number_of_nodes()
        
        # Each position should be a 2D coordinate
        for node_id, coords in pos.items():
            assert len(coords) == 2
            assert isinstance(coords[0], (int, float))
            assert isinstance(coords[1], (int, float))


def test_add_graph_info_to_adata(mock_adata, mock_graph):
    """Test the add_graph_info_to_adata function."""
    # Create a position dictionary for the graph
    pos = {i: (np.random.random(), np.random.random()) for i in range(mock_adata.n_obs)}
    
    # Add graph info to adata
    result_adata = add_graph_info_to_adata(mock_adata, mock_graph, pos)
    
    # Verify the graph information was added correctly
    assert 'graph' in result_adata.uns
    assert 'layout_pos' in result_adata.uns
    
    # Check that layout positions were saved correctly
    assert result_adata.uns['layout_pos'].shape == (mock_adata.n_obs, 2)


@pytest.mark.parametrize("color_by", [None, 'cell_type'])
def test_visualize_graph(mock_adata, mock_graph, color_by):
    """Test the visualize_graph function with different parameters."""
    # Create position dictionary
    pos = {i: (np.random.random(), np.random.random()) for i in range(mock_adata.n_obs)}
    
    # Add graph info to adata
    mock_adata = add_graph_info_to_adata(mock_adata, mock_graph, pos)
    
    # Test visualization function
    with patch('matplotlib.pyplot.figure') as mock_figure, \
         patch('networkx.draw_networkx_nodes') as mock_draw_nodes, \
         patch('networkx.draw_networkx_edges') as mock_draw_edges:
        
        fig = visualize_graph(mock_adata, color_by=color_by)
        
        # Verify that the drawing functions were called
        mock_figure.assert_called_once()
        mock_draw_nodes.assert_called_once()
        mock_draw_edges.assert_called_once()
        
        # If color_by is specified, node colors should be customized
        if color_by:
            # Check that node colors were derived from the color_by column
            args, kwargs = mock_draw_nodes.call_args
            assert 'node_color' in kwargs
</rewritten_file> 