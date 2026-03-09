-- Add case-insensitive unique index for user emails
-- Date: 2026-03-07
-- Description: Prevent duplicate emails that only differ by case

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
