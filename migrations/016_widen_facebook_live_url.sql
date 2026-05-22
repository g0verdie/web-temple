-- Migration: Widen facebook_live_url column from VARCHAR(512) to VARCHAR(2048)
-- Date: 2026-05-21
-- Description: Facebook sharing URLs with tracking params can exceed 512 chars

ALTER TABLE scheduled_streams ALTER COLUMN facebook_live_url TYPE VARCHAR(2048);
