-- Migration: Create member_profiles table
-- Date: 2026-06-14
-- Description: Member directory profiles (1:1 with users). Opt-in, private by
--              default. Phone and household are encrypted at rest (AES-256-CBC);
--              bio and interests are plaintext (interests is ILIKE-searched).

CREATE TABLE IF NOT EXISTS member_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  listed BOOLEAN NOT NULL DEFAULT false,            -- opt-in: appears in the directory only when true
  show_phone BOOLEAN NOT NULL DEFAULT false,        -- per-field visibility (sensitive)
  show_email BOOLEAN NOT NULL DEFAULT false,        -- per-field visibility (sensitive)
  show_household BOOLEAN NOT NULL DEFAULT false,     -- per-field visibility (sensitive)
  phone_encrypted TEXT,                             -- Application-level encryption, never searched
  household_encrypted TEXT,                         -- Application-level encryption, never searched
  bio TEXT,                                         -- plaintext, displayed (escaped on render)
  interests TEXT,                                   -- plaintext, ILIKE-searched
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hot predicate for every browse/search query: only listed profiles are returned.
CREATE INDEX IF NOT EXISTS idx_member_profiles_listed ON member_profiles(listed);

COMMENT ON COLUMN member_profiles.phone_encrypted IS 'AES-256-CBC encrypted member phone (directory PII; never searched/filtered)';
COMMENT ON COLUMN member_profiles.household_encrypted IS 'AES-256-CBC encrypted household/family text (directory PII; never searched/filtered)';
COMMENT ON TABLE member_profiles IS 'Member directory profiles, 1:1 with users; opt-in (listed) and private by default';
