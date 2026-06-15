-- Migration: Add service type and indexing for archive search
-- Date: 2026-03-24
-- Description: Adds service_type column and indexing for common archive filters

ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS service_type VARCHAR(50);

-- Update existing records logically (e.g. if title contains Shabbat) just for safety, or leave null
UPDATE recordings SET service_type = 'Shabbat' WHERE title ILIKE '%Shabbat%';

-- Add critical indexes for archive query performance
CREATE INDEX IF NOT EXISTS idx_recordings_service_date ON recordings(service_date);
CREATE INDEX IF NOT EXISTS idx_recordings_service_type ON recordings(service_type);
CREATE INDEX IF NOT EXISTS idx_recordings_torah_portion ON recordings(torah_portion);
