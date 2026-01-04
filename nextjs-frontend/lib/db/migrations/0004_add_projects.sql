-- Create Project table
CREATE TABLE IF NOT EXISTS "Project" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "emoji" VARCHAR(10) DEFAULT '📁',
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add projectId column to Chat table
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "projectId" UUID REFERENCES "Project"("id") ON DELETE SET NULL;

-- Create index for faster project lookups by user
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");

-- Create index for faster chat lookups by project
CREATE INDEX IF NOT EXISTS "Chat_projectId_idx" ON "Chat"("projectId");
