-- Add notification preferences to users table
-- Date: 2026-03-07
-- Description: Store per-user notification preferences for announcements, calendar events, messages, and recordings

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"messages": true, "recordings": true, "announcements": true, "calendar_events": true}';

COMMENT ON COLUMN users.notification_preferences IS 'Per-user notification preferences';
