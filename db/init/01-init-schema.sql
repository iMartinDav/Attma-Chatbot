-- Initialize database schema for the integrated Next.js (Drizzle) and FastAPI application

-- Create the test database if it doesn't exist
CREATE DATABASE test_db;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" UUID PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "lastLogin" TIMESTAMP WITH TIME ZONE
);

-- Session table for NextAuth.js
CREATE TABLE IF NOT EXISTS "Session" (
    "id" UUID PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" UUID PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- OAuth accounts
CREATE TABLE IF NOT EXISTS "Account" (
    "id" UUID PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "sessionState" TEXT,
    UNIQUE("provider", "providerAccountId")
);

-- Chat conversations
CREATE TABLE IF NOT EXISTS "Chat" (
    "id" UUID PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "lastMessageAt" TIMESTAMP WITH TIME ZONE
);

-- Chat messages
CREATE TABLE IF NOT EXISTS "Message" (
    "id" UUID PRIMARY KEY,
    "chatId" UUID NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE
);

-- Uploaded files tracking
CREATE TABLE IF NOT EXISTS "uploaded_files" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "original_name" TEXT NOT NULL,
    "file_path" TEXT,
    "content_type" TEXT,
    "size" BIGINT NOT NULL,
    "blob_url" TEXT,
    "is_bioinformatics_file" BOOLEAN NOT NULL DEFAULT FALSE,
    "file_type" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "last_accessed" TIMESTAMP WITH TIME ZONE
);

-- Analysis jobs tracking
CREATE TABLE IF NOT EXISTS "analysis_jobs" (
    "id" TEXT PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "file_id" UUID REFERENCES "uploaded_files"("id") ON DELETE SET NULL,
    "status" TEXT NOT NULL,  -- 'processing', 'completed', 'failed'
    "file_name" TEXT,
    "result_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Analysis results
CREATE TABLE IF NOT EXISTS "analysis_results" (
    "id" TEXT PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "analysis_type" TEXT NOT NULL,  -- 'matrix_structure', 'sequence_data', etc.
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "metadata" JSONB,  -- For storing flexible metadata about the analysis
    "result_type" TEXT NOT NULL,  -- 'table', 'graph', etc.
    "storage_type" TEXT NOT NULL,  -- 'database', 'blob', etc.
    "result_location" TEXT,  -- URL or path if stored externally
    "small_result" JSONB,  -- For small results stored directly in the database
    "large_result_blob_id" TEXT  -- Reference to Vercel Blob Storage
);

-- Artifacts for chat documents
CREATE TABLE IF NOT EXISTS "Document" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "title" TEXT NOT NULL,
    "content" TEXT,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'text',  -- 'text', 'sheet', 'code', 'image', 'pdf', 'graph'
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "analysisResultId" TEXT REFERENCES "analysis_results"("id") -- Link to bioinformatics analysis result
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Chat_userId_idx" ON "Chat"("userId");
CREATE INDEX IF NOT EXISTS "Message_chatId_idx" ON "Message"("chatId");
CREATE INDEX IF NOT EXISTS "uploaded_files_user_id_idx" ON "uploaded_files"("user_id");
CREATE INDEX IF NOT EXISTS "analysis_jobs_user_id_idx" ON "analysis_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "analysis_jobs_file_id_idx" ON "analysis_jobs"("file_id");
CREATE INDEX IF NOT EXISTS "analysis_results_user_id_idx" ON "analysis_results"("user_id");
CREATE INDEX IF NOT EXISTS "Document_userId_idx" ON "Document"("userId");
CREATE INDEX IF NOT EXISTS "Document_kind_idx" ON "Document"("kind");
CREATE INDEX IF NOT EXISTS "Document_analysisResultId_idx" ON "Document"("analysisResultId");

-- Add a test user for development
INSERT INTO "User" ("id", "email", "password", "name", "emailVerified", "createdAt", "updatedAt")
VALUES (
    uuid_generate_v4(),
    'test@example.com',
    '$2b$12$OlYYZN.vnNZ8vU/olqv5NOC.fApQBzEhdaOGJuT3nQzUNNJhvErYy', -- hashed 'password123'
    'Test User',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Add a test chat
DO $$
DECLARE
    test_user_id UUID;
    test_chat_id UUID;
BEGIN
    -- Get the test user ID
    SELECT "id" INTO test_user_id FROM "User" WHERE "email" = 'test@example.com';
    
    IF test_user_id IS NOT NULL THEN
        -- Create a test chat
        test_chat_id := uuid_generate_v4();
        
        INSERT INTO "Chat" ("id", "userId", "title", "createdAt", "updatedAt", "lastMessageAt")
        VALUES (
            test_chat_id,
            test_user_id,
            'Test Chat',
            NOW(),
            NOW(),
            NOW()
        );
        
        -- Add some test messages
        INSERT INTO "Message" ("id", "chatId", "content", "role", "createdAt", "updatedAt")
        VALUES
            (uuid_generate_v4(), test_chat_id, 'Hello, this is a test message', 'user', NOW(), NOW()),
            (uuid_generate_v4(), test_chat_id, 'This is a response from the assistant', 'assistant', NOW(), NOW());
    END IF;
END $$;