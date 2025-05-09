import os
import logging
import time
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv

# User management imports
from .schemas import UserCreate, UserRead, UserUpdate
from .users import auth_backend, fastapi_users, AUTH_URL_PATH
from .utils import simple_generate_unique_route_id
from .routes.bioflow import router as bioflow_router
from .routes.drizzle import router as drizzle_router
from .routes.auth import router as auth_extended_router
from .config import settings
from .middleware import DrizzleSyncMiddleware
from .drizzle import close_db_pool, query, get_db_pool

# Single cell analysis imports
try:
    from fastapi_backend.api.routes import single_cell_routes
    from fastapi_backend.utils.exceptions import AppBaseException
    from fastapi_backend.utils.logging import configure_logging, get_logger
except ImportError:
    # Try direct imports for Docker environment
    try:
        from api.routes import single_cell_routes
        from utils.exceptions import AppBaseException
        from utils.logging import configure_logging, get_logger
    except ImportError:
        # For now just continue, we'll log errors later
        pass

# Load environment variables from .env file
load_dotenv()

# --- Startup check for required environment variables ---
REQUIRED_ENV_VARS = ["BLOB_STORE_ID", "VERCEL_BLOB_TOKEN"]
missing_vars = [var for var in REQUIRED_ENV_VARS if not os.environ.get(var)]
if missing_vars:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}. Please set them in your .env file or environment.")

# Configure logging
log_level = os.getenv("LOG_LEVEL", "DEBUG")  # Changed to DEBUG for more verbose logs
log_file = os.getenv("LOG_FILE", None)

# Initialize logging if available
try:
    configure_logging(
        level=getattr(logging, log_level),
        log_file=log_file,
        log_format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        date_format="%Y-%m-%d %H:%M:%S"
    )
    logger = get_logger(__name__)
except NameError:
    # Configure basic logging if our custom logging isn't available
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    logger = logging.getLogger(__name__)

# Make sure bioflow module's logger is set to DEBUG
for module_name in ["bioflow", "dataprep", "app.routes.bioflow"]:
    module_logger = logging.getLogger(module_name)
    module_logger.setLevel(logging.DEBUG)
    
