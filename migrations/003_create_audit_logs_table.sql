-- Migration: Create audit_logs table
-- Date: 2026-02-05
-- Description: Append-only audit log for security events and sensitive operations

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(255),
  description TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  encrypted_at_rest BOOLEAN DEFAULT true
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Enforce append-only behavior: prevent UPDATE and DELETE
-- Users table should have no UPDATE/DELETE permissions on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE ON TABLE audit_logs FROM PUBLIC;

-- Policy: Only INSERT allowed, no UPDATE or DELETE
CREATE POLICY audit_logs_insert_only ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY audit_logs_select_only ON audit_logs
  FOR SELECT USING (true);

-- Comment explaining append-only nature
COMMENT ON TABLE audit_logs IS 'Append-only audit log. No UPDATE or DELETE operations permitted except by superuser.';
