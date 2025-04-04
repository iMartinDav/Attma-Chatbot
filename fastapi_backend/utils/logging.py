import logging
import sys
import os
from typing import Optional
from functools import lru_cache


@lru_cache()
def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the specified name. Uses a cache to avoid creating
    multiple loggers with the same name.
    
    Args:
        name: The name of the logger to get
        
    Returns:
        A logger with the specified name
    """
    return logging.getLogger(name)


def configure_logging(
    level: int = logging.INFO,
    log_file: Optional[str] = None,
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    date_format: str = "%Y-%m-%d %H:%M:%S"
) -> None:
    """
    Configure the logging system.
    
    Args:
        level: The logging level to use (default: logging.INFO)
        log_file: Path to a log file (default: None, logging to stderr only)
        log_format: The format string to use for log messages
        date_format: The format string to use for dates in log messages
    """
    handlers = []
    
    # Always log to stderr
    stream_handler = logging.StreamHandler(sys.stderr)
    handlers.append(stream_handler)
    
    # Optionally log to a file
    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        handlers.append(file_handler)
    
    # Configure the root logger
    logging.basicConfig(
        level=level,
        format=log_format,
        datefmt=date_format,
        handlers=handlers
    )


def get_file_logger(
    name: str, 
    log_file: str,
    level: int = logging.INFO,
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    date_format: str = "%Y-%m-%d %H:%M:%S"
) -> logging.Logger:
    """
    Get a logger that logs to a file.
    
    Args:
        name: The name of the logger to get
        log_file: Path to the log file
        level: The logging level to use (default: logging.INFO)
        log_format: The format string to use for log messages
        date_format: The format string to use for dates in log messages
        
    Returns:
        A logger that logs to the specified file
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Create the log directory if it doesn't exist
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    # Create a file handler
    handler = logging.FileHandler(log_file)
    handler.setLevel(level)
    
    # Create a formatter
    formatter = logging.Formatter(log_format, datefmt=date_format)
    handler.setFormatter(formatter)
    
    # Add the handler to the logger
    logger.addHandler(handler)
    
    return logger 