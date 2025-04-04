"""
Tests for the my_tools_executor module.

This module contains tests for the tool execution framework.
"""

import pytest
import numpy as np
import pandas as pd
import anndata
import json
from unittest.mock import patch, MagicMock

from ..my_tools_executor import (
    ToolsExecutor,
    get_tool_schemas,
    execute_tool_chain
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


@pytest.fixture
def mock_tools():
    """Create a mock list of tools for testing."""
    # Mock tool functions
    def mock_normalize(adata, **kwargs):
        return adata
    
    def mock_filter(adata, **kwargs):
        return adata
    
    def mock_cluster(adata, **kwargs):
        adata.obs['clusters'] = np.random.choice(['0', '1', '2'], adata.n_obs)
        return adata
    
    return [
        {
            'name': 'normalize_data',
            'description': 'Normalize the data',
            'function': mock_normalize,
            'parameters': [
                {'name': 'method', 'type': 'string', 'description': 'Normalization method'}
            ]
        },
        {
            'name': 'filter_data',
            'description': 'Filter the data',
            'function': mock_filter,
            'parameters': [
                {'name': 'min_genes', 'type': 'integer', 'description': 'Minimum number of genes'},
                {'name': 'min_cells', 'type': 'integer', 'description': 'Minimum number of cells'}
            ]
        },
        {
            'name': 'cluster_data',
            'description': 'Cluster the data',
            'function': mock_cluster,
            'parameters': [
                {'name': 'method', 'type': 'string', 'description': 'Clustering method'},
                {'name': 'n_clusters', 'type': 'integer', 'description': 'Number of clusters'}
            ]
        }
    ]


def test_get_tool_schemas(mock_tools):
    """Test the get_tool_schemas function."""
    # Mock the tools_py.create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Get the tool schemas
        schemas = get_tool_schemas()
        
        # Verify the schemas structure
        assert isinstance(schemas, list)
        assert len(schemas) == len(mock_tools)
        
        # Check each schema's structure
        for schema in schemas:
            assert 'name' in schema
            assert 'description' in schema
            assert 'parameters' in schema
            assert 'function' not in schema  # function should be excluded from schema
            
            # Check parameter schema structure
            for param in schema['parameters']:
                assert 'name' in param
                assert 'type' in param
                assert 'description' in param


def test_tools_executor_initialization(mock_tools):
    """Test initialization of the ToolsExecutor class."""
    # Mock the tools_py.create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Initialize the executor
        executor = ToolsExecutor()
        
        # Verify the executor's attributes
        assert executor.tools is not None
        assert len(executor.tools) == len(mock_tools)


def test_tools_executor_get_tool(mock_tools):
    """Test the get_tool method of the ToolsExecutor class."""
    # Mock the tools_py.create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Initialize the executor
        executor = ToolsExecutor()
        
        # Test getting an existing tool
        tool = executor.get_tool('normalize_data')
        assert tool is not None
        assert tool['name'] == 'normalize_data'
        
        # Test getting a non-existent tool
        with pytest.raises(ValueError) as excinfo:
            executor.get_tool('nonexistent_tool')
        assert "Tool not found" in str(excinfo.value)


def test_tools_executor_execute_tool(mock_adata, mock_tools):
    """Test the execute_tool method of the ToolsExecutor class."""
    # Mock the tools_py.create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Initialize the executor
        executor = ToolsExecutor()
        
        # Execute a tool
        result = executor.execute_tool(mock_adata, 'normalize_data', {'method': 'log1p'})
        
        # Verify the result
        assert result is not None
        assert isinstance(result, anndata.AnnData)


def test_tools_executor_validate_parameters(mock_tools):
    """Test the validate_parameters method of the ToolsExecutor class."""
    # Mock the tools_py.create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Initialize the executor
        executor = ToolsExecutor()
        
        # Test valid parameters
        valid_params = {'method': 'log1p'}
        executor.validate_parameters('normalize_data', valid_params)
        
        # Test invalid parameter name
        invalid_params = {'invalid_param': 'value'}
        with pytest.raises(ValueError) as excinfo:
            executor.validate_parameters('normalize_data', invalid_params)
        assert "Unknown parameter" in str(excinfo.value)
        
        # Test invalid parameter type
        invalid_type_params = {'method': 123}  # method should be string
        with pytest.raises(ValueError) as excinfo:
            executor.validate_parameters('normalize_data', invalid_type_params)
        assert "Invalid parameter type" in str(excinfo.value)


def test_execute_tool_chain(mock_adata, mock_tools):
    """Test the execute_tool_chain function."""
    # Create a tool chain
    tool_chain = [
        {'name': 'normalize_data', 'parameters': {'method': 'log1p'}},
        {'name': 'filter_data', 'parameters': {'min_genes': 5, 'min_cells': 3}},
        {'name': 'cluster_data', 'parameters': {'method': 'leiden', 'n_clusters': 3}}
    ]
    
    # Mock the tools_py.create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Execute the tool chain
        result = execute_tool_chain(mock_adata, tool_chain)
        
        # Verify the result
        assert result is not None
        assert isinstance(result, anndata.AnnData)
        assert 'clusters' in result.obs.columns  # This was added by the cluster_data function


def test_execute_tool_chain_error_handling(mock_adata, mock_tools):
    """Test error handling in the execute_tool_chain function."""
    # Create a tool chain with an invalid tool
    invalid_tool_chain = [
        {'name': 'normalize_data', 'parameters': {'method': 'log1p'}},
        {'name': 'nonexistent_tool', 'parameters': {}}
    ]
    
    # Mock the tools_py.create_tool_list function
    with patch('fastapi_backend.analysis.tools_py.create_tool_list', return_value=mock_tools):
        # Execute the tool chain
        with pytest.raises(ValueError) as excinfo:
            execute_tool_chain(mock_adata, invalid_tool_chain)
        assert "Tool not found" in str(excinfo.value)
        
        # Create a tool chain with invalid parameters
        invalid_params_chain = [
            {'name': 'normalize_data', 'parameters': {'invalid_param': 'value'}}
        ]
        
        # Execute the tool chain with invalid parameters
        with pytest.raises(ValueError) as excinfo:
            execute_tool_chain(mock_adata, invalid_params_chain)
        assert "Unknown parameter" in str(excinfo.value) 