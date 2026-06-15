-- Migration: Add member birthday to member_profiles
-- Date: 2026-06-15
-- Description: Optional member birthday, encrypted at rest (AES-256-CBC) like the
--              other directory PII, with its own per-field visibility flag. The
--              full date is stored, but member-facing rendering shows only the
--              month and day (the year/age is never exposed to other members —
--              enforced server-side in MemberDirectoryService.shapeForMember).
--              Idempotent so re-runs are safe.

ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS birthday_encrypted TEXT;
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN member_profiles.birthday_encrypted IS 'AES-256-CBC encrypted member birthday (ISO YYYY-MM-DD; directory PII; never searched/filtered; only month+day shown to members)';
