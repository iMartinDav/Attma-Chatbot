"""
Tests for the data_processor module.
"""

import os
import pytest
import tempfile
import shutil
from pathlib import Path
import numpy as np

from ..biodata.data_processor import BioinformaticsProcessor, DataProcessingError
from ..biodata.matrix_parser import MatrixStructure


def create_test_matrix_directory():
    """Create a test directory with matrix files."""
    temp_dir = tempfile.mkdtemp()
    
    # Create a sparse matrix file
    with open(os.path.join(temp_dir, "matrix.mtx"), "w") as f:
        f.write("""3 3 4
1 1 1
1 3 1
2 2 1
3 1 1
""")
    
    # Create a barcodes file
    with open(os.path.join(temp_dir, "barcodes.tsv"), "w") as f:
        f.write("""cell1
cell2
cell3
""")
    
    return temp_dir


def test_bioinformatics_processor_initialization():
    """Test BioinformaticsProcessor initialization."""
    temp_dir = create_test_matrix_directory()
    try:
        processor = BioinformaticsProcessor(temp_dir)
        
        assert processor.data_dir == Path(temp_dir)
        assert processor.matrix_structure is not None
        assert processor.matrix_structure.data_type == "sparse_matrix"
        assert processor.matrix_structure.num_rows == 3
        assert processor.matrix_structure.num_columns == 3
        assert processor.matrix_structure.data_path.name == "matrix.mtx"
        assert processor.matrix_structure.barcodes_path.name == "barcodes.tsv"
    finally:
        shutil.rmtree(temp_dir)


def test_generate_matrix_subset():
    """Test generating a matrix subset."""
    temp_dir = create_test_matrix_directory()
    try:
        processor = BioinformaticsProcessor(temp_dir)
        
        # Try to create a subset with too many columns
        with pytest.raises(ValueError):
            processor.generate_matrix_subset(4)
        
        # Create a valid subset
        subset_path = processor.generate_matrix_subset(2)
        
        assert subset_path is not None
        assert subset_path.exists()
        
        # Check that the target directory was created
        target_dir = Path(f"{temp_dir}.2")
        assert target_dir.exists()
        
        # Check that the subset has the correct files
        assert (target_dir / "matrix.mtx").exists()
        assert (target_dir / "barcodes.tsv").exists()
        
        # Verify the subset structure
        subset_matrix = MatrixStructure(subset_path)
        assert subset_matrix.num_columns == 2
        assert subset_matrix.num_rows == 3
    finally:
        shutil.rmtree(temp_dir)
        # Clean up the subset directory too
        subset_dir = Path(f"{temp_dir}.2")
        if subset_dir.exists():
            shutil.rmtree(subset_dir) 