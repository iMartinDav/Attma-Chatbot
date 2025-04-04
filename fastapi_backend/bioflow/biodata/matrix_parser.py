"""
Matrix Parser module for bioinformatics data.

This module provides tools for analyzing matrix file structures (sparse or full matrices)
commonly used in bioinformatics applications such as single-cell RNA-seq data.
"""

from pathlib import Path
from typing import List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from scipy import sparse
import gzip
from urllib.parse import urlparse
import urllib.request
import os
import re

# Constants for data types and delimiters
DATATYPE_MATRIX = "matrix"
DATATYPE_SPARSE_MATRIX = "sparse_matrix"
COMMENT_CHARS = ["%", "#"]
DELIM_COMMA = ","
DELIM_SEMICOLON = ";"
DELIM_TAB = "\t"
DELIM_SPACE = " "
DELIMITERS = [DELIM_TAB, DELIM_COMMA, DELIM_SEMICOLON, DELIM_SPACE]


class MatrixFormatError(Exception):
    """Exception raised for errors in the matrix format."""
    pass


class MatrixStructure:
    """
    Analyzes and stores the structure of a matrix file (sparse or full).
    
    This class is the Python equivalent of the Java DataFile class, but with more
    Pythonic naming and additional features for bioinformatics data handling.
    
    Attributes:
        data_path (Path): Path to the matrix data file
        barcodes_path (Path): Path to the barcodes file (optional)
        delimiter (str): Delimiter used in the file
        has_header_row (bool): Whether the matrix has a header row
        has_header_column (bool): Whether the matrix has a header column
        shorter_header (bool): Whether the header is shorter than data rows
        data_type (str): Type of data (matrix or sparse_matrix)
        column_names (List[str]): Names of columns if header row exists
        row_names (List[str]): Names of rows if header column exists
        num_rows (int): Number of rows in the matrix
        num_columns (int): Number of columns in the matrix
    """
    
    def __init__(self, data_path: Union[str, Path]):
        """
        Initialize a MatrixStructure from a file path.
        
        Args:
            data_path: Path to the matrix data file (local path or URL)
        """
        self.data_path = Path(data_path) if isinstance(data_path, str) else data_path
        self.barcodes_path = None
        self.delimiter = None
        self.has_header_row = False
        self.has_header_column = False
        self.shorter_header = False
        self.data_type = None
        self.column_names = None
        self.row_names = None
        self.num_rows = 0
        self.num_columns = 0
        
        # Analyze the file structure
        self._parse_matrix_structure()
    
    def _parse_matrix_structure(self):
        """
        Parse the structure of the matrix file.
        
        This method analyzes the first few rows of the file to determine:
        - Delimiter used
        - Presence of header row/column
        - Data type (sparse matrix or full matrix)
        - Number of rows and columns
        
        Raises:
            MatrixFormatError: If the matrix format is invalid or inconsistent
        """
        try:
            # Open the file (handling both local and remote files)
            if str(self.data_path).startswith(('http://', 'https://', 'ftp://')):
                file_obj = urllib.request.urlopen(str(self.data_path))
            else:
                file_obj = open(self.data_path, 'rb')
            
            # Handle gzipped files
            if str(self.data_path).endswith('.gz'):
                file_obj = gzip.GzipFile(fileobj=file_obj)
            
            # Read the first few lines
            lines = []
            for _ in range(10):  # Read up to 10 lines
                try:
                    line = file_obj.readline().decode('utf-8').strip()
                    if not line:
                        break
                    lines.append(line)
                except Exception:
                    break
            
            if not lines:
                raise MatrixFormatError("Empty file or could not read file")
            
            # Skip comment lines
            first_line_idx = 0
            while first_line_idx < len(lines) and any(lines[first_line_idx].startswith(char) for char in COMMENT_CHARS):
                first_line_idx += 1
            
            if first_line_idx >= len(lines):
                raise MatrixFormatError("File contains only comment lines")
            
            first_line = lines[first_line_idx]
            
            # Determine delimiter
            line_prefix = first_line[:500] if len(first_line) > 500 else first_line
            for delim in DELIMITERS:
                if line_prefix.count(delim) > 1:
                    self.delimiter = delim
                    break
            
            if not self.delimiter:
                raise MatrixFormatError("No delimiter found in the first 500 characters")
            
            # Parse first and second lines
            first_line_tokens = first_line.lstrip(self.delimiter).split(self.delimiter)
            
            if first_line_idx + 1 >= len(lines):
                raise MatrixFormatError("File contains only one non-comment line")
            
            second_line = lines[first_line_idx + 1]
            second_line_tokens = second_line.split(self.delimiter)
            
            # Check if header row is shorter
            self.shorter_header = len(second_line_tokens) == len(first_line_tokens) + 1
            
            # Check for header row
            try:
                # Try to parse first few tokens as float to determine if it's a header
                for i in range(1, min(11, len(first_line_tokens))):
                    float(first_line_tokens[i])
                self.has_header_row = False
            except (ValueError, IndexError):
                self.has_header_row = True
            
            # Store column names if header row exists
            if self.has_header_row:
                if self.shorter_header:
                    self.column_names = first_line_tokens
                else:
                    self.column_names = first_line_tokens[1:]
            
            # Check for header column
            try:
                first_token = second_line.split(self.delimiter)[0]
                float(first_token)
                self.has_header_column = False
            except ValueError:
                self.has_header_column = True
            
            # Determine data type (sparse matrix or full matrix)
            if (not self.has_header_column and len(first_line_tokens) == 3 and 
                len(second_line_tokens) == 3):
                # Looks like a sparse matrix format
                self.data_type = DATATYPE_SPARSE_MATRIX
                self.num_rows = int(first_line_tokens[0])
                self.num_columns = int(first_line_tokens[1])
                
                # Validate sparse matrix format
                for i in range(min(3, len(lines) - first_line_idx - 1)):
                    line_idx = first_line_idx + 1 + i
                    if line_idx >= len(lines):
                        break
                    tokens = lines[line_idx].split(self.delimiter)
                    if len(tokens) != 3:
                        raise MatrixFormatError(f"Invalid sparse matrix format: row {line_idx} has {len(tokens)} elements (expecting 3)")
                    try:
                        for token in tokens:
                            int(token)
                    except ValueError:
                        raise MatrixFormatError(f"Invalid sparse matrix format: row {line_idx} has non-integer elements")
            else:
                # Looks like a full matrix
                self.data_type = DATATYPE_MATRIX
                if self.has_header_column:
                    self.num_columns = len(second_line_tokens) - 1
                else:
                    self.num_columns = len(second_line_tokens)
                
                # Check additional rows for header column consistency
                for i in range(2, min(5, len(lines) - first_line_idx)):
                    line_idx = first_line_idx + i
                    if line_idx >= len(lines):
                        break
                    line = lines[line_idx]
                    tokens = line.split(self.delimiter)
                    if not self.has_header_column:
                        try:
                            float(tokens[0])
                        except ValueError:
                            self.has_header_column = True
                            break
            
        except Exception as e:
            if not isinstance(e, MatrixFormatError):
                raise MatrixFormatError(f"Error parsing matrix structure: {str(e)}")
            raise
        finally:
            if 'file_obj' in locals():
                file_obj.close()
    
    def set_barcodes_path(self, path: Union[str, Path]):
        """Set the path to the barcodes file."""
        self.barcodes_path = Path(path) if isinstance(path, str) else path
    
    def set_row_names(self, names: List[str]):
        """Set row names and update row count."""
        self.row_names = names
        self.num_rows = len(names)
    
    def __str__(self):
        """Return a string representation of the matrix structure."""
        info = [
            f"Data path: {self.data_path}",
            f"Barcodes path: {self.barcodes_path if self.barcodes_path else 'None'}",
            f"Delimiter: '{self.delimiter}'",
            f"Has header row: {self.has_header_row}",
            f"Has header column: {self.has_header_column}",
            f"Shorter header: {self.shorter_header}",
            f"Data type: {self.data_type}",
            f"Number of rows: {self.num_rows}",
            f"Number of columns: {self.num_columns}"
        ]
        
        if self.column_names:
            info.append("Column names (first 5):")
            for i in range(min(5, len(self.column_names))):
                info.append(f"  {self.column_names[i]}")
        
        if self.row_names:
            info.append("Row names (first 5):")
            for i in range(min(5, len(self.row_names))):
                info.append(f"  {self.row_names[i]}")
        
        return "\n".join(info) 