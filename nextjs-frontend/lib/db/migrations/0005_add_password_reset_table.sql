-- Create password reset table
CREATE TABLE IF NOT EXISTS "PasswordReset" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "token" VARCHAR(255) NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create an index on token for faster lookups
CREATE INDEX IF NOT EXISTS "password_reset_token_idx" ON "PasswordReset" ("token");

-- Create an index on userId for faster lookups and to enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_user_idx" ON "PasswordReset" ("userId");
