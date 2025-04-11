# Attma Chatbot
<p align="center">
    <em>Attma: Advanced Chatbot Platform for Bioinformatics Analysis with Next.js and FastAPI</em>
</p>

---

# Attma Chatbot Platform

Attma is an advanced bioinformatics analysis platform combining the power of Python backend services with a modern TypeScript frontend. The platform facilitates complex bioinformatics data processing, analysis, and visualization through an intuitive chatbot interface.

## Table of Contents
* [About](#about)
* [Features](#features)
* [Architecture](#architecture)
* [Setup](#local-setup)
  * [Installing Required Tools](#installing-required-tools)
  * [Setting Up Environment Variables](#setting-up-environment-variables)
  * [Running the Database](#running-the-database)
  * [Building the Project](#building-the-project)
* [Running the Application](#running-the-application)
* [Email Setup](#email-setup)
* [Testing](#testing)
* [Deployment](#deployment)
* [BioFlow Module](#bioflow-module)

## About

Attma integrates Next.js with FastAPI to create a powerful bioinformatics analysis platform. It uses a shared database approach where the frontend's Neon PostgreSQL database is also accessed by the backend, ensuring data consistency across the entire application.

## Features

### User Interface
- Modern, responsive chat interface built with Next.js
- Real-time data processing feedback
- Interactive visualizations for bioinformatics data
- Dark/light mode support
- Internationalization ready

### Backend Capabilities
- FastAPI-powered API for high-performance bioinformatics processing
- Unified database layer for consistent data access
- Robust authentication system
- Email notification system
- BioFlow module for specialized bioinformatics workflows

### Data Processing
- Single-cell RNA-seq analysis
- Genomic sequence processing
- Matrix data manipulation
- Customizable bioinformatics workflows

## Architecture

Attma employs a modern architecture with separate but interconnected frontend and backend services:

### Frontend (Next.js)
- Next.js 15+ with App Router
- TypeScript for type safety
- Tailwind CSS with Shadcn UI components
- React Server Components for optimal performance
- NextAuth.js for authentication management
- Drizzle ORM for database interaction

### Backend (FastAPI)
- FastAPI for high-performance API endpoints
- Python 3.11+ for reliable execution
- Unified database connection layer
- BioFlow module for bioinformatics workflows
- Asynchronous processing for compute-intensive tasks

### Database
- Neon PostgreSQL for data persistence
- Shared between frontend and backend
- Type-safe queries with Drizzle

## Local Setup

### Installing Required Tools

#### 1. Python and uv
The backend requires Python 3.11+ and uv for dependency management:
```bash
# Install uv
curl -sSf https://astral.sh/uv/install.sh | bash
```

#### 2. Node.js and pnpm
The frontend requires Node.js and pnpm:
```bash
# Install Node.js from https://nodejs.org/
# Install pnpm
npm install -g pnpm
```

#### 3. Docker and Docker Compose
For containerized development:
```bash
# Install Docker from https://docs.docker.com/get-docker/
# Docker Compose is included with Docker Desktop
```

### Setting Up Environment Variables

**Backend (`fastapi_backend/.env`):**
```bash
cd fastapi_backend && cp .env.example .env
```

**Frontend (`nextjs-frontend/.env.local`):**
```bash
cd nextjs-frontend && cp .env.example .env.local
```

### Running the Database
```bash
# Start the database container
docker compose up -d db
# Apply database migrations
make docker-migrate-db
```

### Building the Project

#### Without Docker:

For the backend:
```bash
cd fastapi_backend && uv sync
```

For the frontend:
```bash
cd nextjs-frontend && pnpm install
```

#### With Docker:
```bash
make docker-build
```

## Running the Application

### Without Docker:
```bash
# Start backend
make start-backend
# Start frontend
make start-frontend
```

### With Docker:
```bash
# Start backend
make docker-start-backend
# Start frontend
make docker-start-frontend
```

Access the application at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Email Setup

```bash
# Start the MailHog service for local email testing
make docker-up-mailhog
```

Access the email client at http://localhost:8025

## Testing

```bash
# Start the test database
make docker-up-test-db

# Run backend tests
make test-backend

# Run frontend tests
make test-frontend
```

## Deployment

Attma is configured for deployment on Vercel for both frontend and backend services.

### Frontend Deployment
```bash
cd nextjs-frontend
vercel --prod
```

### Backend Deployment
```bash
cd fastapi_backend
vercel --prod
```

For detailed deployment instructions, refer to the [Deployment Guide](./docs/deployment.md).

## BioFlow Module

Attma includes a specialized BioFlow module for bioinformatics data processing:

### Features
- Matrix file parsing and manipulation
- Support for sparse and dense matrices
- Compression handling (gzip, zip, tar.gz)
- Remote file access
- Workflow-based processing

### Usage Example
```python
# Analyze a matrix file
from fastapi_backend.bioflow.biodata import MatrixStructure
matrix = MatrixStructure("path/to/matrix.mtx.gz")
print(matrix.get_dimensions())

# Run a workflow
from fastapi_backend.bioflow import WorkflowRunner
runner = WorkflowRunner()
result = runner.run_workflow("normalize_data", {"input": "path/to/file"})
```

For more details, see the [BioFlow README](./fastapi_backend/bioflow/README.md).
