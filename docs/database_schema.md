# Database Schema Documentation

This document describes the unified database schema used by both the FastAPI backend and Next.js frontend.

## Overview

The application uses a PostgreSQL database hosted on Neon with the following characteristics:

- **ORM**: Drizzle ORM (TypeScript) with a Python adapter layer
- **Connection Pooling**: Managed through `asyncpg`  
- **Schema Management**: Defined in the frontend and used by both frontend and backend

## Schema Entities

### User

The `User` table stores user account information.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | User's email address (unique) |
| password | text | Hashed password |
| name | text | User's full name (optional) |
| image | text | URL to user's profile image (optional) |
| emailVerified | timestamp | When the email was verified |
| createdAt | timestamp | When the user was created |
| updatedAt | timestamp | When the user was last updated |
| lastLogin | timestamp | When the user last logged in (optional) |

### Session

The `Session` table stores user authentication sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| userId | uuid | References User.id |
| expiresAt | timestamp | When the session expires |
| createdAt | timestamp | When the session was created |

### PasswordReset

The `PasswordReset` table stores password reset tokens.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| userId | uuid | References User.id |
| token | text | Reset token |
| expiresAt | timestamp | When the token expires |
| createdAt | timestamp | When the token was created |

### Account

The `Account` table stores OAuth account connections.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| userId | uuid | References User.id |
| type | text | Account type (e.g., 'oauth') |
| provider | text | Provider name (e.g., 'google') |
| providerAccountId | text | Provider's account ID |
| refreshToken | text | OAuth refresh token (optional) |
| accessToken | text | OAuth access token (optional) |
| expiresAt | integer | Token expiration timestamp (optional) |
| tokenType | text | Token type (optional) |
| scope | text | OAuth scope (optional) |
| idToken | text | OAuth ID token (optional) |
| sessionState | text | Session state (optional) |

### Chat

The `Chat` table stores user chat conversations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| userId | uuid | References User.id |
| title | text | Chat title |
| createdAt | timestamp | When the chat was created |
| updatedAt | timestamp | When the chat was last updated |
| lastMessageAt | timestamp | When the last message was sent (optional) |

### Message

The `Message` table stores chat messages.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| chatId | uuid | References Chat.id |
| content | text | Message content |
| role | text | Message role (user/assistant) |
| createdAt | timestamp | When the message was created |
| updatedAt | timestamp | When the message was last updated |
| isDeleted | boolean | Whether the message is deleted |

## Entity Relationships

```
┌───────────┐     ┌────────────────┐     ┌──────────┐
│   User    │     │     Account     │     │  Session │
├───────────┤     ├────────────────┤     ├──────────┤
│ id        │1   *│ id             │     │ id       │
│ email     ├─────┤ userId         │     │ userId   │1
│ password  │     │ type           │     │ expiresAt├─────┐
│ name      │     │ provider       │     │ createdAt│     │
│ image     │     │ providerAcctId │     └──────────┘     │
│ ...       │1    │ ...            │                      │
└─────┬─────┘     └────────────────┘                      │
      │                                                   │
      │      ┌────────────────┐                           │
      │      │ PasswordReset  │                           │
      │     *├────────────────┤                           │
      └──────┤ id             │                           │
             │ userId         │                           │
             │ token          │                           │
             │ expiresAt      │                           │
             │ createdAt      │                           │
             └────────────────┘                           │
                                                          │
┌───────────┐                    ┌──────────┐             │
│  Message  │                    │   Chat   │             │
├───────────┤                    ├──────────┤             │
│ id        │                    │ id       │             │
│ chatId    │*                  1│ userId   │1            │
│ content   ├────────────────────┤ title    ├─────────────┘
│ role      │                    │ createdAt│
│ createdAt │                    │ updatedAt│
│ updatedAt │                    │ lastMessageAt│
│ isDeleted │                    └──────────┘
└───────────┘
```

## Access Patterns

The database design supports the following common access patterns:

1. User authentication and session management
2. Password reset flows
3. OAuth authentication
4. User profile management
5. Chat and message creation, retrieval, and management

## Database Connection

### Frontend

The frontend connects to the database using Drizzle ORM with the PostgreSQL adapter. Connection details are managed through environment variables.

### Backend

The backend connects to the database using a custom `asyncpg` connection pool. The connection details are shared with the frontend through environment variables.

Connection management is handled by the `app.drizzle` module, which provides:

- Connection pooling
- Transaction management
- Type-safe query and execution functions

## Migrations

Database migrations are managed through Drizzle's migration system in the frontend codebase. The backend adapts to schema changes automatically through the type definitions in `app.schema_utils`.

## Security Considerations

- All passwords are stored using bcrypt hashing
- Database connections use TLS encryption
- Query parameters are properly sanitized to prevent SQL injection
- Connection details are stored in environment variables, not hardcoded