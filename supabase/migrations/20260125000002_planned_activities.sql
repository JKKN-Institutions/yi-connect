-- ============================================================================
-- Activity Planner Module
-- Created: 2026-01-25
-- Purpose: Allow EC members to plan activities upfront before reporting them
-- Flow: Plan Activity -> Collect Data -> Complete as Health Card Entry
-- ============================================================================

-- Create planned_activity_status enum
CREATE TYPE planned_activity_status AS ENUM (
  'planned',      -- Initial state: activity is planned for future
  'in_progress',  -- Activity is currently happening
  'completed',    -- Activity completed and linked to health card entry
  'cancelled'     -- Activity was cancelled
);

-- ============================================================================
-- PLANNED ACTIVITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS planned_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Activity Info
  activity_name VARCHAR(500) NOT NULL,
  activity_description TEXT,
  planned_date DATE NOT NULL,

  -- Vertical Link
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,

  -- Expected Participation (estimates at planning time)
  expected_ec_count INTEGER NOT NULL DEFAULT 0 CHECK (expected_ec_count >= 0),
  expected_non_ec_count INTEGER NOT NULL DEFAULT 0 CHECK (expected_non_ec_count >= 0),

  -- Ownership
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Status & Conversion
  status planned_activity_status NOT NULL DEFAULT 'planned',
  health_card_entry_id UUID REFERENCES health_card_entries(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  -- Optional preparation notes
  preparation_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Query by chapter
CREATE INDEX IF NOT EXISTS idx_planned_activities_chapter
  ON planned_activities(chapter_id);

-- Query by vertical
CREATE INDEX IF NOT EXISTS idx_planned_activities_vertical
  ON planned_activities(vertical_id);

-- Query by status
CREATE INDEX IF NOT EXISTS idx_planned_activities_status
  ON planned_activities(status);

-- Query by creator
CREATE INDEX IF NOT EXISTS idx_planned_activities_created_by
  ON planned_activities(created_by);

-- Query by planned date
CREATE INDEX IF NOT EXISTS idx_planned_activities_date
  ON planned_activities(planned_date);

-- Composite for listing (chapter + status + date)
CREATE INDEX IF NOT EXISTS idx_planned_activities_composite
  ON planned_activities(chapter_id, status, planned_date DESC);

-- Link to health card entry
CREATE INDEX IF NOT EXISTS idx_planned_activities_health_card
  ON planned_activities(health_card_entry_id)
  WHERE health_card_entry_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER planned_activities_updated_at
  BEFORE UPDATE ON planned_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE planned_activities ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view planned activities for their chapter
CREATE POLICY "Members can view chapter planned activities"
  ON planned_activities
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to insert planned activities for their chapter
CREATE POLICY "Members can create planned activities"
  ON planned_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Allow users to update their own planned activities
CREATE POLICY "Users can update own planned activities"
  ON planned_activities
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
  );

-- Also allow chairs (hierarchy_level >= 4) to update any planned activity in their chapter
CREATE POLICY "Chairs can update chapter planned activities"
  ON planned_activities
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON ur.user_id = m.id
      JOIN roles r ON r.id = ur.role_id
      WHERE m.id = auth.uid()
        AND m.chapter_id = planned_activities.chapter_id
        AND r.hierarchy_level >= 4
    )
  );

-- Allow users to delete their own planned activities (only if not completed)
CREATE POLICY "Users can delete own planned activities"
  ON planned_activities
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND status != 'completed'
  );

-- Allow chairs (hierarchy_level >= 4) to delete any planned activity in their chapter
CREATE POLICY "Chairs can delete chapter planned activities"
  ON planned_activities
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON ur.user_id = m.id
      JOIN roles r ON r.id = ur.role_id
      WHERE m.id = auth.uid()
        AND m.chapter_id = planned_activities.chapter_id
        AND r.hierarchy_level >= 4
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE planned_activities IS 'Activities planned by EC members before reporting to health card';
COMMENT ON COLUMN planned_activities.activity_name IS 'Name of the planned activity';
COMMENT ON COLUMN planned_activities.planned_date IS 'When the activity is planned to occur';
COMMENT ON COLUMN planned_activities.expected_ec_count IS 'Expected number of EC members to participate';
COMMENT ON COLUMN planned_activities.expected_non_ec_count IS 'Expected number of non-EC members to participate';
COMMENT ON COLUMN planned_activities.status IS 'Current status: planned, in_progress, completed, cancelled';
COMMENT ON COLUMN planned_activities.health_card_entry_id IS 'Link to health card entry when activity is completed';
COMMENT ON COLUMN planned_activities.converted_at IS 'When the activity was converted to a health card entry';
COMMENT ON COLUMN planned_activities.preparation_notes IS 'Notes for preparing the activity';
