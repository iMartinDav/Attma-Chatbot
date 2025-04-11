-- Initialize database schema for the integrated Next.js (Drizzle) and FastAPI application

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Chat_userId_idx" ON "Chat"("userId");
CREATE INDEX IF NOT EXISTS "Message_chatId_idx" ON "Message"("chatId");

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