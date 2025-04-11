# Attma ChatBot - FastAPI Backend

This is the backend service for the Attma ChatBot platform, providing bioinformatics analysis capabilities through a FastAPI application.

## Features

- Bioinformatics data processing and analysis
- FastAPI-based RESTful API
- Authentication system with JWT tokens
- Integration with frontend's Neon PostgreSQL database
- BioFlow module for specialized bioinformatics workflows
- Email notification system
- Comprehensive test suite

## Technology Stack

- **Framework**: FastAPI
- **Python Version**: 3.11+
- **Dependency Management**: uv
- **Database**: PostgreSQL via Neon (shared with frontend)
- **Database Access**: Custom connection pool with asyncpg
- **Authentication**: FastAPI Users with JWT
- **Email**: Integration with frontend email service
- **API Documentation**: Swagger UI (automatic)
- **Testing**: pytest

## Directory Structure

```
fastapi_backend/
├── alembic_migrations/    # Database migrations
├── analysis/              # Analysis tools integration
├── api/                   # API routes definition
├── app/                   # Core application
│   ├── config.py          # Application configuration
│   ├── database.py        # Database connections
│   ├── main.py            # Application entry point
│   ├── middleware.py      # HTTP middleware
│   ├── models.py          # Database models
│   ├── schemas.py         # Pydantic schemas
│   └── users.py           # User management
├── bioflow/               # Bioinformatics workflow system
├── commands/              # CLI utilities
├── dataprep/              # Data preparation utilities
├── docs/                  # Additional documentation
├── models/                # Data models for analysis
├── services/              # Business logic services
├── tests/                 # Test suite
└── utils/                 # Utility functions
```

## Quick Start

### Prerequisites

- Python 3.11+
- uv (Python dependency manager)
- Docker and Docker Compose (optional, for containerized development)
- Access to Neon PostgreSQL database (shared with frontend)

### Environment Setup

1. Clone the repository (if not already done):
   ```bash
   git clone https://github.com/yourusername/attma.git
   cd attma/fastapi_backend
   ```

2. Create environment file:
   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your database credentials and other settings.

### Local Installation

```bash
# Install dependencies using uv
uv sync

# Run the development server
uvicorn app.main:app --reload
```

### Docker Installation

```bash
# From the project root
docker compose up -d backend
```

### Verify Installation

Open your browser and navigate to:
- API: http://localhost:8000
- Interactive documentation: http://localhost:8000/docs

## Database Connection

The backend connects to the same Neon PostgreSQL database used by the frontend. This unified database approach ensures data consistency across the application.

Key database files:
- `app/database.py`: Connection pool management
- `app/drizzle.py`: Frontend schema compatibility
- `app/models.py`: Data models

## Authentication System

The authentication system uses FastAPI Users with JWT tokens:

- Login: `/auth/jwt/login`
- Registration: `/auth/register`
- Email verification: `/auth/verify`
- Password reset: `/auth/forgot-password` and `/auth/reset-password`

For more details, see [Authentication Documentation](./docs/authentication.md).

## BioFlow Module

The BioFlow module provides specialized bioinformatics analysis workflows:

```python
from fastapi_backend.bioflow import WorkflowRunner

# Initialize a workflow runner
runner = WorkflowRunner()

# Run a workflow with parameters
result = runner.run_workflow("analyze_sequence", {
    "sequence": "ATGCATGCATGC",
    "parameters": {"method": "basic"}
})
```

For more details, see [BioFlow README](./bioflow/README.md).

## Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_api.py

# Run with coverage
pytest --cov=app
```

## Development

### Adding a New API Endpoint

1. Create route in `api/routes/your_module.py`:
   ```python
   from fastapi import APIRouter, Depends
   from app.schemas import YourSchema
   from app.users import current_active_user
   
   router = APIRouter()
   
   @router.post("/your-endpoint")
   async def your_endpoint(
       data: YourSchema,
       user = Depends(current_active_user)
   ):
       # Your implementation
       return {"result": "success"}
   ```

2. Include the router in `api/routes/__init__.py`

### Running Database Migrations

If you need to modify the database schema, coordinate with the frontend team since we share the same database.

## Deployment

The backend is configured for deployment on Vercel:

```bash
vercel --prod
```

For custom deployments, see the [Deployment Guide](../docs/deployment.md).

## Contributing

See the [Contributing Guide](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.