# API Reference

## Overview

This API provides a unified interface for accessing the NextJS-FastAPI application with PostgreSQL (Neon) database. The backend uses FastAPI with Drizzle ORM for database operations.

## API Design Principles

The BioPlatform API follows these design principles:

1. **RESTful Design**: Resources are accessed through predictable URLs
2. **Consistent Structure**: All endpoints follow the same pattern
3. **Comprehensive Documentation**: Every endpoint is fully documented
4. **Proper Error Handling**: Standardized error responses
5. **Rate Limiting**: Protection against abuse
6. **Versioned**: API versioning for backward compatibility

## Authentication

### Authentication Methods

All API endpoints (except public health checks and documentation) require authentication using one of the following methods:

1. **JWT Bearer Token**: `Authorization: Bearer <token>`
2. **API Key**: `X-API-Key: <api_key>` (for service-to-service communication)

### Obtaining Authentication Tokens

Tokens can be obtained through:

- **Login Endpoint**: `/api/auth/jwt/login`
- **OAuth Flow**: For third-party authentication
- **API Key Management**: Through the admin dashboard

All authenticated endpoints require a valid JWT token provided in the `Authorization` header:

```
Authorization: Bearer {token}
```

Authentication tokens can be obtained through the `/auth/jwt/login` endpoint.

## Base URL

- Development: `http://localhost:8000`
- Production: [Your production URL]

## Standard Response Format

All API endpoints follow a consistent response format:

```json
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource could not be found",
    "details": {
      "resource_type": "User",
      "resource_id": "123456"
    }
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

## Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_FAILED` | 401 | Authentication credentials are invalid |
| `AUTHORIZATION_FAILED` | 403 | User does not have permission for the action |
| `RESOURCE_NOT_FOUND` | 404 | The requested resource could not be found |
| `VALIDATION_ERROR` | 422 | The request data failed validation |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit for the API has been exceeded |
| `INTERNAL_ERROR` | 500 | An unexpected error occurred on the server |

## API Endpoints

### User Management

#### Get Current User

```
GET /api/users/me
```

Retrieves the profile of the currently authenticated user.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://example.com/avatar.jpg",
    "emailVerified": "2025-01-15T14:30:15Z",
    "createdAt": "2024-12-01T10:20:30Z",
    "updatedAt": "2025-03-15T18:45:22Z"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

#### Register New User

```
POST /api/auth/register
```

Register a new user account.

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "password": "SecureP@ssw0rd",
  "name": "New User"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "newuser@example.com",
    "name": "New User"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Register User

