-- Migration: Create events table for the calendar feature (Epic 6)
-- Date: 2026-06-14
-- Description: DB-backed events store replacing the legacy in-memory EventService.
--   id is SERIAL/INTEGER because scheduled_streams.event_id is an INTEGER FK
--   already pointing at this table. Soft-deletable (deleted_at), visibility-flagged
--   (public|members), one-shot 24h reminder guard (reminder_sent_at).

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  visibility VARCHAR(16) NOT NULL DEFAULT 'public',
  event_type VARCHAR(32) NOT NULL DEFAULT 'event',
  location VARCHAR(255),
  zoom_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT events_visibility_check CHECK (visibility IN ('public', 'members')),
  CONSTRAINT events_type_check CHECK (event_type IN ('service', 'event')),
  CONSTRAINT events_ends_after_starts_check CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- Indexes for the calendar reads. Partial (deleted_at IS NULL) because every read
-- filters out soft-deleted rows.
CREATE INDEX IF NOT EXISTS idx_events_starts_at
  ON events(starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_visibility_starts
  ON events(visibility, starts_at) WHERE deleted_at IS NULL;
-- Cheap hourly reminder scan: only events not yet reminded.
CREATE INDEX IF NOT EXISTS idx_events_reminder_scan
  ON events(starts_at) WHERE deleted_at IS NULL AND reminder_sent_at IS NULL;

COMMENT ON TABLE events IS 'Calendar events (Epic 6). visibility: "public" (all) | "members" (logged-in only). event_type: "service" (drives homepage countdown) | "event". deleted_at non-null = soft-deleted/archived. reminder_sent_at non-null = the single 24h reminder was enqueued.';
