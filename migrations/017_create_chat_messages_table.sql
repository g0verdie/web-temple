-- Migration: Create chat_messages table for moderated live chat
-- Date: 2026-05-22
-- Description: Chat messages associated with scheduled streams

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  stream_id INTEGER NOT NULL REFERENCES scheduled_streams(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  display_name VARCHAR(50) NOT NULL,
  message_text VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient retrieval and filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_status ON chat_messages(stream_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at ASC);

-- Add comment explaining status values
COMMENT ON TABLE chat_messages IS 'Live chat messages for streams. Status values: "pending", "approved", "deleted".';
