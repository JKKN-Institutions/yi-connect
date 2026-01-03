-- ============================================================================
-- Health Card Activity Reporting Module
-- Created: 2026-01-02
-- Purpose: Track activities completed by verticals with participation counts
-- Note: Each vertical may have different form fields (stored in vertical_specific_data)
-- ============================================================================

-- Create submitter_role enum
CREATE TYPE submitter_role AS ENUM (
  'chapter_em',
  'chair',
  'co_chair',
  'vertical_head',
  'member'
);

-- Create yi_region enum
CREATE TYPE yi_region AS ENUM (
  'east_region',
  'jksn',
  'north_region',
  'south_region',
  'srtn',
  'west_region'
);

-- Create aaa_type enum (Awareness, Action, Advocacy framework)
CREATE TYPE aaa_type AS ENUM (
  'awareness',
  'action',
  'advocacy'
);

-- ============================================================================
-- HEALTH CARD ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_card_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Submitter Info
  submitter_name VARCHAR(255) NOT NULL,
  submitter_role submitter_role NOT NULL,
  email VARCHAR(255) NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,

  -- Activity Info
  activity_date DATE NOT NULL,
  activity_name VARCHAR(500) NOT NULL,
  activity_description TEXT,
  aaa_type aaa_type, -- Optional: Awareness, Action, or Advocacy classification

  -- Chapter/Region
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  region yi_region NOT NULL,

  -- Participation Counts
  ec_members_count INTEGER NOT NULL DEFAULT 0 CHECK (ec_members_count >= 0),
  non_ec_members_count INTEGER NOT NULL DEFAULT 0 CHECK (non_ec_members_count >= 0),

  -- Vertical Link
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,

  -- Vertical-specific data (flexible JSONB for different forms per vertical)
  vertical_specific_data JSONB,

  -- Metadata
  calendar_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Query by chapter
CREATE INDEX IF NOT EXISTS idx_health_card_chapter ON health_card_entries(chapter_id);

-- Query by vertical
CREATE INDEX IF NOT EXISTS idx_health_card_vertical ON health_card_entries(vertical_id);

-- Query by region
CREATE INDEX IF NOT EXISTS idx_health_card_region ON health_card_entries(region);

-- Query by date range
CREATE INDEX IF NOT EXISTS idx_health_card_date ON health_card_entries(activity_date);

-- Query by calendar year
CREATE INDEX IF NOT EXISTS idx_health_card_calendar_year ON health_card_entries(calendar_year);

-- Composite for common queries (chapter + vertical + calendar_year)
CREATE INDEX IF NOT EXISTS idx_health_card_composite ON health_card_entries(chapter_id, vertical_id, calendar_year);

-- Query by AAA type
CREATE INDEX IF NOT EXISTS idx_health_card_aaa_type ON health_card_entries(aaa_type) WHERE aaa_type IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER health_card_entries_updated_at
  BEFORE UPDATE ON health_card_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE health_card_entries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view entries for their chapter
CREATE POLICY "Members can view chapter health cards"
  ON health_card_entries
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to insert entries for their chapter
CREATE POLICY "Members can submit health cards"
  ON health_card_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

-- Allow users to update their own entries (if member_id matches)
CREATE POLICY "Users can update own health cards"
  ON health_card_entries
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE id = auth.uid()
    )
  );

-- Allow chairs (hierarchy_level >= 4) to delete entries
CREATE POLICY "Chairs can delete health cards"
  ON health_card_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON ur.user_id = m.id
      JOIN roles r ON r.id = ur.role_id
      WHERE m.id = auth.uid()
        AND m.chapter_id = health_card_entries.chapter_id
        AND r.hierarchy_level >= 4
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE health_card_entries IS 'Activity reports from verticals tracking EC/Non-EC participation';
COMMENT ON COLUMN health_card_entries.submitter_role IS 'Role of person submitting: EM, Chair, Co-Chair, Vertical Head, Member';
COMMENT ON COLUMN health_card_entries.region IS 'Yi region: East, JKSN, North, South, SRTN, West';
COMMENT ON COLUMN health_card_entries.ec_members_count IS 'Number of EC (Executive Committee) members who participated';
COMMENT ON COLUMN health_card_entries.non_ec_members_count IS 'Number of non-EC members who participated';
COMMENT ON COLUMN health_card_entries.vertical_specific_data IS 'JSONB for vertical-specific form fields (varies by vertical)';
COMMENT ON COLUMN health_card_entries.calendar_year IS 'Calendar year of the activity';
COMMENT ON COLUMN health_card_entries.aaa_type IS 'Optional AAA Framework classification: awareness, action, or advocacy';
