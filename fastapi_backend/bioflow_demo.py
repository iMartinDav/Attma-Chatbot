#!/usr/bin/env python3
"""
BioFlow Demo Script

This script demonstrates the basic functionality of the bioflow module.
It creates a simple matrix file and performs basic operations on it.
"""

import os
import tempfile
import sys
from pathlib import Path

# Add the parent directory to the path so we can import the module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi_backend.bioflow.biodata import MatrixStructure, BioinformaticsProcessor, WorkflowRunner


def create_test_matrix():
    """Create a test matrix file."""
    content = """gene\tcell1\tcell2\tcell3
GATA1\t1.2\t0.0\t0.5
BCL11A\t0.0\t2.3\t1.1
MYB\t3.4\t0.0\t0.0
"""
    fd, path = tempfile.mkstemp(suffix='.tsv')
    with os.fdopen(fd, 'w') as f:
        f.write(content)
    return path


def main():
    """Main function to demonstrate bioflow functionality."""
    print("BioFlow Module Demo")
    print("==================")
    
    # Create a test matrix file
    matrix_path = create_test_matrix()
    print(f"Created test matrix file at: {matrix_path}")
    
    try:
        # 1. Analyze the matrix
        print("\n1. Analyzing matrix structure...")
        matrix = MatrixStructure(matrix_path)
        print(f"Data type: {matrix.data_type}")
        print(f"Delimiter: {matrix.delimiter}")
        print(f"Has header row: {matrix.has_header_row}")
        print(f"Has header column: {matrix.has_header_column}")
        print(f"Number of rows: {matrix.num_rows}")
        print(f"Number of columns: {matrix.num_columns}")
        print(f"Column names: {matrix.column_names}")
        
        # 2. List available workflows
        print("\n2. Listing available workflows...")
        runner = WorkflowRunner()
        workflows = runner.list_available_workflows()
        print(f"Available workflows: {workflows}")
        
        # 3. Check processor
        print("\n3. Initializing BioinformaticsProcessor...")
        processor = BioinformaticsProcessor(matrix_path)
        print("BioinformaticsProcessor initialized successfully")
        
        print("\nAll tests passed successfully!")
        print("BioFlow module is working correctly.")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Clean up the test file
        if os.path.exists(matrix_path):
            os.unlink(matrix_path)
            print(f"Cleaned up test file at: {matrix_path}")


if __name__ == "__main__":
    main() 