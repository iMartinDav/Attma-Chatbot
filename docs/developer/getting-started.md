# Developer Getting Started Guide

This guide helps new developers set up the BioPlatform development environment and understand the project structure.

## Prerequisites

Ensure you have the following installed:

- **Node.js**: v18.17.0 or later
- **Python**: v3.12 or later
- **Docker**: Latest stable version
- **PostgreSQL**: 15+ (or Docker container)
- **Git**: Latest stable version
- **pnpm**: Latest stable version
- **Python venv**: Latest stable version

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/bioplatform/nextjs-fastapi.git
cd nextjs-fastapi
```

### 2. Set Up Environment Variables

Create the necessary `.env` files:

```bash
# For backend
cp fastapi_backend/.env.example fastapi_backend/.env

# For frontend
cp nextjs-frontend/.env.example nextjs-frontend/.env.local
```

Update the environment variables with your local development settings. At minimum, you'll need:

- Database connection strings
- JWT secret keys
- API endpoint URLs

### 3. Database Setup

#### Option A: Local PostgreSQL

If using a local PostgreSQL installation:

```bash
# Create development and test databases
psql -U postgres -c "CREATE DATABASE bioplatform_dev;"
psql -U postgres -c "CREATE DATABASE bioplatform_test;"

# Run migrations
cd nextjs-frontend
pnpm db:migrate
```

#### Option B: Docker PostgreSQL

If using Docker for PostgreSQL:

```bash
# Start the database container
docker compose up db -d

# Run migrations
cd nextjs-frontend
pnpm db:migrate
```

### 4. Install Dependencies

#### Backend Setup

```bash
cd fastapi_backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### Frontend Setup

```bash
cd nextjs-frontend
pnpm install
```

### 5. Start Development Servers

#### Option A: Individual Services

Start each service separately:

```bash
# Backend (in fastapi_backend directory)
uvicorn app.main:app --reload

# Frontend (in nextjs-frontend directory)
pnpm dev
```

#### Option B: Docker Compose

Start all services with Docker Compose:

```bash
docker compose up
```

### 6. Verify Installation

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Database Admin: http://localhost:5050 (if pgAdmin is configured)

## Project Structure

### Key Directories

#### Frontend (Next.js)

```
nextjs-frontend/
├── app/                 # Next.js App Router pages and routes
│   ├── (auth)/          # Authentication routes
│   ├── (chat)/          # Chat interface routes
│   ├── api/             # API routes and handlers
├── components/          # Reusable React components
├── lib/                 # Shared utilities and configurations
│   ├── db/              # Database schema and utilities
│   ├── auth/            # Authentication utilities
├── public/              # Static assets 
├── styles/              # Global styles and themes
```

#### Backend (FastAPI)

```
fastapi_backend/
├── app/                 # Core application
│   ├── routes/          # API endpoints
│   ├── models/          # Database models
│   ├── schemas/         # Pydantic schemas
│   ├── drizzle.py       # Drizzle DB integration
├── bioflow/             # Bioinformatics workflows
├── dataprep/            # Data preparation utilities
├── tests/               # Test suite
```

## Development Workflow

### Code Style and Linting

The project uses strict code styling and linting. Run these commands to ensure code quality:

```bash
# Backend
cd fastapi_backend
ruff check .
mypy .
black .

# Frontend
cd nextjs-frontend
pnpm lint
pnpm format
```

### Testing

```bash
# Backend tests
cd fastapi_backend
pytest

# Frontend tests
cd nextjs-frontend
pnpm test
```

### Database Migrations

When changing the database schema:

```bash
# Generate migration
cd nextjs-frontend
pnpm db:generate

# Apply migration
pnpm db:migrate
```

### Creating New Components

For frontend components:

1. Use appropriate component directory structure
2. Follow atomic design principles
3. Write component stories using Storybook
4. Include tests for each component

For backend endpoints:

1. Create route in appropriate module
2. Define request/response schemas
3. Implement business logic
4. Add comprehensive tests

## Debugging

### Frontend Debugging

- Use React DevTools for component inspection
- Configure VS Code debugging for Next.js
- Use the Network tab in browser DevTools to inspect API calls

### Backend Debugging

- Use VS Code Python debugger
- Enable FastAPI debug mode with `--debug` flag
- Check logs in the terminal or log files

## CI/CD Pipeline

The CI/CD pipeline runs on every pull request and push to main:

1. Linting and type checking
2. Unit tests
3. Integration tests
4. Build verification
5. Deployment to staging (on merge to main)
6. Production deployment (manual trigger)

## Getting Help

- Check documentation in `/docs` directory
- Consult the team channel in Slack
- Review existing issues in GitHub
- Attend weekly developer sync meetings