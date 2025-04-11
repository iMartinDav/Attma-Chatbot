# Authentication System

## Overview

The authentication system for Attma Chatbot uses FastAPI Users with SQLAlchemy integration. The backend handles core authentication while most user data is managed by the frontend's Neon PostgreSQL database.

## Architecture

The authentication system is split between backend and frontend:

- **Backend (FastAPI)**: Handles core authentication functions and stores minimal user data
- **Frontend (Next.js)**: Stores extended user profile data and manages application-specific user data

## Authentication Flow

1. User registers through the frontend
2. Frontend sends registration data to backend
3. Backend creates minimal auth record (email, hashed password)
4. Frontend stores additional user data in its own database
5. Login generates JWT token from backend
6. Token is used for authenticated requests

## API Endpoints

### JWT Authentication
- `/auth/jwt/login` - Login and receive JWT token
- `/auth/jwt/logout` - Logout (invalidate token)

### User Registration and Management
- `/auth/register` - Register a new user
- `/auth/request-verify-token` - Request email verification
- `/auth/verify` - Verify email
- `/auth/forgot-password` - Request password reset
- `/auth/reset-password` - Reset password using token

## Security Features

- Password hashing with bcrypt
- JWT token authentication with configurable expiration
- Email verification (optional)
- Password reset functionality
- CORS protection

## Implementation Details

### Models
- `User` model extends `SQLAlchemyBaseUserTableUUID`
- Email field is varchar(64) to match frontend schema
- Other auth fields (is_active, is_superuser, etc.) inherited from FastAPI Users

### Schemas
- `UserCreate`, `UserRead`, `UserUpdate` schemas for user management
- `PasswordResetCreate`, `PasswordResetConfirm` for password resets

## Frontend Integration

1. Frontend makes API calls to backend for authentication
2. After successful auth, frontend fetches additional user data from its own database
3. Single source of truth for user data is the frontend database
4. Backend syncs only essential auth-related data