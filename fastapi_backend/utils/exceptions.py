from typing import Dict, Any, Optional


class AppBaseException(Exception):
    """Base exception for all application-specific exceptions."""
    
    def __init__(
        self, 
        message: str, 
        error_code: str, 
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details
        super().__init__(self.message)


class DataLoadingError(AppBaseException):
    """Exception raised when data loading fails."""
    
    def __init__(
        self, 
        message: str = "Failed to load data", 
        error_code: str = "DATA_LOADING_ERROR", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class InvalidDataFormatError(AppBaseException):
    """Exception raised when data format is not supported or invalid."""
    
    def __init__(
        self, 
        message: str = "Invalid data format", 
        error_code: str = "INVALID_DATA_FORMAT", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class AnalysisError(AppBaseException):
    """Exception raised when an analysis operation fails."""
    
    def __init__(
        self, 
        message: str = "Analysis operation failed", 
        error_code: str = "ANALYSIS_ERROR", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class ResourceNotFoundError(AppBaseException):
    """Exception raised when a requested resource is not found."""
    
    def __init__(
        self, 
        message: str = "Resource not found", 
        error_code: str = "RESOURCE_NOT_FOUND", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class ValidationError(AppBaseException):
    """Exception raised when validation fails."""
    
    def __init__(
        self, 
        message: str = "Validation failed", 
        error_code: str = "VALIDATION_ERROR", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class PlottingError(AppBaseException):
    """Exception raised when plot generation fails."""
    
    def __init__(
        self, 
        message: str = "Plot generation failed", 
        error_code: str = "PLOTTING_ERROR", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class S3OperationError(AppBaseException):
    """Exception raised when an S3 operation fails."""
    
    def __init__(
        self, 
        message: str = "S3 operation failed", 
        error_code: str = "S3_OPERATION_ERROR", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details)


class TaskError(AppBaseException):
    """Exception raised when a background task fails."""
    
    def __init__(
        self, 
        message: str = "Task failed", 
        error_code: str = "TASK_ERROR", 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, error_code, details) 