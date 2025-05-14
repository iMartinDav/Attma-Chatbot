# Deployment Guide

## Overview

This guide covers deploying the NextJS-FastAPI application with unified Neon PostgreSQL database. The architecture consists of:

1. **Frontend**: Next.js application deployed on Vercel
2. **Backend**: FastAPI service deployed as a containerized application
3. **Database**: Neon PostgreSQL (serverless Postgres)
4. **Email Service**: Integrated with frontend email templates

## Prerequisites

- Vercel account for frontend deployment
- Container-capable hosting (AWS, GCP, Azure, etc.)
- Neon PostgreSQL account
- GitHub account for CI/CD

## Environment Setup

### Common Environment Variables

These variables are used by both frontend and backend:

```
# Database Configuration
DATABASE_URL=postgres://user:password@neon-db-url:5432/dbname
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=your_database_name

# Authentication
AUTH_SECRET=your_auth_secret
JWT_SECRET=your_jwt_secret
JWT_ALGORITHM=HS256
JWT_EXPIRATION=86400

# Application Settings
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
```

### Frontend-Specific Variables

```
# Email Settings
EMAIL_SERVER_USER=your_email_user
EMAIL_SERVER_PASSWORD=your_email_password
EMAIL_SERVER_HOST=smtp.provider.com
EMAIL_SERVER_PORT=587
EMAIL_FROM=noreply@yourdomain.com
```

### Backend-Specific Variables

```
# API Settings
API_PREFIX=/api
API_DEBUG=false
CORS_ORIGINS=https://yourdomain.com
LOG_LEVEL=INFO
WORKERS=4
```

## Database Setup

### Neon PostgreSQL Configuration

1. **Create a Neon Project**:
   - Sign up/login to [Neon](https://neon.tech)
   - Create a new project
   - Note the connection string

2. **Configure Connection Pooling**:
   - Enable connection pooling in Neon dashboard
   - Use the pooled connection string for production

3. **Configure Database Security**:
   - Set up IP allowlist for your backend servers
   - Use TLS for all connections
   - Store credentials securely

4. **Database Initialization**:
   - The schema is managed by Drizzle ORM
   - Run migrations before deployment: `pnpm drizzle-kit push:pg`

## Frontend Deployment (Vercel)

1. **Connect GitHub Repository**:
   - Link your GitHub repository to Vercel
   - Configure the build settings for Next.js

2. **Configure Environment Variables**:
   - Add all environment variables in Vercel dashboard
   - Ensure `NEXTAUTH_URL` matches your production domain

3. **Configure Build Settings**:
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

4. **Deploy**:
   - Trigger deployment manually or via git push
   - Verify deployment succeeded

## Backend Deployment

### Railway Deployment

The backend is deployed to Railway for improved performance and scalability.

1. **Set Up Railway Project**:
   - Create an account on [Railway](https://railway.app)
   - Connect your GitHub repository
   - Set your backend directory (fastapi_backend) as the source

2. **Configure Environment Variables**:
   - Add all required environment variables in Railway dashboard
   - Ensure DATABASE_URL is properly set

3. **Deploy to Railway**:
   ```bash
   cd fastapi_backend
   railway up
   ```

4. **Access the Deployed Backend**:
   - The backend is available at [attma-chatbot-production.up.railway.app](https://attma-chatbot-production.up.railway.app)
   - API documentation is available at [attma-chatbot-production.up.railway.app/docs](https://attma-chatbot-production.up.railway.app/docs)

### Health Checks

Add the following health checks to your deployment configurations:

1. **Basic Health Check**:
   - Endpoint: `/api/health`
   - Expected Response: `{"status":"healthy",...}`
   - Check Frequency: Every 30 seconds
   - Timeout: 5 seconds
   - Unhealthy threshold: 3 consecutive failures

2. **Deep Health Check**:
   - Endpoint: `/api/health/deep`
   - Tests all system components including database
   - Check Frequency: Every 2 minutes
   - Timeout: 10 seconds

3. **Configure Load Balancer**:
   - Use health checks to determine instance health
   - Set up proper timeouts and thresholds

### Monitoring Configuration

1. **Set up Application Monitoring**:
   - Configure OpenTelemetry for distributed tracing
   - Set up logging with structured JSON format
   - Configure error reporting

2. **Database Monitoring**:
   - Monitor connection pool status
   - Set alerts for high query times
   - Monitor disk usage and connection count

3. **Performance Monitoring**:
   - Set up real user monitoring
   - Configure synthetic tests for critical paths
   - Set up alerts for performance degradation

## CI/CD Pipeline

### GitHub Actions Workflow

The repository includes GitHub Actions workflows for CI/CD:

1. **Backend Workflow**: `.github/workflows/test-backend.yml`
   - Runs tests on pull requests
   - Builds and publishes Docker image on merge to main

2. **Frontend Workflow**: 
   - Vercel automatically deploys the frontend
   - Preview deployments for pull requests

### Automated Testing

Before deployment:
- Unit tests must pass
- Integration tests must pass
- Contract tests between frontend and backend must pass

## Database Migration Process

1. **Generate Migration**:
   ```bash
   pnpm drizzle-kit generate:pg
   ```

2. **Review Migration**:
   - Carefully review generated SQL
   - Test on staging environment

3. **Apply Migration**:
   ```bash
   pnpm migrate
   ```

4. **Monitoring**:
   - Monitor application logs during migration
   - Be prepared to rollback if issues occur

### Rollback Procedure

In case of deployment issues:

1. **Application Rollback**:
   - Revert to previous container version
   - Verify application functionality

2. **Database Rollback**:
   - Execute down migrations if database issues
   - Restore from backup if necessary

3. **Communication**:
   - Update status page
   - Notify on-call team

## Security Considerations

1. **Database Security**:
   - Use secure connection strings
   - Enable TLS for all connections
   - Implement proper access controls

2. **API Security**:
   - Rate limiting to prevent abuse
   - Input validation on all endpoints
   - CORS configuration for allowed origins

3. **Environment Security**:
   - Never commit secrets to repository
   - Use environment variable encryption
   - Audit access to production systems

## Post-Deployment Verification

1. **Smoke Tests**:
   - Verify API endpoints return correct data
   - Check authentication flows
   - Ensure database connectivity

2. **Performance Tests**:
   - Check response times under load
   - Verify database query performance
   - Monitor error rates and system resources

3. **User Flow Tests**:
   - Test critical user flows
   - Verify email functionality
   - Check analytics tracking
