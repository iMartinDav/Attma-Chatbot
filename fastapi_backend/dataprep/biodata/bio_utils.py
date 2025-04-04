"""
Bioinformatics Utility Functions.

This module provides common utility functions for bioinformatics data processing,
including file handling, compression, and data sampling.
"""

import gzip
import zipfile
import tarfile
import random
import shutil
from pathlib import Path
from typing import List, Union, BinaryIO, TextIO, Optional
import urllib.request
import urllib.parse
from contextlib import contextmanager
import os


def get_file_reader(file_path: Union[str, Path]) -> BinaryIO:
    """
    Get an appropriate file reader based on the file path.
    
    Args:
        file_path: Path to the file (can be a URL, gz file, etc.)
        
    Returns:
        A file-like object for reading
        
    Raises:
        FileNotFoundError: If the file doesn't exist
        ValueError: If the URL is malformed
    """
    path_str = str(file_path)
    
    # Handle URLs
    if path_str.startswith(('http://', 'https://', 'ftp://')):
        return urllib.request.urlopen(path_str)
    
    # Handle local files
    if not os.path.exists(path_str):
        raise FileNotFoundError(f"File not found: {path_str}")
    
    # Handle gzipped files
    if path_str.endswith('.gz'):
        return gzip.open(path_str, 'rb')
    
    # Regular files
    return open(path_str, 'rb')


@contextmanager
def get_text_reader(file_path: Union[str, Path], encoding: str = 'utf-8'):
    """
    Context manager for reading text files (handles various formats).
    
    Args:
        file_path: Path to the file
        encoding: Text encoding to use
        
    Yields:
        A line iterator for the file
    """
    reader = get_file_reader(file_path)
    try:
        # For gzipped files
        if str(file_path).endswith('.gz'):
            with reader:
                for line in reader:
                    yield line.decode(encoding)
        # For regular files
        else:
            with reader:
                text_reader = reader if isinstance(reader, TextIO) else None
                if not text_reader:
                    text_reader = open(reader.name, 'rt', encoding=encoding)
                    try:
                        for line in text_reader:
                            yield line
                    finally:
                        text_reader.close()
                else:
                    for line in text_reader:
                        yield line
    finally:
        if reader and not reader.closed:
            reader.close()


@contextmanager
def get_text_writer(file_path: Union[str, Path], encoding: str = 'utf-8'):
    """
    Context manager for writing text files (handles various formats).
    
    Args:
        file_path: Path to the file
        encoding: Text encoding to use
        
    Yields:
        A file-like object for writing text
    """
    path_str = str(file_path)
    
    # Create parent directories if they don't exist
    os.makedirs(os.path.dirname(path_str), exist_ok=True)
    
    # Handle gzipped files
    if path_str.endswith('.gz'):
        with gzip.open(path_str, 'wt', encoding=encoding) as f:
            yield f
    else:
        with open(path_str, 'w', encoding=encoding) as f:
            yield f


def extract_zip(zip_path: Union[str, Path], output_dir: Union[str, Path]):
    """
    Extract a ZIP archive to the specified directory.
    
    Args:
        zip_path: Path to the ZIP file
        output_dir: Directory to extract files to
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(str(zip_path), 'r') as zip_ref:
        zip_ref.extractall(str(output_dir))


def extract_tar_gz(tar_gz_path: Union[str, Path], output_dir: Union[str, Path]):
    """
    Extract a TAR.GZ archive to the specified directory.
    
    Args:
        tar_gz_path: Path to the TAR.GZ file
        output_dir: Directory to extract files to
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with tarfile.open(str(tar_gz_path), 'r:gz') as tar_ref:
        tar_ref.extractall(path=str(output_dir))


def get_random_indices(start_range: int, end_range: int, count: int, sorted_output: bool = False) -> List[int]:
    """
    Generate a list of unique random indices within a specified range.
    
    Args:
        start_range: Start of the range (inclusive)
        end_range: End of the range (inclusive)
        count: Number of indices to select
        sorted_output: Whether to sort the output indices
        
    Returns:
        List of random unique indices
        
    Raises:
        ValueError: If count is greater than the range size
    """
    range_size = end_range - start_range + 1
    if count > range_size:
        raise ValueError(f"Requested {count} indices from a range of size {range_size}")
    
    # Generate all indices in the range
    all_indices = list(range(start_range, end_range + 1))
    
    # Shuffle the indices
    random.shuffle(all_indices)
    
    # Select the first 'count' indices
    selected_indices = all_indices[:count]
    
    # Sort if requested
    if sorted_output:
        selected_indices.sort()
    
    return selected_indices


def find_file_by_pattern(directory: Union[str, Path], pattern: str) -> Optional[Path]:
    """
    Find a file matching the given pattern in a directory.
    
    Args:
        directory: Directory to search in
        pattern: Glob pattern to match
        
    Returns:
        Path to the first matching file, or None if no match is found
    """
    directory = Path(directory)
    matches = list(directory.glob(pattern))
    return matches[0] if matches else None


def get_matrix_file(directory: Union[str, Path]) -> Optional[Path]:
    """
    Find a matrix file in the specified directory.
    
    Args:
        directory: Directory to search in
        
    Returns:
        Path to the matrix file, or None if not found
    """
    directory = Path(directory)
    
    # Look for compressed matrix file first
    matrix_gz = directory / "matrix.mtx.gz"
    if matrix_gz.is_file():
        return matrix_gz
    
    # Then look for uncompressed matrix file
    matrix = directory / "matrix.mtx"
    if matrix.is_file():
        return matrix
    
    return None


def get_barcodes_file(directory: Union[str, Path]) -> Optional[Path]:
    """
    Find a barcodes file in the specified directory.
    
    Args:
        directory: Directory to search in
        
    Returns:
        Path to the barcodes file, or None if not found
    """
    directory = Path(directory)
    
    # Look for compressed barcodes file first
    barcodes_gz = directory / "barcodes.tsv.gz"
    if barcodes_gz.is_file():
        return barcodes_gz
    
    # Then look for uncompressed barcodes file
    barcodes = directory / "barcodes.tsv"
    if barcodes.is_file():
        return barcodes
    
    return None 