# Lifespan event handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle event handler for the FastAPI application.
    """
    # Startup
    logger.info("Starting FastAPI application")
    
    # Create data directory if it doesn't exist
    data_dir = os.getenv("SINGLE_CELL_DATA_DIR", "/tmp/single_cell_data")
    os.makedirs(data_dir, exist_ok=True)
    logger.info(f"Ensuring data directory exists: {data_dir}")
    
    # Check temp directory
    temp_dir = os.getenv("TEMP_DIR", "/tmp")
    if not os.path.exists(temp_dir):
        try:
            os.makedirs(temp_dir, exist_ok=True)
            logger.info(f"Created temp directory: {temp_dir}")
        except Exception as e:
            logger.error(f"Failed to create temp directory: {e}")
    else:
        # Check if it's writable
        try:
            test_file = os.path.join(temp_dir, "write_test")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            logger.info(f"Temp directory {temp_dir} is writable")
        except Exception as e:
            logger.error(f"Temp directory {temp_dir} is not writable: {e}")
    
    # Initialize dataprep if it's being used
    try:
        # Try different import paths
        try:
            from dataprep import initialize_dataprep
        except ImportError:
            try:
                from fastapi_backend.dataprep import initialize_dataprep
            except ImportError:
                logger.info("Dataprep module not found, skipping initialization")
                raise ImportError("Dataprep module not found")
        
        initialize_dataprep()
        logger.info("Dataprep initialized successfully")
    except ImportError:
        logger.info("Dataprep module not found, skipping initialization")
    except Exception as e:
        logger.warning(f"Failed to initialize dataprep: {e}")
    
    # Initialize bioflow if it's being used
    try:
        # Try different import paths
        try:
            from bioflow import initialize_bioflow
        except ImportError:
            try:
                from fastapi_backend.bioflow import initialize_bioflow
            except ImportError:
                logger.info("Bioflow module not found, skipping initialization")
                raise ImportError("Bioflow module not found")
            
        initialize_bioflow()
        logger.info("Bioflow initialized successfully")
    except ImportError:
        logger.info("Bioflow module not found, skipping initialization")
    except Exception as e:
        logger.warning(f"Failed to initialize bioflow: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastAPI application")
    
    # Close database connection pools
    try:
        logger.info("Closing Drizzle database connection pool")
        await close_db_pool()
    except Exception as e:
        logger.warning(f"Error closing database pool: {e}")

# Create FastAPI application
app = FastAPI(
    title="Single-Cell Analysis API",
    description="API for analyzing single-cell RNA-seq data with user management",
    version="0.1.0",
    generate_unique_id_function=simple_generate_unique_route_id,
    openapi_url=settings.OPENAPI_URL,
    lifespan=lifespan
)

# Set FastAPI upload limit globally by modifying the max request size
# This uses a subclass of UploadFile to increase the allowed upload size
from fastapi import UploadFile as _OriginalUploadFile
from starlette.datastructures import UploadFile as _StarletteUploadFile
from tempfile import SpooledTemporaryFile

# Configure file upload size limits
# FastAPI/Starlette uses 1MB limit by default, we need to increase this
FILE_UPLOAD_MAX_SIZE = int(os.getenv("FILE_UPLOAD_MAX_SIZE_MB", 300)) * 1024 * 1024  # Default to 300MB

# Patch SpooledTemporaryFile max_size
# This ensures large files are written to disk instead of keeping in memory
SpooledTemporaryFile._default_max_size = 1024 * 1024  # Use 1MB as threshold between memory/disk

# Create a patched UploadFile that increases the spooled file size threshold
class PatchedUploadFile(_StarletteUploadFile):
    @classmethod
    def __init__(cls, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
    spool_max_size = FILE_UPLOAD_MAX_SIZE

# Apply the patch by replacing the original class
import starlette.datastructures
starlette.datastructures.UploadFile = PatchedUploadFile

# Add the DrizzleSyncMiddleware to synchronize user data
app.add_middleware(DrizzleSyncMiddleware)

# Middleware for CORS configuration - make sure all frontend domains are included
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Process-Time"]
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Middleware for logging HTTP requests and responses.
    """
    start_time = time.time()
    
    # Get client IP
    forwarded_for = request.headers.get("X-Forwarded-For")
    client_ip = forwarded_for.split(",")[0] if forwarded_for else request.client.host
    
    # Log request with additional headers for debugging
    request_body = None
    content_type = request.headers.get("Content-Type", "")
    
    # More detailed logging for bioflow endpoints to help diagnose issues
    is_bioflow_endpoint = "/bioflow/" in request.url.path
    log_level = logging.DEBUG if is_bioflow_endpoint else logging.INFO
    
    # Log request details
    logger.log(
        log_level, 
        f"Request: {request.method} {request.url.path} from {client_ip} | "
        f"Content-Type: {content_type}"
    )
    
    # Additional debugging for file uploads
    if is_bioflow_endpoint and "multipart/form-data" in content_type:
        logger.debug(f"Processing bioflow file upload | Headers: {dict(request.headers)}")
    
    try:
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log response with more details for bioflow endpoints
        if is_bioflow_endpoint:
            logger.debug(
                f"Bioflow Response: {request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Process time: {process_time:.4f}s"
            )
        else:
            logger.info(
                f"Response: {request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Process time: {process_time:.4f}s"
            )
        
        # Add processing time header
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
    except Exception as e:
        # Log error with full traceback
        logger.exception(
            f"Error processing request: {request.method} {request.url.path}\n"
            f"Error: {str(e)}\n"
            f"Traceback: {traceback.format_exc()}"
        )
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Return detailed error response
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error", 
                "detail": str(e),
                "path": request.url.path,
                "method": request.method
            },
            headers={"X-Process-Time": str(process_time)}
        )

# Exception handler for validation errors (improves error messages)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Exception handler for validation errors.
    """
    logger.warning(f"Validation error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )

# Exception handler for AppBaseException if available
try:
    @app.exception_handler(AppBaseException)
    async def app_exception_handler(request: Request, exc: AppBaseException):
        """
        Exception handler for AppBaseException.
        """
        logger.error(f"AppBaseException: {exc}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message, "code": exc.error_code, "details": exc.details}
        )
except NameError:
    # AppBaseException might not be available
    pass

# Generic exception handler to catch all unhandled exceptions
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Generic exception handler for all unhandled exceptions.
    """
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "path": request.url.path
        }
    )

# Include single-cell routes if available
try:
    app.include_router(single_cell_routes.router)
    logger.info("Single-cell analysis routes included")
except (NameError, AttributeError):
    # Change warning to debug level - this is an expected condition in most environments
    logger.debug("Single-cell analysis routes not available (optional feature)")

