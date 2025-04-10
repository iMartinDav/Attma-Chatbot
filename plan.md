# Database Integration Plan: FastAPI Backend with Next.js Frontend

## Overview
The current setup has two separate database implementations:
1. Frontend (Next.js) using Drizzle ORM with Neon PostgreSQL
2. Backend (FastAPI) using SQLAlchemy with a different database setup

The goal is to unify these into a single database system using the frontend's Neon PostgreSQL with Drizzle ORM implementation, while maintaining FastAPI's authentication and API functionality.

## Phase 1: Backend Database Cleanup and Preparation ✅
- [x] Task 1.1: Remove unused SQLAlchemy models and dependencies
  - Remove unused Item model
  - Clean up SQLAlchemy-specific code
  - Document current authentication flows
  - Commit: "chore: cleanup unused SQLAlchemy models and dependencies"

- [x] Task 1.2: Create Python Drizzle Schema Types
  - Create Python type definitions matching frontend Drizzle schema
  - Implement type conversion utilities
  - Add schema validation
  - Commit: "feat: add Python Drizzle schema type definitions"

## Phase 2: Database Connection Layer ✅
- [x] Task 2.1: Implement Neon Database Connection
  - Add asyncpg connection pool
  - Configure environment variables
  - Create connection management utilities
  - Commit: "feat: implement Neon database connection layer"

- [x] Task 2.2: Create Database Query Layer
  - Implement query builder utilities
  - Add type-safe query functions
  - Create connection pooling manager
  - Add error handling and retries
  - Commit: "feat: Add database connection layer to share data between FastAPI and Next.js"

## Phase 3: Authentication Integration
- [ ] Task 3.1: Update User Management
  - Modify FastAPI Users to work with Drizzle schema
  - Update password hashing to match frontend
  - Integrate with frontend JWT strategy
  - Commit: "feat: update user management for Drizzle integration"

- [ ] Task 3.2: Authentication Flow Updates
  - Update login/register endpoints
  - Integrate password reset functionality
  - Update email verification system
  - Add proper error handling
  - Commit: "feat: update authentication flows for unified db"

## Phase 4: Email Service Integration
- [ ] Task 4.1: Remove Backend Email Service
  - Remove FastAPI Mail dependency
  - Clean up backend email templates
  - Document current email flows
  - Commit: "chore: remove legacy email system"

- [ ] Task 4.2: Integrate Frontend Email Service
  - Add HTTP client to call frontend email API
  - Create email service adapter
  - Implement retry mechanism
  - Add proper error handling
  - Commit: "feat: integrate frontend email service"

- [ ] Task 4.3: Update Email Templates
  - Map existing email scenarios to frontend templates
  - Add any missing templates to frontend
  - Update email content and styling
  - Test all email flows
  - Commit: "feat: update email templates and flows"

- [ ] Task 4.4: Email Service Testing
  - Add integration tests for email flows
  - Test rate limiting
  - Test authentication flows
  - Test template rendering
  - Commit: "test: add email service tests"

## Benefits of New Email System:
1. React-based email templates with better maintainability
2. Built-in rate limiting per user
3. Consistent authentication across frontend and backend
4. Environment-aware email sending
5. Centralized email template management
6. Improved error handling and logging
7. Reuse of frontend's email infrastructure

## Phase 5: API Integration and Testing
- [ ] Task 5.1: Update API Endpoints
  - Modify endpoints to use new database layer
  - Update response formats
  - Add request validation
  - Commit: "feat: update API endpoints for new db layer"

- [ ] Task 5.2: Testing Infrastructure
  - Add integration tests
  - Implement test database utilities
  - Add API endpoint tests
  - Create CI test workflow
  - Commit: "feat: add testing infrastructure"

## Phase 6: Documentation and Deployment
- [ ] Task 6.1: Documentation
  - Update API documentation
  - Add database schema documentation
  - Document authentication flows
  - Add deployment guides
  - Commit: "docs: add comprehensive documentation"

- [ ] Task 6.2: Deployment Updates
  - Update deployment configurations
  - Add health checks
  - Configure monitoring
  - Commit: "feat: update deployment configuration"

## Testing Strategy for Each Phase
1. Unit Tests:
   - Database operations
   - Type conversions
   - Authentication functions
   - Email formatting

2. Integration Tests:
   - Database connections
   - Authentication flows
   - API endpoints
   - Email sending

3. End-to-End Tests:
   - Complete user flows
   - API workflows
   - Error scenarios

## Rollback Strategy
- Database backups before each phase
- Version control tags at each major step
- Documented rollback procedures
- Monitoring setup

## Success Criteria
1. All frontend database operations work through backend API
2. Authentication system fully functional
3. Email services working correctly
4. All tests passing
5. Documentation complete
6. Performance metrics meeting requirements

## Timeline Estimation
- Phase 1: 2 days
- Phase 2: 3 days
- Phase 3: 3 days
- Phase 4: 2 days
- Phase 5: 3 days
- Phase 6: 2 days

Total: ~15 working days with testing and validation

## Notes
- Each commit should include proper testing
- Database migrations should be backward compatible
- Keep security as top priority
- Document all configuration changes
- Monitor performance metrics
