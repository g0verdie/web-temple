-- Migration: Add caption metadata to recordings
-- Date: 2026-04-27
-- Description: Adds caption_url and caption_format columns required by Story 3.5
-- (Recording Playback with Accessibility) so the member playback view can render
-- a WebVTT track when available and otherwise expose a "captions are burned in"
-- affordance. Existing rows default to 'burned-in' to preserve FR70 compliance
-- without forcing a publish-time backfill.

ALTER TABLE recordings
    ADD COLUMN IF NOT EXISTS caption_url TEXT,
    ADD COLUMN IF NOT EXISTS caption_format VARCHAR(20)
        NOT NULL DEFAULT 'burned-in'
        CHECK (caption_format IN ('webvtt', 'burned-in'));

COMMENT ON COLUMN recordings.caption_url IS 'Optional WebVTT track URL when caption_format = ''webvtt''.';
COMMENT ON COLUMN recordings.caption_format IS 'Caption delivery: ''webvtt'' (toggleable text track) or ''burned-in'' (always-on, no toggle).';
