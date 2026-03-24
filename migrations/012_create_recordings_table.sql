-- Migration: Create recordings table for published service recordings
-- Date: 2026-03-23
-- Description: Canonical recording metadata store with publish state transitions

CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(50) NOT NULL,
  provider_recording_id VARCHAR(255) NOT NULL,
  provider_video_url TEXT,
  preview_url TEXT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  service_date TIMESTAMP,
  torah_portion VARCHAR(100),
  duration_seconds INTEGER,
  publish_state VARCHAR(50) DEFAULT 'unpublished',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider_name, provider_recording_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_recordings_publish_state ON recordings(publish_state);
CREATE INDEX IF NOT EXISTS idx_recordings_service_date ON recordings(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_published_at ON recordings(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_provider ON recordings(provider_name, provider_recording_id);

-- Add comment about the publish_state values
COMMENT ON TABLE recordings IS 'Canonical recording metadata store with explicit publish state transitions. Values for publish_state: "unpublished" (draft stage), "published" (visible to members and archive)';
