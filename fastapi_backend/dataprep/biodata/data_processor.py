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
        is_large_file (bool): Whether this is a large file (>5MB) requiring special handling
        file_size_mb (float): File size in megabytes
        original_file_path (str): Path to the original file
        is_compressed (bool): Whether the source is a compressed format
        compressed_format (str): Type of compression (zip, gz, tar, etc.)
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
        self.is_large_file = False
        self.file_size_mb = 0
        self.original_file_path = source_path
        self.is_compressed = False
        self.compressed_format = None
        
        # Check if file exists and get size if it's a local file
        if os.path.isfile(source_path):
            file_size = os.path.getsize(source_path)
            self.file_size_mb = file_size / (1024 * 1024)
            self.is_large_file = self.file_size_mb > 5
            
            # Check if it's compressed
            if source_path.endswith(('.zip', '.gz', '.tgz', '.tar.gz', '.tar')):
                self.is_compressed = True
                if source_path.endswith('.zip'):
                    self.compressed_format = 'zip'
                elif source_path.endswith('.gz'):
                    self.compressed_format = 'gz'
                elif source_path.endswith(('.tar.gz', '.tgz')):
                    self.compressed_format = 'tar.gz'
                elif source_path.endswith('.tar'):
                    self.compressed_format = 'tar'
        
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
                logger.info(f"Downloading file from URL: {source_path}")
                temp_dir = tempfile.mkdtemp()
                temp_file = os.path.join(temp_dir, os.path.basename(parsed_url.path))
                
                # Download the file
                urllib.request.urlretrieve(source_path, temp_file)
                
                # Update file size information after download
                file_size = os.path.getsize(temp_file)
                self.file_size_mb = file_size / (1024 * 1024)
                self.is_large_file = self.file_size_mb > 5
                
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
                
                # Check if it's a compressed file
                elif temp_file.endswith(('.zip', '.tar.gz', '.tgz', '.gz')):
                    self.is_compressed = True
                    # Handle based on compression type
                    if temp_file.endswith('.zip'):
                        self.compressed_format = 'zip'
                        extract_dir = self._extract_archive(temp_file, temp_dir, 'zip')
                    elif temp_file.endswith(('.tar.gz', '.tgz')):
                        self.compressed_format = 'tar.gz'
                        extract_dir = self._extract_archive(temp_file, temp_dir, 'tar.gz')
                    elif temp_file.endswith('.gz'):
                        self.compressed_format = 'gz'
                        extract_dir = self._extract_gzipped_file(temp_file, temp_dir)
                    
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
                
                # Check if it's a compressed file
                elif str(path).endswith(('.zip', '.tar.gz', '.tgz', '.gz', '.tar')):
                    self.is_compressed = True
                    temp_dir = tempfile.mkdtemp()
                    
                    # Handle based on compression type
                    if str(path).endswith('.zip'):
                        self.compressed_format = 'zip'
                        extract_dir = self._extract_archive(str(path), temp_dir, 'zip')
                    elif str(path).endswith(('.tar.gz', '.tgz')):
                        self.compressed_format = 'tar.gz'
                        extract_dir = self._extract_archive(str(path), temp_dir, 'tar.gz')
                    elif str(path).endswith('.gz'):
                        self.compressed_format = 'gz'
                        extract_dir = self._extract_gzipped_file(str(path), temp_dir)
                    elif str(path).endswith('.tar'):
                        self.compressed_format = 'tar' 
                        extract_dir = self._extract_archive(str(path), temp_dir, 'tar')
                    
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
                    self.data_dir = path.parent
                    
                    # Handle potentially large files with specialized parsing
                    if self.is_large_file:
                        logger.info(f"Large file detected ({self.file_size_mb:.1f} MB). Using optimized parsing.")
                        self.matrix_structure = MatrixStructure(path, large_file_mode=True)
                    else:
                        self.matrix_structure = MatrixStructure(path)
                    
                    # Look for barcodes file in the same directory
                    barcodes_file = get_barcodes_file(self.data_dir)
                    if barcodes_file:
                        self.matrix_structure.set_barcodes_path(barcodes_file)
        
        except Exception as e:
            if isinstance(e, DataProcessingError):
                raise
            raise DataProcessingError(f"Error initializing from source: {str(e)}")
    
    def _extract_archive(self, archive_path: str, target_dir: str, archive_type: str) -> str:
        """
        Extract an archive file with optimized handling for large files.
        
        Args:
            archive_path: Path to the archive file
            target_dir: Directory to extract to
            archive_type: Type of archive ('zip', 'tar.gz', or 'tar')
            
        Returns:
            Path to the extracted directory
        """
        logger.info(f"Extracting {archive_type} archive: {archive_path}")
        extract_dir = os.path.join(target_dir, 'extracted')
        os.makedirs(extract_dir, exist_ok=True)
        
        # Special handling for .dgz files (Cell Ranger Cloupe files)
        if archive_path.lower().endswith('.dgz'):
            try:
                # Handle .dgz files as regular files rather than trying to extract them
                # These are proprietary Loupe Cell Browser files with a custom format
                import shutil
                output_file = os.path.join(extract_dir, os.path.basename(archive_path))
                shutil.copy2(archive_path, output_file)
                logger.info(f"Copied .dgz file to {output_file} (special handling for Loupe/Cell Ranger files)")
                return extract_dir
            except Exception as e:
                logger.error(f"Error handling .dgz file: {str(e)}")
                raise DataProcessingError(f"Error handling .dgz file: {str(e)}")
        
        # Use streaming extraction for large files to avoid memory issues
        if self.is_large_file:
            if archive_type == 'zip':
                import zipfile
                try:
                    with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                        # Extract files one by one
                        for member in zip_ref.infolist():
                            try:
                                zip_ref.extract(member, extract_dir)
                            except Exception as e:
                                logger.warning(f"Error extracting {member.filename}: {str(e)}")
                except zipfile.BadZipFile:
                    # If it's a bad zip file, just copy it as is
                    logger.warning(f"Bad zip file format for {archive_path}, treating as regular file")
                    import shutil
                    output_file = os.path.join(extract_dir, os.path.basename(archive_path))
                    shutil.copy2(archive_path, output_file)
                        
            elif archive_type in ('tar.gz', 'tar'):
                import tarfile
                try:
                    mode = 'r:gz' if archive_type == 'tar.gz' else 'r'
                    with tarfile.open(archive_path, mode) as tar_ref:
                        # Extract files one by one
                        for member in tar_ref.getmembers():
                            try:
                                tar_ref.extract(member, extract_dir)
                            except Exception as e:
                                logger.warning(f"Error extracting {member.name}: {str(e)}")
                except tarfile.ReadError:
                    # If it's a bad tar file, just copy it as is
                    logger.warning(f"Bad tar file format for {archive_path}, treating as regular file")
                    import shutil
                    output_file = os.path.join(extract_dir, os.path.basename(archive_path))
                    shutil.copy2(archive_path, output_file)
        else:
            # Use built-in function for smaller files
            try:
                format_map = {'zip': 'zip', 'tar.gz': 'gztar', 'tar': 'tar'}
                shutil.unpack_archive(archive_path, extract_dir, format_map[archive_type])
            except Exception as e:
                # If extraction fails, just copy the file as is
                logger.warning(f"Extraction failed for {archive_path}: {str(e)}. Treating as regular file.")
                output_file = os.path.join(extract_dir, os.path.basename(archive_path))
                shutil.copy2(archive_path, output_file)
            
        return extract_dir
    
    def _extract_gzipped_file(self, gz_path: str, target_dir: str) -> str:
        """
        Extract a gzipped file efficiently, even for large files.
        
        Args:
            gz_path: Path to the gzipped file
            target_dir: Directory to extract to
            
        Returns:
            Path to the directory containing the extracted file
        """
        import gzip
        logger.info(f"Extracting gzipped file: {gz_path}")
        
        extract_dir = os.path.join(target_dir, 'extracted')
        os.makedirs(extract_dir, exist_ok=True)
        
        # Get the output filename by removing .gz extension
        output_filename = os.path.basename(gz_path)
        if output_filename.endswith('.gz'):
            output_filename = output_filename[:-3]
            
        output_path = os.path.join(extract_dir, output_filename)
        
        # Use streaming extraction with efficient buffer size for large files
        buffer_size = 10 * 1024 * 1024  # 10MB buffer for large files
        
        with gzip.open(gz_path, 'rb') as f_in:
            with open(output_path, 'wb') as f_out:
                while True:
                    buffer = f_in.read(buffer_size)
                    if not buffer:
                        break
                    f_out.write(buffer)
        
        return extract_dir
    
    def generate_matrix_subset(self, num_columns: int, chunk_size: int = None) -> Optional[Path]:
        """
        Create a subset of the data with a specified number of columns.
        
        This method creates a new directory with the subset data and copies
        other relevant files from the original directory.
        
        Args:
            num_columns: Number of columns to include in the subset
            chunk_size: Size of chunks to process at once for large files (in lines)
                        If None, chunk size will be determined automatically
        
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
            
            # Determine chunk size for processing large files
            if chunk_size is None:
                # Auto-adjust chunk size based on file size
                if self.is_large_file:
                    if self.file_size_mb > 500:  # Very large files
                        chunk_size = 10000
                    elif self.file_size_mb > 100:  # Large files
                        chunk_size = 50000
                    else:  # Moderately large files
                        chunk_size = 100000
                else:
                    chunk_size = 0  # Process entire file at once for small files
            
            # Create subset based on data type
            if self.matrix_structure.data_type == DATATYPE_MATRIX:
                subset_structure = self._create_full_matrix_subset(num_columns, target_dir, chunk_size)
            elif self.matrix_structure.data_type == DATATYPE_SPARSE_MATRIX:
                subset_structure = self._create_sparse_matrix_subset(num_columns, target_dir, chunk_size)
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
    
    def _create_full_matrix_subset(self, num_columns: int, target_dir: Path, chunk_size: int = 0) -> Optional[MatrixStructure]:
        """
        Create a subset of a full matrix with optimizations for large files.
        
        This method handles subsets of full matrices, preserving header rows/columns
        if present in the original file.
        
        Args:
            num_columns: Number of columns to include
            target_dir: Directory to write the subset to
            chunk_size: Number of lines to process at once (0 means process entire file)
            
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
            
            # For large files, process in chunks
            if chunk_size > 0 and self.is_large_file:
                return self._create_full_matrix_subset_chunked(
                    matrix_path, target_path, column_indices, subset_structure, chunk_size)
            
            # For smaller files, process all at once
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
    
    def _create_full_matrix_subset_chunked(
        self, matrix_path: Path, target_path: Path, 
        column_indices: List[int], subset_structure: MatrixStructure,
        chunk_size: int) -> MatrixStructure:
        """
        Create a subset of a full matrix by processing it in chunks.
        
        This method is optimized for large files.
        
        Args:
            matrix_path: Path to the original matrix file
            target_path: Path to write the subset to
            column_indices: List of column indices to include
            subset_structure: Structure for the subset matrix
            chunk_size: Number of lines to process at once
            
        Returns:
            Updated MatrixStructure for the subset
        """
        logger.info(f"Processing large matrix in chunks of {chunk_size} lines")
        
        row_names = []
        row_count = 0
        processed_header = False
        
        with get_text_writer(target_path) as writer:
            # Process the file in chunks
            with open(matrix_path, 'r') as f:
                while True:
                    lines = []
                    # Read a chunk of lines
                    for _ in range(chunk_size):
                        line = f.readline()
                        if not line:
                            break
                        lines.append(line)
                    
                    # Break if no lines were read
                    if not lines:
                        break
                    
                    # Process each line in the chunk
                    for line in lines:
                        line = line.strip()
                        
                        # Skip comment lines
                        if any(line.startswith(comment) for comment in ('%', '#')):
                            writer.write(f"{line}\n")
                            continue
                        
                        tokens = line.split(self.matrix_structure.delimiter)
                        is_header = (not processed_header and self.matrix_structure.has_header_row)
                        
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
                            processed_header = True
                        
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
            subset_structure.num_rows = row_count - (1 if self.matrix_structure.has_header_row else 0)
        
        return subset_structure
    
    def _create_sparse_matrix_subset(self, num_columns: int, target_dir: Path, chunk_size: int = 0) -> Optional[MatrixStructure]:
        """
        Create a subset of a sparse matrix with optimizations for large files.
        
        This method handles subsets of sparse matrices, which are typically
        stored in coordinate format (row, column, value).
        
        Args:
            num_columns: Number of columns to include
            target_dir: Directory to write the subset to
            chunk_size: Number of lines to process at once (0 means process entire file)
            
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
            
            # For large files, process in chunks
            if chunk_size > 0 and self.is_large_file:
                return self._create_sparse_matrix_subset_chunked(
                    matrix_path, target_path, column_indices, barcodes,
                    subset_barcodes, subset_structure, chunk_size)
            
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
    
    def _create_sparse_matrix_subset_chunked(
        self, matrix_path: Path, target_path: Path, 
        column_indices: List[int], barcodes: List[str],
        subset_barcodes: set, subset_structure: MatrixStructure,
        chunk_size: int) -> MatrixStructure:
        """
        Create a subset of a sparse matrix by processing it in chunks.
        
        This method is optimized for large files.
        
        Args:
            matrix_path: Path to the original matrix file
            target_path: Path to write the subset to
            column_indices: List of column indices to include
            barcodes: List of barcodes
            subset_barcodes: Set to collect barcodes included in subset
            subset_structure: Structure for the subset matrix
            chunk_size: Number of lines to process at once
            
        Returns:
            Updated MatrixStructure for the subset
        """
        logger.info(f"Processing large sparse matrix in chunks of {chunk_size} lines")
        
        row = 0
        processed_header = False
        
        with get_text_writer(target_path) as writer:
            # Process the file in chunks
            with open(matrix_path, 'r') as f:
                while True:
                    lines = []
                    # Read a chunk of lines
                    for _ in range(chunk_size):
                        line = f.readline()
                        if not line:
                            break
                        lines.append(line)
                    
                    # Break if no lines were read
                    if not lines:
                        break
                    
                    # Process each line in the chunk
                    for line in lines:
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
                        if not processed_header:
                            # Write dimensions and placeholder for nnz count
                            i = int(tokens[0])  # num rows
                            writer.write(f"{i}{self.matrix_structure.delimiter}{num_columns}{self.matrix_structure.delimiter}-1\n")
                            processed_header = True
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
            target_barcodes_path = subset_structure.barcodes_path
            with get_text_writer(target_barcodes_path) as barcode_writer:
                for barcode in sorted(subset_barcodes):
                    barcode_writer.write(f"{barcode}\n")
        
        return subset_structure
    
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
            
            # For large files, process in chunks
            if self.is_large_file:
                # Read barcodes in chunks
                with open(target_barcodes_path, 'w') as writer:
                    with open(barcodes_path, 'r') as reader:
                        idx = 0
                        for line in reader:
                            barcode = line.strip()
                            if idx in column_indices:
                                writer.write(f"{barcode}\n")
                            idx += 1
            else:
                # For smaller files, read all barcodes at once
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
            
    def get_processor_info(self) -> Dict[str, Any]:
        """
        Get processor information.
        
        Returns:
            Dictionary with processor information
        """
        return {
            "original_url": self.original_url,
            "is_large_file": self.is_large_file,
            "file_size_mb": self.file_size_mb,
            "is_compressed": self.is_compressed,
            "compressed_format": self.compressed_format,
            "data_type": self.matrix_structure.data_type if self.matrix_structure else None,
            "num_rows": self.matrix_structure.num_rows if self.matrix_structure else None,
            "num_columns": self.matrix_structure.num_columns if self.matrix_structure else None,
            "has_header_row": self.matrix_structure.has_header_row if self.matrix_structure else None,
            "has_header_column": self.matrix_structure.has_header_column if self.matrix_structure else None
        }
