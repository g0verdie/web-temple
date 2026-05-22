-- Migration: Create scheduled_streams table for live stream scheduling
-- Date: 2026-05-21
-- Description: Scheduled streams metadata store

CREATE TABLE IF NOT EXISTS scheduled_streams (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  facebook_live_url VARCHAR(2048) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  event_id INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_scheduled_streams_status ON scheduled_streams(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_streams_scheduled_start ON scheduled_streams(scheduled_start DESC);

-- Comment about status values
COMMENT ON TABLE scheduled_streams IS 'Metadata store for scheduled, active, canceled, and completed Facebook Live streams. Status values: "scheduled", "active", "canceled", "completed".';
