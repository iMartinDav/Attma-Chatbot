"""
Unit tests for analysis components.
"""

import unittest
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock
import tempfile
import os
from typing import Dict, Any

from ..analysis_components import (
    AnalysisType, AnalysisResult, AnalysisComponent, AnalysisRegistry,
    MatrixStatsAnalysis, ClusteringAnalysis, DimensionReductionAnalysis,
    get_analysis_registry
)

class TestAnalysisResult(unittest.TestCase):
    """Test cases for AnalysisResult class."""
    
    def test_result_creation(self):
        """Test creating an analysis result."""
        result = AnalysisResult(
            analysis_type=AnalysisType.MATRIX_STATS,
            result_data={"mean": 5.0, "std": 2.0},
            metadata={"rows": 10, "cols": 5}
        )
        
        self.assertEqual(result.analysis_type, AnalysisType.MATRIX_STATS)
        self.assertEqual(result.result_data.get("mean"), 5.0)
        self.assertEqual(result.metadata.get("rows"), 10)
        
    def test_result_to_dict(self):
        """Test converting result to dictionary."""
        result = AnalysisResult(
            analysis_type=AnalysisType.CLUSTERING,
            result_data={"clusters": [1, 2, 3]},
            metadata={"algorithm": "kmeans"}
        )
        
        result_dict = result.to_dict()
        
        self.assertEqual(result_dict["analysis_type"], "CLUSTERING")
        self.assertListEqual(result_dict["result_data"]["clusters"], [1, 2, 3])
        self.assertEqual(result_dict["metadata"]["algorithm"], "kmeans")
        
    def test_result_from_dict(self):
        """Test creating result from dictionary."""
        result_dict = {
            "analysis_type": "DIMENSION_REDUCTION",
            "result_data": {"dimensions": [[1, 2], [3, 4]]},
            "metadata": {"method": "PCA"}
        }
        
        result = AnalysisResult.from_dict(result_dict)
        
        self.assertEqual(result.analysis_type, AnalysisType.DIMENSION_REDUCTION)
        self.assertEqual(result.metadata["method"], "PCA")


