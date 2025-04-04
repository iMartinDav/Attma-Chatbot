"""
Tests for the matrix_parser module.
"""

import os
import pytest
import tempfile
from pathlib import Path
import numpy as np

from ..biodata.matrix_parser import MatrixStructure, MatrixFormatError


def create_test_full_matrix():
    """Create a test full matrix file."""
    content = """gene\tcell1\tcell2\tcell3
GATA1\t1.2\t0.0\t0.5
BCL11A\t0.0\t2.3\t1.1
MYB\t3.4\t0.0\t0.0
"""
    fd, path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        f.write(content)
    return path


def create_test_sparse_matrix():
    """Create a test sparse matrix file."""
    content = """3 3 4
1 1 1
1 3 1
2 2 1
3 1 1
"""
    fd, path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        f.write(content)
    return path


def test_matrix_structure_full_matrix():
    """Test MatrixStructure with a full matrix."""
    path = create_test_full_matrix()
    try:
        matrix = MatrixStructure(path)
        
        assert matrix.data_type == "matrix"
        assert matrix.delimiter == "\t"
        assert matrix.has_header_row
        assert matrix.has_header_column
        assert matrix.num_rows == 3  # Number of rows in the data (excluding header)
        assert matrix.num_columns == 3  # Number of columns in the data (excluding header)
        assert matrix.column_names == ["cell1", "cell2", "cell3"]
    finally:
        os.unlink(path)


def test_matrix_structure_sparse_matrix():
    """Test MatrixStructure with a sparse matrix."""
    path = create_test_sparse_matrix()
    try:
        matrix = MatrixStructure(path)
        
        assert matrix.data_type == "sparse_matrix"
        assert matrix.delimiter == " "
        assert not matrix.has_header_row
        assert not matrix.has_header_column
        assert matrix.num_rows == 3
        assert matrix.num_columns == 3
    finally:
        os.unlink(path)


def test_invalid_matrix():
    """Test MatrixStructure with an invalid matrix."""
    fd, path = tempfile.mkstemp()
    with os.fdopen(fd, 'w') as f:
        f.write("invalid matrix content")
    
    try:
        with pytest.raises(MatrixFormatError):
            MatrixStructure(path)
    finally:
        os.unlink(path) 