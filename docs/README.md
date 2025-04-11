# BioPlatform Documentation

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-production--ready-success)

## System Architecture

BioPlatform combines a Next.js frontend with a FastAPI backend, powered by a unified PostgreSQL database. This architecture enables high-performance bioinformatics analysis with an intuitive user interface.

### Key Components

- **Frontend**: Next.js 15+ with TypeScript, Tailwind CSS, and Shadcn UI
- **Backend**: FastAPI with Python 3.12+, asyncio, and specialized bioinformatics libraries
- **Database**: PostgreSQL (Neon) with unified access layer
- **Authentication**: JWT-based system with OAuth provider support
- **Data Processing**: Asynchronous bioinformatics workflows with caching

## Documentation Categories

### For Developers

- [Getting Started](./developer/getting-started.md) - Quick setup guide for developers
- [Architecture Overview](./architecture/overview.md) - System architecture and design patterns
- [Database Schema](./database_schema.md) - Complete database design documentation
- [Authentication System](./authentication.md) - Authentication flows and security measures
- [API Reference](./api/reference.md) - Complete API documentation
- [Email System](./email-flows.md) - Email service architecture and templates
- [Testing Strategy](./developer/testing-strategy.md) - Comprehensive testing approach

### For DevOps and SRE Teams

- [Deployment Guide](./deployment.md) - Detailed deployment instructions
- [Infrastructure](./infrastructure/overview.md) - Cloud infrastructure documentation
- [Monitoring](./operations/monitoring.md) - Monitoring and alerting setup
- [Security](./security/overview.md) - Security best practices and compliance
- [Disaster Recovery](./operations/disaster-recovery.md) - Backup and recovery procedures

### For Contributors

- [Contribution Guidelines](../CONTRIBUTING.md) - How to contribute to the project
- [Code Style Guide](./developer/code-style.md) - Coding standards and best practices
- [Pull Request Process](./developer/pull-request-process.md) - How to submit and review PRs

## Quick Links

- [System Status Dashboard](https://status.bioplatform.org)
- [API Documentation](https://api.bioplatform.org/docs)
- [GitHub Repository](https://github.com/bioplatform/nextjs-fastapi)
- [Issue Tracker](https://github.com/bioplatform/nextjs-fastapi/issues)

## Technical Stack

### Frontend
- **Framework**: Next.js 15+
- **Language**: TypeScript 5+
- **State Management**: React Query, Context API
- **UI Components**: Shadcn UI, Radix UI
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **Database ORM**: Drizzle

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.12+
- **Database Integration**: AsyncPG, SQLAlchemy
- **Authentication**: FastAPI Users
- **Task Queue**: Celery
- **Containerization**: Docker
- **CI/CD**: GitHub Actions

### Database
- **Primary Database**: PostgreSQL 15+ (Neon)
- **Caching**: Redis
- **Search**: PostgreSQL Full-Text Search

## Environment Setup

We support the following environments:

- **Development**: Local development environment
- **Staging**: Pre-production testing environment
- **Production**: Live production environment

See the [Deployment Guide](./deployment.md) for detailed environment configuration.