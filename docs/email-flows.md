# Email System Documentation

## Legacy Email System (FastAPI Backend)

### Overview
The legacy email system uses FastAPI Mail to send email notifications for:
- Password reset requests
- Email verification
- Other system notifications

### Components
1. **Configuration**: Uses environment variables in `.env` file for mail server settings
2. **Templates**: HTML templates located in `fastapi_backend/app/email_templates/`
3. **Core Module**: Implemented in `fastapi_backend/app/email.py`

### Email Flows

#### 1. Password Reset Flow
1. User requests password reset
2. System generates a reset token
3. Token is stored in the "PasswordReset" table with:
   - Token ID
   - User ID
   - Token string
   - Expiration (24 hours from creation)
   - Creation timestamp
4. Email is sent with a reset link containing the token
5. User clicks link and is directed to frontend reset form
6. Frontend submits token and new password to backend
7. Backend verifies token and updates password

#### 2. Email Verification Flow
1. User registers or requests email verification
2. System generates a verification token
3. Email is sent with verification link containing the token
4. User clicks link and is directed to frontend
5. Frontend submits token to backend
6. Backend verifies token and marks email as verified

### Key Functions
- `send_email`: General email sending function
- `send_reset_password_email`: Handles password reset flow
- `send_verification_email`: Handles email verification flow
- `verify_password_reset_token`: Verifies password reset tokens

## New Email System (Frontend Integration)

The new system will call the Next.js frontend's email service API, which offers:
1. React-based email templates
2. Built-in rate limiting
3. Consistent authentication
4. Environment-aware sending
5. Centralized template management
6. Improved error handling and logging

### Migration Strategy
1. Remove FastAPI Mail dependency
2. Create HTTP client to call frontend email API
3. Implement adapter for existing email functions
4. Update templates on the frontend side
5. Add proper error handling and retries