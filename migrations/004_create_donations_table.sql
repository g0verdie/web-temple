-- Migration: Create donations table with encryption
-- Date: 2026-02-05
-- Description: Donations table with encrypted sensitive fields

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  encrypted_amount_cents TEXT NOT NULL,  -- Application-level encryption (amount_cents removed for security)
  encrypted_donor_email TEXT,             -- Application-level encryption (for anonymous donors)
  currency VARCHAR(3) DEFAULT 'USD',
  donation_type VARCHAR(50) NOT NULL,     -- 'one-time' or 'recurring'
  recurring_frequency VARCHAR(50),        -- 'monthly', 'quarterly', 'annually'
  is_anonymous BOOLEAN DEFAULT false,
  payment_method VARCHAR(50),             -- 'paypal', 'venmo', 'zelle', etc.
  payment_id VARCHAR(255),                -- PayPal transaction ID
  tax_receipt_sent BOOLEAN DEFAULT false,
  tax_receipt_email TEXT,
  status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_payment_id ON donations(payment_id);

-- Add comment about encryption
COMMENT ON COLUMN donations.encrypted_amount_cents IS 'AES-256-CBC encrypted donation amount (for PCI compliance and security)';
COMMENT ON COLUMN donations.encrypted_donor_email IS 'AES-256-CBC encrypted email for anonymous donors';
