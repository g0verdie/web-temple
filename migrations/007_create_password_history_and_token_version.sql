-- Migration: Create password_history table and add token_version to users
-- Date: 2026-02-17
-- Description: Enforce password history requirements and support session invalidation

-- Add token_version to users table for session invalidation
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;

-- Create password_history table
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);

COMMENT ON TABLE password_history IS 'Stores previous password hashes to enforce history policy (last 5)';