# Include authentication and user management routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix=f"/{AUTH_URL_PATH}/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# Include extended authentication routes
app.include_router(auth_extended_router)

# Include bioflow routes
app.include_router(bioflow_router)

# Include Drizzle database routes
app.include_router(drizzle_router)

# Include bioflow visualization routes
try:
    from api.routes.bioflow_visualization import router as bioflow_visualization_router
    app.include_router(bioflow_visualization_router)
    logger.info("Bioflow visualization routes included")
except ImportError:
    logger.warning("Bioflow visualization routes not available")

# Health check endpoint
@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        dict: Health status information
    """
    # Default status is healthy - we'll only mark as unhealthy for critical failures
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": app.version,
        "services": {},
        "environment": {
            "python_path": os.getenv("PYTHONPATH", "Not set"),
            "temp_dir": os.getenv("TEMP_DIR", "/tmp"),
            "log_level": log_level,
        }
    }
    
    # Add file system check
    try:
        temp_dir = os.getenv("TEMP_DIR", "/tmp")
        health_status["services"]["filesystem"] = {
            "status": "ok" if os.access(temp_dir, os.W_OK) else "error",
            "temp_dir": temp_dir,
            "temp_dir_free_space_mb": os.statvfs(temp_dir).f_bavail * os.statvfs(temp_dir).f_frsize / 1024 / 1024
        }
    except Exception as fs_err:
        logger.warning(f"File system health check failed: {str(fs_err)}")
        health_status["services"]["filesystem"] = {
            "status": "warning",
            "error": str(fs_err)
        }
    
    # Check database connection
    try:
        # Start time for DB check
        db_check_start_time = time.time()
        
        # Check database connection by running a simple query
        await query("SELECT 1")
        
        # Calculate DB response time
        db_response_time = time.time() - db_check_start_time
        
        # Get connection pool status if available
        try:
            pool = await get_db_pool()
            pool_status = {
                "min_size": pool._minsize if hasattr(pool, "_minsize") else "unknown",
                "max_size": pool._maxsize if hasattr(pool, "_maxsize") else "unknown",
                "size": len(pool._holders) if hasattr(pool, "_holders") else "unknown",
                "free": pool._queue.qsize() if hasattr(pool, "_queue") else "unknown",
            }
        except Exception as pool_err:
            logger.warning(f"Could not get pool status: {str(pool_err)}")
            pool_status = {"error": "Could not get pool status"}
        
        health_status["services"]["database"] = {
            "status": "connected",
            "response_time_ms": round(db_response_time * 1000, 2),
            "pool": pool_status
        }
    except Exception as db_err:
        logger.warning(f"Database health check failed: {str(db_err)}")
        health_status["services"]["database"] = {
            "status": "warning",
            "error": str(db_err)
        }
        # Don't mark the entire service as unhealthy yet - this allows startup when DB
        # might not be fully ready yet
    
    # Add application status
    health_status["services"]["application"] = {
        "status": "running",
        "uptime": time.time() - app.state.start_time if hasattr(app.state, "start_time") else 0
    }
    
    # Add startup time to app state if not already set
    if not hasattr(app.state, "start_time"):
        app.state.start_time = time.time()
    
    # Return healthy response - we don't want to fail health checks during initial startup
    # This gives the database time to initialize
    return health_status

# Root endpoint
@app.get("/", tags=["system"])
async def root():
    """
    Root endpoint.
    """
    return {
        "name": "Single-Cell Analysis API",
        "version": "0.1.0",
        "description": "API for analyzing single-cell RNA-seq data with user management",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "environment": os.getenv("ENVIRONMENT", "development")
    }

# Test file upload endpoint - helpful for debugging file upload issues
@app.post("/test-upload/", tags=["system"])
async def test_upload(file: UploadFile = File(...)):
    """
    Test endpoint for file uploads.
    Useful for debugging file upload issues.
    """
    try:
        # Read a small chunk to verify file existence
        content = await file.read(1024)
        file_size = len(content)
        
        # Seek back to beginning
        await file.seek(0)
        
        # Get basic file info
        content_type = file.content_type or "application/octet-stream"
        filename = file.filename
        
        return {
            "filename": filename,
            "content_type": content_type,
            "file_size_preview": file_size,
            "status": "success"
        }
    except Exception as e:
        logger.exception(f"Test upload failed: {str(e)}")
        raise
