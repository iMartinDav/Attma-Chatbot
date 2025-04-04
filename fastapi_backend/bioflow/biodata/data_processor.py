"""
Data Processor for bioinformatics matrices.

This module provides tools for preprocessing bioinformatics data,
particularly for creating subsets of large matrix files efficiently.
It supports both full matrices and sparse matrices commonly used in
single-cell RNA-seq analysis.
"""

import os
import random
import shutil
import logging
from pathlib import Path
from typing import List, Optional, Tuple, Union, Dict, Any
import numpy as np
import pandas as pd
from scipy import sparse
import urllib.parse
import urllib.request
import tempfile

from .matrix_parser import MatrixStructure, MatrixFormatError, DATATYPE_MATRIX, DATATYPE_SPARSE_MATRIX
from .bio_utils import (
    get_text_reader, get_text_writer, extract_zip, extract_tar_gz,
    get_random_indices, find_file_by_pattern, get_matrix_file, get_barcodes_file
)

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class DataProcessingError(Exception):
    """Exception raised for errors during data processing."""
    pass


class BioinformaticsProcessor:
    """
    Process bioinformatics data files, particularly matrix data.
    
    This class handles various bioinformatics data formats, with a focus on
    gene expression matrices. It supports both dense and sparse matrices,
    compressed files, and remote URLs.
    
    Attributes:
        matrix_structure (MatrixStructure): Information about the matrix structure
        data_dir (Path): Directory containing the data files
        original_url (str): Original URL or path provided by the user
        subset_structure (MatrixStructure): Information about the created subset
    """
    
    def __init__(self, source_path: str):
        """
        Initialize a data processor with a source path.
        
        Args:
            source_path: Path to a directory, archive, or file
                (can be a local path or URL)
        """
        self.original_url = source_path
        self.matrix_structure = None
        self.data_dir = None
        self.subset_structure = None
        
        self._initialize_from_source(source_path)
    
    def _initialize_from_source(self, source_path: str):
        """
        Initialize the processor from a source path.
        
        This method handles different source types:
        - Directories: Find relevant files in the directory
        - Archives (.zip, .tar.gz): Extract and process
        - Individual files: Process directly
        
        Args:
            source_path: Path to the source
        
        Raises:
            DataProcessingError: If initialization fails
        """
        try:
            # Parse URL or local path
            parsed_url = urllib.parse.urlparse(source_path)
            is_url = parsed_url.scheme in ('http', 'https', 'ftp')
            
            if is_url:
                # Handle remote URL
                temp_dir = tempfile.mkdtemp()
                temp_file = os.path.join(temp_dir, os.path.basename(parsed_url.path))
                
                # Download the file
                urllib.request.urlretrieve(source_path, temp_file)
                
                # Check if it's a directory (not typical for URLs)
                if os.path.isdir(temp_file):
                    self.data_dir = Path(temp_file)
                    matrix_file = get_matrix_file(self.data_dir)
                    barcodes_file = get_barcodes_file(self.data_dir)
                    
                    if not matrix_file:
                        raise DataProcessingError(f"No matrix file found in {temp_file}")
                    
                    self.matrix_structure = MatrixStructure(matrix_file)
                    if barcodes_file:
                        self.matrix_structure.set_barcodes_path(barcodes_file)
                
                # Check if it's an archive
                elif temp_file.endswith(('.zip', '.tar.gz', '.tgz')):
                    extract_dir = os.path.join(temp_dir, 'extracted')
                    os.makedirs(extract_dir, exist_ok=True)
                    
                    if temp_file.endswith('.zip'):
                        extract_zip(temp_file, extract_dir)
                    else:  # .tar.gz or .tgz
                        extract_tar_gz(temp_file, extract_dir)
                    
                    self.data_dir = Path(extract_dir)
                    matrix_file = get_matrix_file(self.data_dir)
                    barcodes_file = get_barcodes_file(self.data_dir)
                    
                    if not matrix_file:
                        raise DataProcessingError(f"No matrix file found in extracted archive")
                    
                    self.matrix_structure = MatrixStructure(matrix_file)
                    if barcodes_file:
                        self.matrix_structure.set_barcodes_path(barcodes_file)
                
                # Individual file
                else:
                    self.data_dir = Path(temp_dir)
                    self.matrix_structure = MatrixStructure(temp_file)
                    
                    # Look for barcodes file in the same directory
                    barcodes_file = get_barcodes_file(self.data_dir)
                    if barcodes_file:
                        self.matrix_structure.set_barcodes_path(barcodes_file)
            
            else:
                # Handle local path
                path = Path(source_path)
                
                # Check if it's a directory
                if path.is_dir():
                    self.data_dir = path
                    matrix_file = get_matrix_file(path)
                    barcodes_file = get_barcodes_file(path)
                    
                    if not matrix_file:
                        raise DataProcessingError(f"No matrix file found in {path}")
                    
                    self.matrix_structure = MatrixStructure(matrix_file)
                    if barcodes_file:
                        self.matrix_structure.set_barcodes_path(barcodes_file)
                
                # Check if it's an archive
                elif str(path).endswith(('.zip', '.tar.gz', '.tgz')):
                    extract_dir = path.with_suffix('')
                    os.makedirs(extract_dir, exist_ok=True)
                    
                    if str(path).endswith('.zip'):
                        extract_zip(path, extract_dir)
                    else:  # .tar.gz or .tgz
                        extract_tar_gz(path, extract_dir)
                    
                    self.data_dir = extract_dir
                    matrix_file = get_matrix_file(extract_dir)
                    barcodes_file = get_barcodes_file(extract_dir)
                    
                    if not matrix_file:
                        raise DataProcessingError(f"No matrix file found in extracted archive")
                    
                    self.matrix_structure = MatrixStructure(matrix_file)
                    if barcodes_file:
                        self.matrix_structure.set_barcodes_path(barcodes_file)
                
                # Individual file
                else:
                    self.data_dir = path.parent
                    self.matrix_structure = MatrixStructure(path)
                    
                    # Look for barcodes file in the same directory
                    barcodes_file = get_barcodes_file(self.data_dir)
                    if barcodes_file:
                        self.matrix_structure.set_barcodes_path(barcodes_file)
        
        except Exception as e:
            if isinstance(e, DataProcessingError):
                raise
            raise DataProcessingError(f"Error initializing from source: {str(e)}")
    
    def generate_matrix_subset(self, num_columns: int) -> Optional[Path]:
        """
        Create a subset of the data with a specified number of columns.
        
        This method creates a new directory with the subset data and copies
        other relevant files from the original directory.
        
        Args:
            num_columns: Number of columns to include in the subset
        
        Returns:
            Path to the subset matrix file, or None if an error occurs
        
        Raises:
            DataProcessingError: If subset creation fails
            ValueError: If requested columns exceed available columns
        """
        if not self.matrix_structure:
            raise DataProcessingError("Matrix structure not initialized")
        
        if num_columns >= self.matrix_structure.num_columns:
            raise ValueError(
                f"Requested {num_columns} columns, but data has only {self.matrix_structure.num_columns} columns"
            )
        
        try:
            # Create target directory for subset data
            original_dir = self.data_dir
            target_dir = Path(f"{str(original_dir)}.{num_columns}")
            target_dir.mkdir(parents=True, exist_ok=True)
            
            # Create subset based on data type
            if self.matrix_structure.data_type == DATATYPE_MATRIX:
                subset_structure = self._create_full_matrix_subset(num_columns, target_dir)
            elif self.matrix_structure.data_type == DATATYPE_SPARSE_MATRIX:
                subset_structure = self._create_sparse_matrix_subset(num_columns, target_dir)
            else:
                raise DataProcessingError(f"Unsupported data type: {self.matrix_structure.data_type}")
            
            if not subset_structure:
                return None
            
            # Copy other files from original directory (excluding matrix and barcodes)
            orig_matrix_file = self.matrix_structure.data_path.name
            exclude_files = [orig_matrix_file]
            
            if self.matrix_structure.barcodes_path:
                orig_barcodes_file = self.matrix_structure.barcodes_path.name
                exclude_files.append(orig_barcodes_file)
            
            # Copy remaining files
            for item in original_dir.glob('*'):
                if item.is_file() and item.name not in exclude_files:
                    shutil.copy2(item, target_dir)
            
            # Save subset structure for later reference
            self.subset_structure = subset_structure
            
            return subset_structure.data_path
        
        except Exception as e:
            logger.error(f"Error creating subset: {str(e)}")
            if not isinstance(e, (DataProcessingError, ValueError)):
                raise DataProcessingError(f"Error creating subset: {str(e)}")
            raise
    
    def _create_full_matrix_subset(self, num_columns: int, target_dir: Path) -> Optional[MatrixStructure]:
        """
        Create a subset of a full matrix.
        
        This method handles subsets of full matrices, preserving header rows/columns
        if present in the original file.
        
        Args:
            num_columns: Number of columns to include
            target_dir: Directory to write the subset to
            
        Returns:
            MatrixStructure for the subset, or None if an error occurs
        """
        try:
            matrix_path = self.matrix_structure.data_path
            matrix_name = matrix_path.name
            target_path = target_dir / matrix_name
            
            # Initialize subset structure
            subset_structure = MatrixStructure.__new__(MatrixStructure)
            subset_structure.data_path = target_path
            subset_structure.delimiter = self.matrix_structure.delimiter
            subset_structure.has_header_row = self.matrix_structure.has_header_row
            subset_structure.has_header_column = self.matrix_structure.has_header_column
            subset_structure.shorter_header = self.matrix_structure.shorter_header
            subset_structure.data_type = self.matrix_structure.data_type
            subset_structure.num_columns = num_columns
            
            # Select random column indices
            total_columns = self.matrix_structure.num_columns
            column_indices = get_random_indices(0, total_columns - 1, num_columns, sorted_output=False)
            
            # Open files for reading and writing
            with get_text_reader(matrix_path) as reader, get_text_writer(target_path) as writer:
                row_names = []
                row_count = 0
                
                for line in reader:
                    line = line.strip()
                    
                    # Skip comment lines
                    if any(line.startswith(comment) for comment in ('%', '#')):
                        writer.write(f"{line}\n")
                        continue
                    
                    tokens = line.split(self.matrix_structure.delimiter)
                    is_header = (row_count == 0 and self.matrix_structure.has_header_row)
                    
                    # Remove any preceding delimiter in header
                    if is_header:
                        if line.startswith(self.matrix_structure.delimiter):
                            tokens = tokens[1:]
                    
                    # Process header row
                    if is_header:
                        skip_first = not self.matrix_structure.shorter_header
                        selected_tokens = []
                        
                        # Add column header if needed
                        if skip_first:
                            writer.write(tokens[0])
                            writer.write(self.matrix_structure.delimiter)
                            start_idx = 1
                        else:
                            start_idx = 0
                        
                        # Select column headers
                        for i in range(len(column_indices)):
                            col_idx = column_indices[i]
                            token_idx = col_idx + start_idx
                            if token_idx < len(tokens):
                                selected_tokens.append(tokens[token_idx])
                        
                        subset_structure.column_names = selected_tokens
                        writer.write(self.matrix_structure.delimiter.join(selected_tokens))
                        writer.write("\n")
                    
                    # Process data rows
                    else:
                        # Handle row header if present
                        if self.matrix_structure.has_header_column:
                            row_names.append(tokens[0])
                            writer.write(tokens[0])
                            writer.write(self.matrix_structure.delimiter)
                            start_idx = 1
                        else:
                            start_idx = 0
                        
                        # Select data columns
                        selected_tokens = []
                        for i in range(len(column_indices)):
                            col_idx = column_indices[i]
                            token_idx = col_idx + start_idx
                            if token_idx < len(tokens):
                                selected_tokens.append(tokens[token_idx])
                        
                        writer.write(self.matrix_structure.delimiter.join(selected_tokens))
                        writer.write("\n")
                    
                    row_count += 1
                
                # Set row names and/or row count
                if self.matrix_structure.has_header_column:
                    subset_structure.row_names = row_names
                    subset_structure.num_rows = len(row_names)
                else:
                    subset_structure.num_rows = row_count
                
                # If there's a barcodes file, create a subset of that too
                if self.matrix_structure.barcodes_path:
                    self._create_barcodes_subset(column_indices, target_dir, subset_structure)
            
            return subset_structure
        
        except Exception as e:
            logger.error(f"Error creating full matrix subset: {str(e)}")
            return None
    
    def _create_sparse_matrix_subset(self, num_columns: int, target_dir: Path) -> Optional[MatrixStructure]:
        """
        Create a subset of a sparse matrix.
        
        This method handles subsets of sparse matrices, which are typically
        stored in coordinate format (row, column, value).
        
        Args:
            num_columns: Number of columns to include
            target_dir: Directory to write the subset to
            
        Returns:
            MatrixStructure for the subset, or None if an error occurs
        """
        try:
            matrix_path = self.matrix_structure.data_path
            matrix_name = matrix_path.name
            target_path = target_dir / matrix_name
            
            # Initialize subset structure
            subset_structure = MatrixStructure.__new__(MatrixStructure)
            subset_structure.data_path = target_path
            subset_structure.delimiter = self.matrix_structure.delimiter
            subset_structure.has_header_row = self.matrix_structure.has_header_row
            subset_structure.has_header_column = self.matrix_structure.has_header_column
            subset_structure.shorter_header = self.matrix_structure.shorter_header
            subset_structure.data_type = self.matrix_structure.data_type
            subset_structure.num_columns = num_columns
            subset_structure.num_rows = self.matrix_structure.num_rows
            
            # Create barcodes list if needed for subset
            barcodes = []
            subset_barcodes = set()
            if self.matrix_structure.barcodes_path:
                with get_text_reader(self.matrix_structure.barcodes_path) as barcode_reader:
                    for line in barcode_reader:
                        barcodes.append(line.strip())
                
                target_barcodes_path = target_dir / self.matrix_structure.barcodes_path.name
                subset_structure.barcodes_path = target_barcodes_path
            
            # Select random column indices (1-based for sparse matrix format)
            total_columns = self.matrix_structure.num_columns
            column_indices = get_random_indices(1, total_columns, num_columns, sorted_output=True)
            
            # Process the sparse matrix file
            with get_text_reader(matrix_path) as reader, get_text_writer(target_path) as writer:
                row = 0
                first_row = True
                
                for line in reader:
                    line = line.strip()
                    
                    # Keep comment lines as is
                    if any(line.startswith(comment) for comment in ('%', '#')):
                        writer.write(f"{line}\n")
                        continue
                    
                    tokens = line.split(self.matrix_structure.delimiter)
                    
                    # Validate sparse matrix format
                    if len(tokens) != 3:
                        raise DataProcessingError(
                            f"Invalid sparse matrix format: row {row} has {len(tokens)} elements (expecting 3)"
                        )
                    
                    # Process the header row (first non-comment row)
                    if first_row:
                        # Write dimensions and placeholder for nnz count
                        i = int(tokens[0])  # num rows
                        writer.write(f"{i}{self.matrix_structure.delimiter}{num_columns}{self.matrix_structure.delimiter}-1\n")
                        first_row = False
                        continue
                    
                    # Process data rows
                    i = int(tokens[0])  # row index
                    j = int(tokens[1])  # column index
                    value = tokens[2]   # value
                    
                    # Skip if column not in our subset
                    if j not in column_indices:
                        continue
                    
                    # Adjust column index to new position in subset
                    new_j = column_indices.index(j) + 1
                    
                    # Write the row with adjusted column index
                    writer.write(f"{i}{self.matrix_structure.delimiter}{new_j}{self.matrix_structure.delimiter}{value}\n")
                    
                    # Add barcode to subset if relevant
                    if self.matrix_structure.barcodes_path and j-1 < len(barcodes):
                        subset_barcodes.add(barcodes[j-1])
                    
                    row += 1
            
            # Write subset barcodes file if needed
            if self.matrix_structure.barcodes_path and subset_barcodes:
                with get_text_writer(target_barcodes_path) as barcode_writer:
                    for barcode in sorted(subset_barcodes):
                        barcode_writer.write(f"{barcode}\n")
            
            return subset_structure
        
        except Exception as e:
            logger.error(f"Error creating sparse matrix subset: {str(e)}")
            return None
    
    def _create_barcodes_subset(self, column_indices: List[int], target_dir: Path, subset_structure: MatrixStructure):
        """
        Create a subset of the barcodes file based on selected column indices.
        
        Args:
            column_indices: List of selected column indices
            target_dir: Directory to write the subset to
            subset_structure: MatrixStructure for the subset
        """
        if not self.matrix_structure.barcodes_path:
            return
        
        try:
            barcodes_path = self.matrix_structure.barcodes_path
            target_barcodes_path = target_dir / barcodes_path.name
            subset_structure.barcodes_path = target_barcodes_path
            
            # Read all barcodes
            barcodes = []
            with get_text_reader(barcodes_path) as reader:
                for line in reader:
                    barcodes.append(line.strip())
            
            # Select subset of barcodes
            selected_barcodes = [barcodes[i] for i in column_indices if i < len(barcodes)]
            
            # Write subset barcodes
            with get_text_writer(target_barcodes_path) as writer:
                for barcode in selected_barcodes:
                    writer.write(f"{barcode}\n")
        
        except Exception as e:
            logger.error(f"Error creating barcodes subset: {str(e)}") 