"""
Unit tests for result formatters.
"""

import unittest
import json
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock
import tempfile
import os
from typing import Dict, Any, List

from ..result_formatters import (
    FormatterRegistry, FormatType, ResultFormatter,
    TableFormatter, GraphFormatter, ChartFormatter,
    get_formatter_registry, format_result
)

from ..analysis_components import (
    AnalysisType, AnalysisResult
)

class TestResultFormatters(unittest.TestCase):
    """Test cases for result formatters."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Create test analysis result data
        self.matrix_stats_result = AnalysisResult(
            analysis_type=AnalysisType.MATRIX_STATS,
            result_data={
                "mean": 5.0,
                "std": 1.5,
                "min": 1.0,
                "max": 10.0,
                "missing_values": 0
            },
            metadata={
                "rows": 100,
                "columns": 50,
                "source_file": "test_data.csv"
            }
        )
        
        self.clustering_result = AnalysisResult(
            analysis_type=AnalysisType.CLUSTERING,
            result_data={
                "clusters": [0, 1, 0, 2, 1, 0],
                "cluster_centers": [
                    [1.0, 2.0], 
                    [4.0, 5.0], 
                    [7.0, 8.0]
                ]
            },
            metadata={
                "algorithm": "kmeans",
                "n_clusters": 3,
                "sample_names": ["s1", "s2", "s3", "s4", "s5", "s6"]
            }
        )
        
        self.dimension_reduction_result = AnalysisResult(
            analysis_type=AnalysisType.DIMENSION_REDUCTION,
            result_data={
                "reduced_data": [
                    [1.0, 2.0], 
                    [3.0, 4.0], 
                    [5.0, 6.0]
                ]
            },
            metadata={
                "method": "pca",
                "n_components": 2,
                "explained_variance": [0.8, 0.15],
                "sample_names": ["s1", "s2", "s3"]
            }
        )
        
        # Get the formatter registry
        self.registry = get_formatter_registry()

    def test_table_formatter(self):
        """Test the TableFormatter."""
        # Create formatter directly
        formatter = TableFormatter()
        
        # Test with matrix stats result
        output = formatter.format(self.matrix_stats_result)
        
        # Check structure of formatted output
        self.assertEqual(output["format_type"], "TABLE")
        self.assertIn("headers", output["data"])
        self.assertIn("rows", output["data"])
        
        # Check content
        headers = output["data"]["headers"]
        rows = output["data"]["rows"]
        
        # For matrix stats, we expect key-value pairs as rows
        self.assertIn("Statistic", headers)
        self.assertIn("Value", headers)
        self.assertGreaterEqual(len(rows), 5)  # At least 5 statistics
        
        # Test with clustering result
        output = formatter.format(self.clustering_result)
        self.assertEqual(output["format_type"], "TABLE")
        
        # For clustering, we expect a table of samples and their clusters
        self.assertIn("Sample", output["data"]["headers"])
        self.assertIn("Cluster", output["data"]["headers"])
        self.assertEqual(len(output["data"]["rows"]), 6)  # 6 samples

    def test_graph_formatter(self):
        """Test the GraphFormatter."""
        # Create formatter directly
        formatter = GraphFormatter()
        
        # Test with clustering result - should create graph visualization
        output = formatter.format(self.clustering_result)
        
        # Check structure
        self.assertEqual(output["format_type"], "GRAPH")
        self.assertIn("nodes", output["data"])
        self.assertIn("edges", output["data"])
        
        # Check content for clustering (expect nodes for samples and clusters)
        nodes = output["data"]["nodes"]
        self.assertGreaterEqual(len(nodes), 9)  # 6 samples + 3 cluster centers
        
        # Test with dimension reduction result
        output = formatter.format(self.dimension_reduction_result)
        
        # Check structure (should be a scatter plot representation)
        self.assertEqual(output["format_type"], "GRAPH")
        self.assertIn("nodes", output["data"])
        
        # Check content (should have 3 nodes for the 3 samples)
        nodes = output["data"]["nodes"]
        self.assertEqual(len(nodes), 3)

    def test_chart_formatter(self):
        """Test the ChartFormatter."""
        # Create formatter directly
        formatter = ChartFormatter()
        
        # Test with matrix stats result
        output = formatter.format(self.matrix_stats_result)
        
        # Check structure
        self.assertEqual(output["format_type"], "CHART")
        self.assertIn("chart_type", output["data"])
        self.assertIn("data", output["data"])
        
        # For matrix stats, expect a bar chart
        self.assertEqual(output["data"]["chart_type"], "bar")
        
        # Test with dimension reduction result
        output = formatter.format(self.dimension_reduction_result)
        
        # Check structure (should be a scatter plot)
        self.assertEqual(output["format_type"], "CHART")
        self.assertEqual(output["data"]["chart_type"], "scatter")
        
        # Check content
        scatter_data = output["data"]["data"]
        self.assertEqual(len(scatter_data["x"]), 3)  # 3 points
        self.assertEqual(len(scatter_data["y"]), 3)  # 3 points
        
        # Test explained variance chart
        self.assertIn("secondary_chart", output["data"])
        self.assertEqual(output["data"]["secondary_chart"]["chart_type"], "bar")
        self.assertEqual(len(output["data"]["secondary_chart"]["data"]["x"]), 2)

    def test_formatter_registry(self):
        """Test the formatter registry functionality."""
        # Check that all format types are registered
        registered_formatters = self.registry.list_formatters()
        self.assertGreaterEqual(len(registered_formatters), 3)
        
        # Check formatter types
        formatter_types = [fmt["format_type"] for fmt in registered_formatters]
        self.assertIn("TABLE", formatter_types)
        self.assertIn("GRAPH", formatter_types)
        self.assertIn("CHART", formatter_types)
        
        # Test formatting with registry
        output = self.registry.format(
            self.matrix_stats_result,
            FormatType.TABLE
        )
        
        self.assertEqual(output["format_type"], "TABLE")
        self.assertIn("headers", output["data"])

    def test_format_result_helper(self):
        """Test the format_result helper function."""
        # Test with explicit format type
        output = format_result(
            self.clustering_result, 
            format_type=FormatType.GRAPH
        )
        self.assertEqual(output["format_type"], "GRAPH")
        
        # Test with automatic format type selection
        output = format_result(self.dimension_reduction_result)
        # Dimension reduction should default to CHART
        self.assertEqual(output["format_type"], "CHART")
        
        # Test with matrix stats
        output = format_result(self.matrix_stats_result)
        # Matrix stats should default to TABLE
        self.assertEqual(output["format_type"], "TABLE")

    def test_invalid_format_type(self):
        """Test handling of invalid format types."""
        with self.assertRaises(ValueError):
            self.registry.format(self.matrix_stats_result, "INVALID_TYPE")

    def test_custom_formatter_registration(self):
        """Test registering a custom formatter."""
        # Create a custom formatter
        class CustomFormatter(ResultFormatter):
            @property
            def format_type(self):
                return "CUSTOM"
                
            def format(self, result: AnalysisResult) -> Dict[str, Any]:
                return {
                    "format_type": "CUSTOM",
                    "data": {
                        "custom_field": result.result_data,
                        "message": "Custom formatted output"
                    }
                }
        
        # Create a new registry
        registry = FormatterRegistry()
        
        # Register the custom formatter
        registry.register_formatter(CustomFormatter())
        
        # Check if it's registered
        formatters = registry.list_formatters()
        formatter_types = [fmt["format_type"] for fmt in formatters]
        self.assertIn("CUSTOM", formatter_types)
        
        # Try formatting with the custom formatter
        output = registry.format(self.matrix_stats_result, "CUSTOM")
        self.assertEqual(output["format_type"], "CUSTOM")
        self.assertEqual(output["data"]["message"], "Custom formatted output")

    def test_json_serialization(self):
        """Test that formatter outputs are JSON serializable."""
        # Format results with each formatter type
        table_output = format_result(self.matrix_stats_result, FormatType.TABLE)
        graph_output = format_result(self.clustering_result, FormatType.GRAPH) 
        chart_output = format_result(self.dimension_reduction_result, FormatType.CHART)
        
        # Try to serialize each output to JSON
        try:
            json.dumps(table_output)
            json.dumps(graph_output)
            json.dumps(chart_output)
            serialization_succeeded = True
        except TypeError:
            serialization_succeeded = False
            
        self.assertTrue(serialization_succeeded, "Formatter output should be JSON serializable")


if __name__ == '__main__':
    unittest.main()
