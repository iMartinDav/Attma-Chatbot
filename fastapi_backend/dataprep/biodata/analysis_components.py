"""
Bioinformatics Analysis Components.

This module provides modular components for bioinformatics data analysis,
with standardized interfaces for different analysis types.
"""

import os
import json
import logging
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, Optional, List, Union, Tuple, ClassVar
from enum import Enum
import numpy as np
import pandas as pd
from scipy import sparse

from .matrix_parser import MatrixStructure, MatrixFormatError
from .data_processor import BioinformaticsProcessor, DataProcessingError

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AnalysisType(str, Enum):
    """Types of bioinformatics analyses supported by the framework."""
    MATRIX_STATS = "matrix_stats"
    DIMENSION_REDUCTION = "dimension_reduction"
    CLUSTERING = "clustering"
    DIFFERENTIAL_EXPRESSION = "differential_expression"
    GENE_SET_ENRICHMENT = "gene_set_enrichment"
    TRAJECTORY_ANALYSIS = "trajectory_analysis"
    CUSTOM_WORKFLOW = "custom_workflow"


class AnalysisResult:
    """
    Container for analysis results with serialization capabilities.
    
    Attributes:
        analysis_type: Type of analysis performed
        result_data: Dictionary of result data
        metadata: Additional metadata about the analysis
        visualization_hints: Hints for frontend visualization
        artifact_type: Type of artifact to use for visualization
        storage_type: How the result should be stored (database, blob)
    """
    
    def __init__(
        self,
        analysis_type: AnalysisType,
        result_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
        visualization_hints: Optional[Dict[str, Any]] = None,
        artifact_type: str = "table",
        storage_type: str = "database"
    ):
        """
        Initialize an analysis result.
        
        Args:
            analysis_type: Type of analysis performed
            result_data: Dictionary of result data
            metadata: Additional metadata about the analysis
            visualization_hints: Hints for frontend visualization
            artifact_type: Type of artifact to use for visualization
            storage_type: How the result should be stored (database, blob)
        """
        self.analysis_type = analysis_type
        self.result_data = result_data
        self.metadata = metadata or {}
        self.visualization_hints = visualization_hints or {}
        self.artifact_type = artifact_type
        self.storage_type = storage_type
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary for serialization."""
        return {
            "analysis_type": self.analysis_type,
            "result_data": self.result_data,
            "metadata": self.metadata,
            "visualization_hints": self.visualization_hints,
            "artifact_type": self.artifact_type,
            "storage_type": self.storage_type
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AnalysisResult':
        """Create an AnalysisResult from a dictionary."""
        return cls(
            analysis_type=data["analysis_type"],
            result_data=data["result_data"],
            metadata=data.get("metadata"),
            visualization_hints=data.get("visualization_hints"),
            artifact_type=data.get("artifact_type", "table"),
            storage_type=data.get("storage_type", "database")
        )
    
    def get_size(self) -> int:
        """Get the approximate size of the result data in bytes."""
        return len(json.dumps(self.result_data))
    
    def should_use_blob_storage(self, threshold_bytes: int = 1024 * 1024) -> bool:
        """
        Determine if this result should use blob storage based on size.
        
        Args:
            threshold_bytes: Size threshold for using blob storage
            
        Returns:
            True if result should use blob storage, False otherwise
        """
        return self.get_size() >= threshold_bytes


class AnalysisComponent(ABC):
    """
    Abstract base class for analysis components.
    
    This class defines the interface for all analysis components.
    Subclasses must implement the analyze method.
    
    Attributes:
        name: Human-readable name for the component
        description: Description of what the component does
        analysis_type: Type of analysis this component performs
        supported_formats: List of supported input formats
        required_params: List of required parameters
    """
    
    name: ClassVar[str] = "Abstract Analysis Component"
    description: ClassVar[str] = "Base class for analysis components"
    analysis_type: ClassVar[AnalysisType] = None
    supported_formats: ClassVar[List[str]] = []
    required_params: ClassVar[List[str]] = []
    
    @abstractmethod
    def analyze(self, params: Dict[str, Any]) -> AnalysisResult:
        """
        Run the analysis with the provided parameters.
        
        Args:
            params: Parameters for the analysis
            
        Returns:
            Analysis result object
            
        Raises:
            ValueError: If required parameters are missing
            DataProcessingError: If analysis fails
        """
        pass
    
    def validate_params(self, params: Dict[str, Any]) -> None:
        """
        Validate that required parameters are present.
        
        Args:
            params: Parameters to validate
            
        Raises:
            ValueError: If required parameters are missing
        """
        missing_params = [param for param in self.required_params if param not in params]
        if missing_params:
            raise ValueError(f"Missing required parameters: {', '.join(missing_params)}")
    
    @classmethod
    def get_info(cls) -> Dict[str, Any]:
        """Get information about this analysis component."""
        return {
            "name": cls.name,
            "description": cls.description,
            "analysis_type": cls.analysis_type,
            "supported_formats": cls.supported_formats,
            "required_params": cls.required_params
        }


class MatrixStatsAnalysis(AnalysisComponent):
    """
    Analyze basic statistics of a gene expression matrix.
    
    This component computes basic statistics like gene and cell counts,
    expression distributions, and quality control metrics.
    """
    
    name = "Matrix Statistics Analysis"
    description = "Computes basic statistics for gene expression matrices"
    analysis_type = AnalysisType.MATRIX_STATS
    supported_formats = ["mtx", "csv", "tsv", "h5ad"]
    required_params = ["input"]
    
    def analyze(self, params: Dict[str, Any]) -> AnalysisResult:
        """
        Analyze matrix statistics.
        
        Args:
            params: Parameters for the analysis (must include 'input')
            
        Returns:
            Analysis result with matrix statistics
        """
        self.validate_params(params)
        
        input_path = params["input"]
        
        try:
            # Process the input file
            processor = BioinformaticsProcessor(input_path)
            matrix_struct = processor.matrix_structure
            
            # Compute basic statistics
            stats = {
                "num_rows": matrix_struct.num_rows,
                "num_columns": matrix_struct.num_columns,
                "data_type": matrix_struct.data_type,
                "has_header_row": matrix_struct.has_header_row,
                "has_header_column": matrix_struct.has_header_column
            }
            
            # Add column names sample if available
            if matrix_struct.column_names:
                stats["column_names_sample"] = matrix_struct.column_names[:10]
            
            # Add row names sample if available
            if matrix_struct.row_names:
                stats["row_names_sample"] = matrix_struct.row_names[:10]
            
            # Add more advanced statistics if requested
            if params.get("compute_advanced_stats", False):
                advanced_stats = self._compute_advanced_statistics(input_path, matrix_struct)
                stats.update(advanced_stats)
            
            # Create metadata
            metadata = {
                "file_path": input_path,
                "analysis_date": str(pd.Timestamp.now())
            }
            
            # Create visualization hints
            visualization_hints = {
                "primary_view": "summary_table",
                "secondary_views": ["distribution_plot", "heatmap"],
                "color_scheme": "viridis"
            }
            
            return AnalysisResult(
                analysis_type=self.analysis_type,
                result_data=stats,
                metadata=metadata,
                visualization_hints=visualization_hints,
                artifact_type="table"
            )
            
        except Exception as e:
            logger.error(f"Error in matrix statistics analysis: {str(e)}")
            if isinstance(e, (DataProcessingError, ValueError)):
                raise
            raise DataProcessingError(f"Matrix statistics analysis failed: {str(e)}")
    
    def _compute_advanced_statistics(
        self, 
        input_path: str, 
        matrix_struct: MatrixStructure
    ) -> Dict[str, Any]:
        """
        Compute advanced statistics for the matrix.
        
        Args:
            input_path: Path to the input file
            matrix_struct: Matrix structure information
            
        Returns:
            Dictionary of advanced statistics
        """
        # This is a placeholder for more advanced statistics
        # In a real implementation, we would compute things like:
        # - Distributional statistics (mean, median, percentiles)
        # - Sparsity analysis
        # - Quality metrics (% mitochondrial, % ribosomal)
        # - Feature correlation analysis
        return {
            "advanced_stats_computed": False,
            "advanced_stats_message": "Advanced statistics not yet implemented"
        }


class DimensionReductionAnalysis(AnalysisComponent):
    """
    Perform dimension reduction on gene expression matrices.
    
    This component implements various dimension reduction techniques
    such as PCA, t-SNE, and UMAP for visualizing high-dimensional data.
    """
    
    name = "Dimension Reduction Analysis"
    description = "Reduces dimensions of gene expression matrices for visualization"
    analysis_type = AnalysisType.DIMENSION_REDUCTION
    supported_formats = ["mtx", "csv", "tsv", "h5ad"]
    required_params = ["input", "method"]
    
    def analyze(self, params: Dict[str, Any]) -> AnalysisResult:
        """
        Perform dimension reduction analysis.
        
        Args:
            params: Parameters including 'input' and 'method' (pca, tsne, umap)
            
        Returns:
            Analysis result with dimension reduction coordinates
        """
        self.validate_params(params)
        
        input_path = params["input"]
        method = params["method"].lower()
        n_components = params.get("n_components", 2)
        
        if method not in ["pca", "tsne", "umap"]:
            raise ValueError(f"Unsupported dimension reduction method: {method}")
        
        try:
            # This would be implemented using libraries like sklearn, umap-learn, etc.
            # For now, we'll simulate the results
            
            # Process the input file (just to validate and get dimensions)
            processor = BioinformaticsProcessor(input_path)
            matrix_struct = processor.matrix_structure
            
            # Simulate dimension reduction results
            n_cells = min(matrix_struct.num_columns, 1000)  # Limit for demo purposes
            
            # Generate random coordinates as a placeholder
            np.random.seed(42)  # For reproducibility
            coordinates = np.random.normal(size=(n_cells, n_components)).tolist()
            
            # Create sample cell names
            cell_names = [f"cell_{i}" for i in range(n_cells)]
            
            # Build result data
            result_data = {
                "method": method,
                "n_components": n_components,
                "n_cells": n_cells,
                "cell_names": cell_names,
                "coordinates": coordinates
            }
            
            # Create metadata
            metadata = {
                "file_path": input_path,
                "method_params": {
                    "perplexity": params.get("perplexity", 30) if method == "tsne" else None,
                    "neighbors": params.get("neighbors", 15) if method == "umap" else None,
                    "random_state": 42
                },
                "analysis_date": str(pd.Timestamp.now())
            }
            
            # Create visualization hints
            visualization_hints = {
                "primary_view": "scatter_plot",
                "color_by": params.get("color_by", "cluster"),
                "point_size": params.get("point_size", 5),
                "color_scheme": "viridis"
            }
            
            return AnalysisResult(
                analysis_type=self.analysis_type,
                result_data=result_data,
                metadata=metadata,
                visualization_hints=visualization_hints,
                artifact_type="graph"
            )
            
        except Exception as e:
            logger.error(f"Error in dimension reduction analysis: {str(e)}")
            if isinstance(e, (DataProcessingError, ValueError)):
                raise
            raise DataProcessingError(f"Dimension reduction analysis failed: {str(e)}")


class ClusteringAnalysis(AnalysisComponent):
    """
    Perform clustering analysis on gene expression data.
    
    This component implements various clustering algorithms
    to group cells or genes based on expression patterns.
    """
    
    name = "Clustering Analysis"
    description = "Clusters cells or genes based on expression patterns"
    analysis_type = AnalysisType.CLUSTERING
    supported_formats = ["mtx", "csv", "tsv", "h5ad"]
    required_params = ["input", "method"]
    
    def analyze(self, params: Dict[str, Any]) -> AnalysisResult:
        """
        Perform clustering analysis.
        
        Args:
            params: Parameters including 'input' and 'method'
            
        Returns:
            Analysis result with cluster assignments
        """
        self.validate_params(params)
        
        input_path = params["input"]
        method = params["method"].lower()
        n_clusters = params.get("n_clusters", 10)
        
        if method not in ["kmeans", "louvain", "leiden", "hierarchical"]:
            raise ValueError(f"Unsupported clustering method: {method}")
        
        try:
            # This would be implemented using libraries like sklearn, scanpy, etc.
            # For now, we'll simulate the results
            
            # Process the input file (just to validate and get dimensions)
            processor = BioinformaticsProcessor(input_path)
            matrix_struct = processor.matrix_structure
            
            # Simulate clustering results
            n_cells = min(matrix_struct.num_columns, 1000)  # Limit for demo purposes
            
            # Generate random cluster assignments as a placeholder
            np.random.seed(42)  # For reproducibility
            clusters = np.random.randint(0, n_clusters, size=n_cells).tolist()
            
            # Create sample cell names
            cell_names = [f"cell_{i}" for i in range(n_cells)]
            
            # Build result data
            result_data = {
                "method": method,
                "n_clusters": n_clusters,
                "n_cells": n_cells,
                "cell_names": cell_names,
                "clusters": clusters
            }
            
            # Create metadata
            metadata = {
                "file_path": input_path,
                "method_params": {
                    "resolution": params.get("resolution", 0.8) if method in ["louvain", "leiden"] else None,
                    "random_state": 42
                },
                "analysis_date": str(pd.Timestamp.now())
            }
            
            # Create visualization hints
            visualization_hints = {
                "primary_view": "cluster_plot",
                "secondary_views": ["heatmap", "umap_with_clusters"],
                "color_scheme": "tab20"
            }
            
            return AnalysisResult(
                analysis_type=self.analysis_type,
                result_data=result_data,
                metadata=metadata,
                visualization_hints=visualization_hints,
                artifact_type="graph"
            )
            
        except Exception as e:
            logger.error(f"Error in clustering analysis: {str(e)}")
            if isinstance(e, (DataProcessingError, ValueError)):
                raise
            raise DataProcessingError(f"Clustering analysis failed: {str(e)}")


class AnalysisRegistry:
    """
    Registry of analysis components.
    
    This class manages the available analysis components and provides
    methods to find and instantiate the appropriate component for a given
    analysis type or parameters.
    """
    
    def __init__(self):
        """Initialize the registry with default components."""
        self._components = {}
        
        # Register default components
        self.register(MatrixStatsAnalysis)
        self.register(DimensionReductionAnalysis)
        self.register(ClusteringAnalysis)
    
    def register(self, component_class: type) -> None:
        """
        Register a new analysis component class.
        
        Args:
            component_class: The component class to register
        """
        if not issubclass(component_class, AnalysisComponent):
            raise TypeError("Component must be a subclass of AnalysisComponent")
        
        analysis_type = component_class.analysis_type
        if analysis_type is None:
            raise ValueError("Component must define an analysis_type")
        
        self._components[analysis_type] = component_class
        logger.info(f"Registered analysis component: {component_class.name} ({analysis_type})")
    
    def get_component(self, analysis_type: AnalysisType) -> AnalysisComponent:
        """
        Get a component instance for the specified analysis type.
        
        Args:
            analysis_type: The type of analysis to perform
            
        Returns:
            An instance of the appropriate analysis component
            
        Raises:
            ValueError: If no component is registered for the analysis type
        """
        if analysis_type not in self._components:
            raise ValueError(f"No component registered for analysis type: {analysis_type}")
        
        component_class = self._components[analysis_type]
        return component_class()
    
    def list_components(self) -> List[Dict[str, Any]]:
        """
        List all registered analysis components.
        
        Returns:
            List of component information dictionaries
        """
        return [component_class.get_info() for component_class in self._components.values()]
    
    def analyze(self, analysis_type: AnalysisType, params: Dict[str, Any]) -> AnalysisResult:
        """
        Perform an analysis using the appropriate component.
        
        Args:
            analysis_type: The type of analysis to perform
            params: Parameters for the analysis
            
        Returns:
            Analysis result
            
        Raises:
            ValueError: If no component is registered for the analysis type
        """
        component = self.get_component(analysis_type)
        return component.analyze(params)


# Global registry instance
registry = AnalysisRegistry()


def register_analysis_component(component_class: type) -> type:
    """
    Decorator to register an analysis component with the global registry.
    
    Args:
        component_class: The component class to register
        
    Returns:
        The original component class
    """
    registry.register(component_class)
    return component_class


def get_analysis_registry() -> AnalysisRegistry:
    """
    Get the global analysis registry.
    
    Returns:
        The global analysis registry instance
    """
    return registry


# Example usage
if __name__ == "__main__":
    # Get the registry
    registry = get_analysis_registry()
    
    # List available components
    components = registry.list_components()
    print(f"Available analysis components:")
    for component in components:
        print(f"- {component['name']} ({component['analysis_type']})")
    
    # Create a test input file
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
        f.write(b"gene,cell1,cell2,cell3\n")
        f.write(b"gene1,1.0,2.0,3.0\n")
        f.write(b"gene2,4.0,5.0,6.0\n")
        test_file = f.name
    
    try:
        # Run a matrix stats analysis
        print("\nRunning matrix stats analysis...")
        result = registry.analyze(
            AnalysisType.MATRIX_STATS,
            {"input": test_file}
        )
        print(f"Result: {result.to_dict()}")
        
        # Run a dimension reduction analysis
        print("\nRunning dimension reduction analysis...")
        result = registry.analyze(
            AnalysisType.DIMENSION_REDUCTION,
            {"input": test_file, "method": "pca"}
        )
        print(f"Result: {result.to_dict()}")
        
    finally:
        # Clean up
        if os.path.exists(test_file):
            os.unlink(test_file)