-- Migration: Create announcements table
-- Date: 2026-06-14
-- Description: Member-facing announcements authored by staff (Rabbi / Admin /
--              Social Chair). body_html is server-sanitized on write (allowlist
--              of formatting/link/image tags). Soft-delete (deleted_at) keeps the
--              archive + full-content audit trail. A single row is "featured"
--              (pinned) at a time with a 30-day lazy expiry evaluated at read time
--              (featured_until > NOW()); there is no DB partial-unique constraint
--              because the read predicate and a constraint would disagree once the
--              expiry passes. UUIDs are app-supplied (uuidv4), matching recordings.

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY,                                       -- app-supplied (uuidv4), not a DB default
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,                                   -- sanitized HTML (safe to render raw)
  body_text TEXT,                                            -- derived plaintext (email text part + previews)
  status TEXT NOT NULL DEFAULT 'published',
  featured BOOLEAN NOT NULL DEFAULT false,
  featured_until TIMESTAMPTZ,                                -- 30-day pin expiry (FR111); evaluated lazily at read time
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),           -- preserved across edits (Story 5.3)
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,                                    -- soft delete (FR32)
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CHECK (status IN ('published', 'deleted'))
);

-- Hot homepage read: only published rows, newest-first.
CREATE INDEX IF NOT EXISTS idx_announcements_published
  ON announcements (published_at DESC)
  WHERE status = 'published';

-- Featured/pin lookup + lazy-expiry predicate.
CREATE INDEX IF NOT EXISTS idx_announcements_featured
  ON announcements (featured_until)
  WHERE featured = true AND status = 'published';

COMMENT ON TABLE announcements IS 'Staff-authored member announcements; soft-deleted, single featured row with 30-day lazy expiry';
COMMENT ON COLUMN announcements.body_html IS 'Server-sanitized HTML (sanitize-html allowlist); safe to render raw via <%- %>';
COMMENT ON COLUMN announcements.body_text IS 'Derived plaintext for the email text part and homepage previews';
COMMENT ON COLUMN announcements.featured_until IS '30-day pin expiry (FR111); featured rows stop pinning once featured_until < NOW()';
COMMENT ON COLUMN announcements.published_at IS 'Original publish time, preserved across edits (Story 5.3)';
COMMENT ON COLUMN announcements.deleted_at IS 'Soft-delete timestamp (FR32); archive/restore keeps the audit trail intact';
