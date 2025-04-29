"""
Unit tests for the analysis components module.
"""

import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch
import numpy as np
import pandas as pd

from dataprep.biodata.analysis_components import (
    AnalysisType, AnalysisComponent, AnalysisResult, AnalysisRegistry
)


class TestAnalysisComponents(unittest.TestCase):
    """Test suite for the analysis components system."""
    
    def setUp(self):
        """Set up test fixtures before each test method is run."""
        # Create a test registry
        self.registry = AnalysisRegistry()
        
        # Create a simple test component
        class TestComponent(AnalysisComponent):
            def get_name(self):
                return "test_component"
                
            def analyze(self, params):
                # Simple analysis that returns input params
                return AnalysisResult(
                    analysis_type=AnalysisType.CUSTOM,
                    result_data={"params": params, "added": "value"},
                    metadata={"component": "test"}
                )
        
        # Register the test component
        self.registry.register_component(AnalysisType.CUSTOM, TestComponent())
        
        # Create test data file
        with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as f:
            f.write(b"cell,gene1,gene2,gene3\n")
            f.write(b"cell1,1.0,2.0,3.0\n")
            f.write(b"cell2,4.0,5.0,6.0\n")
            f.write(b"cell3,7.0,8.0,9.0\n")
            self.test_file = f.name
    
    def tearDown(self):
        """Tear down test fixtures after each test method is run."""
        # Remove the test file
        if hasattr(self, 'test_file') and os.path.exists(self.test_file):
            os.unlink(self.test_file)
    
    def test_component_registration(self):
        """Test that components can be registered and retrieved."""
        # Check that our test component was registered
        components = self.registry.list_components()
        self.assertEqual(len(components), 1)
        self.assertEqual(components[0]["name"], "test_component")
        
        # Register another component
        class AnotherComponent(AnalysisComponent):
            def get_name(self):
                return "another_component"
                
            def analyze(self, params):
                return AnalysisResult(
                    analysis_type=AnalysisType.MATRIX_STATS,
                    result_data={"test": True},
                    metadata={}
                )
        
        self.registry.register_component(AnalysisType.MATRIX_STATS, AnotherComponent())
        
        # Check that now we have two components
        components = self.registry.list_components()
        self.assertEqual(len(components), 2)
    
    def test_analyze_with_component(self):
        """Test analysis using a registered component."""
        # Run an analysis with our test component
        test_params = {"input": "data", "option": True}
        result = self.registry.analyze(AnalysisType.CUSTOM, test_params)
        
        # Check the result
        self.assertEqual(result.analysis_type, AnalysisType.CUSTOM)
        self.assertEqual(result.result_data["params"], test_params)
        self.assertEqual(result.result_data["added"], "value")
        self.assertEqual(result.metadata["component"], "test")
    
    def test_unsupported_analysis_type(self):
        """Test that an error is raised for unsupported analysis types."""
        # Try to run an analysis with an unsupported type
        with self.assertRaises(ValueError):
            self.registry.analyze(AnalysisType.CLUSTERING, {})
    
    def test_analysis_result_serialization(self):
        """Test serialization and deserialization of AnalysisResult."""
        # Create a result with different data types
        original = AnalysisResult(
            analysis_type=AnalysisType.DIMENSION_REDUCTION,
            result_data={
                "coordinates": [[1.0, 2.0], [3.0, 4.0]],
                "labels": ["A", "B"],
                "metrics": {
                    "stress": 0.1,
                    "converged": True
                }
            },
            metadata={
                "timestamp": "2025-04-23T14:30:00",
                "duration_ms": 1500
            }
        )
        
        # Convert to dict
        result_dict = original.to_dict()
        
        # Convert back to AnalysisResult
        restored = AnalysisResult.from_dict(result_dict)
        
        # Verify that the restored object matches the original
        self.assertEqual(restored.analysis_type, original.analysis_type)
        self.assertEqual(restored.result_data["coordinates"], original.result_data["coordinates"])
        self.assertEqual(restored.result_data["labels"], original.result_data["labels"])
        self.assertEqual(restored.result_data["metrics"]["stress"], original.result_data["metrics"]["stress"])
        self.assertEqual(restored.metadata["timestamp"], original.metadata["timestamp"])
    
    def test_matrix_stats_analysis(self):
        """Test running a matrix stats analysis on test data."""
        # Register a matrix stats component if not already registered
        if not self.registry.has_component(AnalysisType.MATRIX_STATS):
            # Create a simple matrix stats component
            class MatrixStatsComponent(AnalysisComponent):
                def get_name(self):
                    return "matrix_stats"
                    
                def analyze(self, params):
                    # Read the CSV file
                    input_file = params.get("input")
                    if not input_file:
                        raise ValueError("Missing input parameter")
                        
                    df = pd.read_csv(input_file, index_col=0)
                    
                    # Calculate simple statistics
                    stats = {
                        "num_rows": df.shape[0],
                        "num_cols": df.shape[1],
                        "mean": df.mean().mean(),
                        "std": df.std().mean()
                    }
                    
                    return AnalysisResult(
                        analysis_type=AnalysisType.MATRIX_STATS,
                        result_data=stats,
                        metadata={"file": input_file}
                    )
            
            self.registry.register_component(AnalysisType.MATRIX_STATS, MatrixStatsComponent())
        
        # Run the analysis
        result = self.registry.analyze(
            AnalysisType.MATRIX_STATS,
            {"input": self.test_file}
        )
        
        # Verify the result
        self.assertEqual(result.analysis_type, AnalysisType.MATRIX_STATS)
        self.assertEqual(result.result_data["num_rows"], 3)  # 3 rows in our test file
        self.assertEqual(result.result_data["num_cols"], 3)  # 3 columns (gene1, gene2, gene3)
        self.assertTrue("mean" in result.result_data)
        self.assertTrue("std" in result.result_data)


if __name__ == "__main__":
    unittest.main()