"""
Tests for the tools_py module.

This module contains tests for the tools used in analysis workflows.
"""

import pytest
import numpy as np
import pandas as pd
import anndata
from unittest.mock import patch, MagicMock

from ..tools_py import (
    create_tool_list,
    get_tool_by_name,
    execute_tool
)


@pytest.fixture
def mock_adata():
    """Create a mock AnnData object for testing."""
    # Create random data
    n_obs = 20  # number of cells
    n_vars = 15  # number of genes
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
    
    return adata


def test_create_tool_list():
    """Test the create_tool_list function."""
    # Test tool list creation
    tools = create_tool_list()
    
    # Verify the tool list structure
    assert isinstance(tools, list)
    assert len(tools) > 0
    
    # Check that each tool has the required fields
    for tool in tools:
        assert 'name' in tool
        assert 'description' in tool
        assert 'parameters' in tool
        assert 'function' in tool
        
        # Check parameter structure
        for param in tool['parameters']:
            assert 'name' in param
            assert 'type' in param
            assert 'description' in param


def test_get_tool_by_name():
    """Test the get_tool_by_name function."""
    # Create a list of tools
    tools = create_tool_list()
    
    # Try to get an existing tool
    first_tool_name = tools[0]['name']
    tool = get_tool_by_name(first_tool_name)
    
    # Verify the tool was found
    assert tool is not None
    assert tool['name'] == first_tool_name
    
    # Try to get a non-existing tool
    nonexistent_tool = get_tool_by_name('nonexistent_tool')
    assert nonexistent_tool is None


@pytest.mark.parametrize("tool_name,params", [
    ('normalize_data', {'method': 'log1p'}),
    ('filter_cells', {'min_genes': 10, 'max_genes': 1000}),
    ('filter_genes', {'min_cells': 5})
])
def test_execute_tool(mock_adata, tool_name, params):
    """Test the execute_tool function with different tools and parameters."""
    # Create mock functions for each tool
    mock_normalize = MagicMock(return_value=mock_adata)
    mock_filter_cells = MagicMock(return_value=mock_adata)
    mock_filter_genes = MagicMock(return_value=mock_adata)
    
    # Create a mock tool list
    mock_tools = [
        {
            'name': 'normalize_data',
            'function': mock_normalize,
            'parameters': [{'name': 'method', 'type': 'string'}]
        },
        {
            'name': 'filter_cells',
            'function': mock_filter_cells,
            'parameters': [
                {'name': 'min_genes', 'type': 'integer'},
                {'name': 'max_genes', 'type': 'integer'}
            ]
        },
        {
            'name': 'filter_genes',
            'function': mock_filter_genes,
            'parameters': [{'name': 'min_cells', 'type': 'integer'}]
        }
    ]
    
    # Mock the create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Execute the tool
        result = execute_tool(mock_adata, tool_name, params)
        
        # Verify the tool was executed
        assert result is not None
        
        # Check that the correct function was called
        if tool_name == 'normalize_data':
            mock_normalize.assert_called_once_with(mock_adata, method='log1p')
        elif tool_name == 'filter_cells':
            mock_filter_cells.assert_called_once_with(mock_adata, min_genes=10, max_genes=1000)
        elif tool_name == 'filter_genes':
            mock_filter_genes.assert_called_once_with(mock_adata, min_cells=5)


def test_execute_tool_error_handling():
    """Test error handling in the execute_tool function."""
    # Create a mock AnnData object
    mock_adata = anndata.AnnData(X=np.random.rand(10, 5))
    
    # Test with non-existent tool
    with pytest.raises(ValueError) as excinfo:
        execute_tool(mock_adata, 'nonexistent_tool', {})
    assert "Tool not found" in str(excinfo.value)
    
    # Create a mock tool that raises an exception
    def mock_failing_function(adata, **kwargs):
        raise ValueError("Test error")
    
    mock_tools = [{
        'name': 'failing_tool',
        'function': mock_failing_function,
        'parameters': []
    }]
    
    # Test with a failing tool
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        with pytest.raises(ValueError) as excinfo:
            execute_tool(mock_adata, 'failing_tool', {})
        assert "Test error" in str(excinfo.value) 