```
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "strongpassword"
}
```

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "is_active": true,
  "is_verified": false
}
```

#### Update User Profile

```
PUT /api/users/me
```

Update the current user's profile information.

**Request Body**:
```json
{
  "name": "Updated Name",
  "image": "https://example.com/new-avatar.jpg"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Updated Name",
    "image": "https://example.com/new-avatar.jpg",
    "updatedAt": "2025-04-11T12:34:56Z"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Authentication

#### Login

```
POST /api/auth/jwt/login
```

Authenticate a user and get an access token.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_at": "2025-04-11T13:34:56Z"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Login

```
POST /auth/jwt/login
```

**Request Body (form-data):**
- `username`: User email
- `password`: User password

**Response:**
```json
{
  "access_token": "eyJ0eXA...",
  "token_type": "bearer"
}
```

#### Request Password Reset

```
POST /api/auth/forgot-password
```

Send a password reset email to the user.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "If an account with this email exists, a password reset link has been sent"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Request Password Reset

```
POST /auth/forgot-password
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Password reset email sent"
}
```

#### Reset Password

```
POST /api/auth/reset-password
```

Reset a user's password using the token from the email.

**Request Body**:
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecureP@ssw0rd"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Reset Password

```
POST /auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset_token",
  "password": "new_password"
}
```

**Response:**
```json
{
  "message": "Password updated successfully"
}
```

### Current User

```
GET /users/me
```

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "is_active": true,
  "is_verified": true
}
```

### Chat Management

#### Get User Chats

```
GET /api/chats
```

Get all chat sessions for the current user.

**Query Parameters**:
- `limit`: Maximum number of chats to return (default: 10)
- `offset`: Number of chats to skip (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "title": "Genome Analysis #1",
        "createdAt": "2025-04-10T09:15:22Z",
        "updatedAt": "2025-04-10T10:30:45Z",
        "lastMessageAt": "2025-04-10T10:30:45Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "title": "Protein Folding Discussion",
        "createdAt": "2025-04-09T14:20:15Z",
        "updatedAt": "2025-04-09T16:45:30Z",
        "lastMessageAt": "2025-04-09T16:45:30Z"
      }
    ],
    "total": 24,
    "limit": 10,
    "offset": 0
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

#### Get Chat Messages

```
GET /api/chats/{chatId}/messages
```

Get all messages in a specific chat.

**Path Parameters**:
- `chatId`: ID of the chat session

**Query Parameters**:
- `limit`: Maximum number of messages to return (default: 50)
- `before`: Only return messages created before this timestamp

**Response**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "chatId": "550e8400-e29b-41d4-a716-446655440010",
        "content": "Here are the genomic variations we found in the sample.",
        "role": "assistant",
        "createdAt": "2025-04-10T10:30:45Z",
        "updatedAt": "2025-04-10T10:30:45Z",
        "isDeleted": false
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440021",
        "chatId": "550e8400-e29b-41d4-a716-446655440010",
        "content": "Can you analyze this genomic sequence and identify any variants?",
        "role": "user",
        "createdAt": "2025-04-10T10:28:30Z",
        "updatedAt": "2025-04-10T10:28:30Z",
        "isDeleted": false
      }
    ],
    "hasMore": true
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

#### Create Chat

```
POST /api/chats
```

Create a new chat session.

**Request Body**:
```json
{
  "title": "New Bioinformatics Analysis"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440012",
    "title": "New Bioinformatics Analysis",
    "createdAt": "2025-04-11T12:34:56Z",
    "updatedAt": "2025-04-11T12:34:56Z"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

#### Send Message

```
POST /api/chats/{chatId}/messages
```

Send a new message in a chat.

**Path Parameters**:
- `chatId`: ID of the chat session

**Request Body**:
```json
{
  "content": "Can you analyze this protein sequence for potential binding sites?",
  "role": "user"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440022",
    "chatId": "550e8400-e29b-41d4-a716-446655440012",
    "content": "Can you analyze this protein sequence for potential binding sites?",
    "role": "user",
    "createdAt": "2025-04-11T12:34:56Z",
    "updatedAt": "2025-04-11T12:34:56Z",
    "isDeleted": false
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Bioinformatics Analysis

#### Run Sequence Analysis

```
POST /api/bioflow/analyze
```

Run a bioinformatics analysis on a sequence.

**Request Body**:
```json
{
  "sequence": "ATGCGTACGATCGATCGATCGATCG",
  "analysisType": "gene-prediction",
  "parameters": {
    "minGeneLength": 300,
    "geneticCode": 1,
    "allowOverlap": false
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440030",
    "status": "queued",
    "estimatedCompletionTime": "2025-04-11T12:44:56Z"
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### Upload Matrix

```
POST /bioflow/upload/
```

**Request Body (multipart/form-data):**
- `file`: Matrix file (TSV/CSV)

**Response:**
```json
{
  "file_id": "unique_file_id"
}
```

### Analyze Matrix

```
POST /bioflow/analyze/
```

**Request Body:**
```json
{
  "file_id": "unique_file_id"
}
```

**Response:**
```json
{
  "data_type": "matrix",
  "delimiter": "\t",
  "has_header_row": true,
  "has_header_column": true,
  "num_rows": 1000,
  "num_columns": 50,
  "row_names_sample": ["gene1", "gene2", "gene3"],
  "column_names_sample": ["cell1", "cell2", "cell3"]
}
```

### Analysis Endpoints

#### Execute Tool

```
POST /analysis/execute-tool/
```

**Request Body:**
```json
{
  "file_id": "unique_file_id",
  "tool_name": "normalize_data",
  "parameters": {
    "method": "log1p"
  }
}
```

**Response:**
```json
{
  "result_id": "unique_result_id",
  "tool_name": "normalize_data",
  "status": "success",
  "metadata": {
    "execution_time": "1.5s"
  }
}
```

#### Get Analysis Status

```
GET /api/bioflow/jobs/{jobId}
```

Get the status of an analysis job.

**Path Parameters**:
- `jobId`: ID of the analysis job

**Response**:
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440030",
    "status": "completed",
    "progress": 100,
    "startedAt": "2025-04-11T12:35:00Z",
    "completedAt": "2025-04-11T12:42:30Z",
    "result": {
      "genes": [
        {
          "start": 1,
          "end": 903,
          "strand": "+",
          "score": 0.95,
          "product": "hypothetical protein"
        }
      ]
    }
  },
  "meta": {
    "timestamp": "2025-04-11T12:43:00Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

### System Health

#### Get System Status

```
GET /api/health
```

Get the current system health status. This endpoint is publicly accessible without authentication.

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.5.2",
    "services": {
      "database": {
        "status": "connected",
        "response_time_ms": 15
      },
      "application": {
        "status": "running",
        "uptime": 86400
      }
    }
  },
  "meta": {
    "timestamp": "2025-04-11T12:34:56Z",
    "version": "1.0",
    "request_id": "7f82c4d6-9a53-4b5e-8e7d-f98a2b4c6d0e"
  }
}
```

## Health Checks

### API Health

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "uptime": "10h 30m"
}
```

## Rate Limiting

API requests are subject to rate limiting to ensure fair usage and system stability:

| Plan | Limit | Period | Header |
|------|-------|--------|--------|
| Standard | 60 | 1 minute | X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset |
| Pro | 300 | 1 minute | X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset |
| Enterprise | 1000 | 1 minute | X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset |

Rate limit headers are included in all API responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1679317444
```

## Pagination

List endpoints support pagination using the `limit` and `offset` parameters:

- `limit`: Maximum number of items to return (default and max values vary by endpoint)
- `offset`: Number of items to skip

Response includes pagination metadata:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "limit": 10,
    "offset": 0
  },
  "meta": {...}
}
```

## Versioning

The API is versioned to ensure backward compatibility:

- Current stable version: `v1`
- Version can be specified in the URL path: `/api/v1/users`
- If omitted, the latest stable version is used

## SDKs and Client Libraries

Official client libraries are available for:

- [Python](https://github.com/bioplatform/python-sdk)
- [JavaScript/TypeScript](https://github.com/bioplatform/js-sdk)
- [R](https://github.com/bioplatform/r-sdk)

## Webhooks

Webhooks allow your application to receive real-time updates when specific events occur:

1. Register a webhook URL in your account settings
2. Select the events you want to subscribe to
3. Configure a secret key for verification
4. Receive event notifications at your webhook URL

Example webhook payload:

```json
{
  "event": "job.completed",
  "timestamp": "2025-04-11T12:42:30Z",
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440030",
    "status": "completed",
    "result": {
      "summary": "Analysis complete with 5 genes found"
    }
  },
  "signature": "sha256=..."
}
```