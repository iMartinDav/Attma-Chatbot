FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    r-base \
    libpcre2-dev \
    liblzma-dev \
    libbz2-dev \
    zlib1g-dev \
    libicu-dev \
    libxml2-dev \
    libblas-dev \
    liblapack-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup --system app && \
    adduser --system --group app

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install Python dependencies
RUN pip install --no-cache-dir "fastapi[standard]>=0.115.0,<0.116" \
    "uvicorn[standard]>=0.27.1,<0.28" \
    "asyncpg>=0.29.0,<0.30" \
    "fastapi-users[sqlalchemy]>=13.0.0,<14" \
    "pydantic-settings>=2.5.2,<3" \
    "fastapi-mail>=1.4.1,<2" \
    "numpy>=1.24.0" \
    "pandas>=2.0.0" \
    "scipy>=1.10.0" \
    "pathlib>=1.0.1" \
    "python-multipart>=0.0.7" \
    "scanpy>=1.9.0" \
    "rpy2>=3.5.0" \
    "celltypist>=1.5.0" \
    "plotly>=5.14.0" \
    "anndata>=0.10.0" \
    "psycopg2-binary>=2.9.5" \
    "pytest-mock>=3.10.0" \
    "pytest-asyncio>=0.21.0" \
    "python-dotenv>=1.0.0"

# Copy application code
COPY --chown=app:app . .

# Create necessary directories
RUN mkdir -p /app/shared-data \
    && mkdir -p /tmp/single_cell_data \
    && chown -R app:app /app/shared-data \
    && chown -R app:app /tmp/single_cell_data

# Switch to non-root user
USER app

# Expose the application port
EXPOSE 8000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SINGLE_CELL_DATA_DIR=/tmp/single_cell_data

# Run the FastAPI application using the main entry point
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]