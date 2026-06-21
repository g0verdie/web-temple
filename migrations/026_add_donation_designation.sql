-- Migration: Donation designation / reason (backlog item 11)
-- Date: 2026-06-20
-- Description: Optional donor-supplied reason/fund for a donation. Plaintext (not
--              financial PII like the amount/email) so it stays queryable + exportable
--              for accounting.

ALTER TABLE donations ADD COLUMN IF NOT EXISTS designation TEXT;

COMMENT ON COLUMN donations.designation IS 'Optional donor-supplied reason/fund for the donation (item 11)';
