-- Migration: Add member address to member_profiles
-- Date: 2026-06-15
-- Description: Optional single-line member address, encrypted at rest (AES-256-CBC),
--              with its own per-field visibility flag (members-only directory, same
--              gating as phone). Idempotent so re-runs are safe.

ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS address_encrypted TEXT;
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS show_address BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN member_profiles.address_encrypted IS 'AES-256-CBC encrypted member address (directory PII; never searched/filtered)';
