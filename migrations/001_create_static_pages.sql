-- Migration: Create static_pages and static_page_versions tables
-- Date: 2026-02-04
-- Description: Tables for managing static content like About, Contact, Policies pages with version control

-- Create static_pages table
CREATE TABLE IF NOT EXISTS static_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  
  -- Indexes for common queries
  CONSTRAINT fk_static_pages_created_by FOREIGN KEY (created_by) 
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_static_pages_updated_by FOREIGN KEY (updated_by) 
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_static_pages_slug ON static_pages(slug);
CREATE INDEX idx_static_pages_published ON static_pages(published);
CREATE INDEX idx_static_pages_updated_at ON static_pages(updated_at DESC);

-- Create static_page_versions table for version history
CREATE TABLE IF NOT EXISTS static_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_page_id UUID NOT NULL REFERENCES static_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  
  -- Composite unique constraint to ensure one version per page
  CONSTRAINT uk_static_page_versions UNIQUE(static_page_id, version_number),
  CONSTRAINT fk_static_page_versions_created_by FOREIGN KEY (created_by) 
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_static_page_versions_page_id ON static_page_versions(static_page_id);
CREATE INDEX idx_static_page_versions_created_at ON static_page_versions(created_at DESC);

-- Insert initial About page (draft)
INSERT INTO static_pages (slug, title, content, published, created_by, updated_by)
VALUES (
  'about',
  'About the Temple',
  '<h2>Welcome to Temple B''nai Israel</h2><p>Temple B''nai Israel is a vibrant and inclusive Jewish community dedicated to preserving Jewish tradition while embracing contemporary values.</p><h3>Our Mission</h3><p>To foster spiritual growth, community connection, and social justice through Jewish education, meaningful worship, and service to our community.</p>',
  FALSE,
  NULL,
  NULL
) ON CONFLICT (slug) DO NOTHING;

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_static_pages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER static_pages_update_timestamp
BEFORE UPDATE ON static_pages
FOR EACH ROW
EXECUTE FUNCTION update_static_pages_timestamp();
