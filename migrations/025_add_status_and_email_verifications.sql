-- Migration: Two-gate registration — account status + email verification tokens
-- Date: 2026-06-20
-- Description: Adds users.status (email-verification + admin/rabbi approval gates) and an
--              email_verifications token table mirroring password_resets (migration 005).

-- 1. Account status. DEFAULT 'active' so every EXISTING user backfills to active and is
--    never locked out; new registrations set 'pending_verification' explicitly.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Enum-like guard (this codebase uses TEXT + CHECK rather than native enums). Wrapped so
-- re-running the migration is a no-op (ADD CONSTRAINT is not idempotent on its own).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('pending_verification', 'pending_approval', 'active', 'rejected'));
  END IF;
END$$;

-- The admin approval queue scans only pending_approval; a partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_users_status_pending_approval
  ON users(status) WHERE status = 'pending_approval';

COMMENT ON COLUMN users.status IS 'Account lifecycle: pending_verification -> pending_approval -> active | rejected';

-- 2. Email verification tokens (Gate 1). Mirrors password_resets (migration 005):
--    opaque random token, 24h expiry, single-use.
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);

COMMENT ON TABLE email_verifications IS 'Email-verification tokens for two-gate registration (Gate 1)';
