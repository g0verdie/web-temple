-- Add login tracking columns to users table
ALTER TABLE users 
ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN lockout_until TIMESTAMP WITH TIME ZONE;
