-- Migration: Add live_started_at to scheduled_streams
-- Date: 2026-06-16
-- Description: Records the moment an admin actually takes a stream live (the explicit
--              "Go Live" action = activateScheduledStream). The public homepage now
--              treats a stream as LIVE only while status='active' AND live_started_at
--              is within the live window (STREAM_MAX_LIVE_HOURS, default 4h). This is
--              the auto-expiry safety net: a forgotten/dead 'active' row (e.g. a stale
--              "Manual Test Stream") stops showing "LIVE NOW" with an open chat once
--              the window passes — Facebook's cross-origin embed can't be health-probed,
--              so an admin-asserted, time-bounded signal is the honest definition of live.
--              Existing 'active' rows keep live_started_at = NULL and are therefore
--              treated as not-live (intentional — clears stale live state on deploy).
--              Idempotent so re-runs are safe.

ALTER TABLE scheduled_streams ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMP NULL;

COMMENT ON COLUMN scheduled_streams.live_started_at IS 'When the stream was taken live (set by activateScheduledStream). Public "live" requires this to be within STREAM_MAX_LIVE_HOURS; NULL/expired => not shown as live.';
