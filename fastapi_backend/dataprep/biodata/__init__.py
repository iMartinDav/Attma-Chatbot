"""
Bioinformatics data processing module.

This package provides functionality for processing bioinformatics data,
particularly matrix files used in single-cell RNA-seq analysis.
"""

from .matrix_parser import MatrixStructure
from .data_processor import BioinformaticsProcessor
from .workflow_runner import WorkflowRunner

__all__ = ['MatrixStructure', 'BioinformaticsProcessor', 'WorkflowRunner'] 