class TestAnalysisComponents(unittest.TestCase):
    """Test cases for analysis components."""

    def setUp(self):
        """Set up test fixtures."""
        # Create a small test dataset for analysis components
        self.test_data = pd.DataFrame({
            'gene1': [1.0, 2.0, 3.0],
            'gene2': [4.0, 5.0, 6.0],
            'gene3': [7.0, 8.0, 9.0]
        }, index=['cell1', 'cell2', 'cell3'])
        
        # Create a temp file with test data
        with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as f:
            self.test_file = f.name
            self.test_data.to_csv(self.test_file)
            
        # Get the analysis registry
        self.registry = get_analysis_registry()

    def tearDown(self):
        """Clean up test fixtures."""
        # Remove the temp file
        if os.path.exists(self.test_file):
            os.unlink(self.test_file)

    def test_matrix_stats_analysis(self):
        """Test the MatrixStatsAnalysis component."""
        # Create component directly
        component = MatrixStatsAnalysis()
        
        # Test with dataframe input
        params = {"data": self.test_data}
        result = component.analyze(params)
        
        self.assertEqual(result.analysis_type, AnalysisType.MATRIX_STATS)
        self.assertIn("mean", result.result_data)
        self.assertIn("std", result.result_data)
        self.assertIn("min", result.result_data)
        self.assertIn("max", result.result_data)
        
        # Test with file input
        params = {"input": self.test_file}
        result = component.analyze(params)
        
        self.assertEqual(result.analysis_type, AnalysisType.MATRIX_STATS)
        self.assertIn("mean", result.result_data)
        
        # Verify specific results
        self.assertAlmostEqual(result.result_data["mean"], 5.0)
        self.assertAlmostEqual(result.result_data["max"], 9.0)
        self.assertAlmostEqual(result.result_data["min"], 1.0)
        
        # Verify metadata is included
        self.assertEqual(result.metadata["rows"], 3)
        self.assertEqual(result.metadata["columns"], 3)

    def test_clustering_analysis(self):
        """Test the ClusteringAnalysis component."""
        # Create component directly
        component = ClusteringAnalysis()
        
        # Test clustering
        params = {
            "data": self.test_data,
            "n_clusters": 2,
            "algorithm": "kmeans"
        }
        
        result = component.analyze(params)
        
        self.assertEqual(result.analysis_type, AnalysisType.CLUSTERING)
        self.assertIn("clusters", result.result_data)
        self.assertIn("cluster_centers", result.result_data)
        
        # Check result structure
        clusters = result.result_data["clusters"]
        self.assertEqual(len(clusters), 3)  # One assignment per row
        
        # Check metadata
        self.assertEqual(result.metadata["algorithm"], "kmeans")
        self.assertEqual(result.metadata["n_clusters"], 2)

    def test_dimension_reduction_analysis(self):
        """Test the DimensionReductionAnalysis component."""
        # Create component directly
        component = DimensionReductionAnalysis()
        
        # Test with PCA
        params = {
            "data": self.test_data,
            "method": "pca",
            "n_components": 2
        }
        
        result = component.analyze(params)
        
        self.assertEqual(result.analysis_type, AnalysisType.DIMENSION_REDUCTION)
        self.assertIn("reduced_data", result.result_data)
        
        # Check result structure
        reduced = result.result_data["reduced_data"]
        self.assertEqual(len(reduced), 3)  # One per row
        self.assertEqual(len(reduced[0]), 2)  # 2 components
        
        # Check metadata
        self.assertEqual(result.metadata["method"], "pca")
        self.assertEqual(result.metadata["n_components"], 2)
        self.assertIn("explained_variance", result.metadata)

    def test_analysis_registry(self):
        """Test the analysis registry functionality."""
        # Check that all analysis types are registered
        registered_types = self.registry.list_components()
        self.assertGreaterEqual(len(registered_types), 3)
        
        # Get component types
        component_types = [comp["analysis_type"] for comp in registered_types]
        self.assertIn("MATRIX_STATS", component_types)
        self.assertIn("CLUSTERING", component_types)
        self.assertIn("DIMENSION_REDUCTION", component_types)
        
        # Test analyzing with registry
        result = self.registry.analyze(
            AnalysisType.MATRIX_STATS,
            {"data": self.test_data}
        )
        
        self.assertEqual(result.analysis_type, AnalysisType.MATRIX_STATS)
        self.assertIn("mean", result.result_data)

    def test_invalid_analysis_type(self):
        """Test handling of invalid analysis types."""
        with self.assertRaises(ValueError):
            self.registry.analyze("INVALID_TYPE", {})

    def test_missing_parameters(self):
        """Test handling of missing parameters."""
        # Missing data parameter
        with self.assertRaises(ValueError):
            component = MatrixStatsAnalysis()
            component.analyze({})

    def test_custom_component_registration(self):
        """Test registering a custom component."""
        # Create a custom analysis component
        class CustomAnalysis(AnalysisComponent):
            @property
            def analysis_type(self):
                return "CUSTOM"
                
            def analyze(self, params):
                return AnalysisResult(
                    analysis_type="CUSTOM",
                    result_data={"result": "custom_result"},
                    metadata={"custom": True}
                )
        
        # Create a new registry
        registry = AnalysisRegistry()
        
        # Register the custom component
        registry.register_component(CustomAnalysis())
        
        # Check if it's registered
        components = registry.list_components()
        component_types = [comp["analysis_type"] for comp in components]
        self.assertIn("CUSTOM", component_types)
        
        # Try analyzing with the custom component
        result = registry.analyze("CUSTOM", {})
        self.assertEqual(result.result_data["result"], "custom_result")


if __name__ == '__main__':
    unittest.main()