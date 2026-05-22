-- ============================================================================
-- CMP (Common Minimum Program) Targets Module
-- Created: 2026-01-02
-- Purpose: Track minimum activity targets per vertical for all chapters (national targets)
-- ============================================================================

-- ============================================================================
-- CMP TARGETS TABLE
-- Stores the minimum targets each chapter should achieve per vertical
-- ============================================================================

CREATE TABLE IF NOT EXISTS cmp_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target Definition
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  calendar_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  -- Target Metrics
  min_activities INTEGER NOT NULL DEFAULT 1 CHECK (min_activities >= 0),
  min_participants INTEGER NOT NULL DEFAULT 0 CHECK (min_participants >= 0),
  min_ec_participation INTEGER NOT NULL DEFAULT 0 CHECK (min_ec_participation >= 0),

  -- AAA Breakdown (optional targets per category)
  min_awareness_activities INTEGER DEFAULT 0 CHECK (min_awareness_activities >= 0),
  min_action_activities INTEGER DEFAULT 0 CHECK (min_action_activities >= 0),
  min_advocacy_activities INTEGER DEFAULT 0 CHECK (min_advocacy_activities >= 0),

  -- Scope: National or Chapter-specific
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  is_national_target BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: One target per vertical per calendar year per scope
  CONSTRAINT unique_cmp_target UNIQUE (vertical_id, calendar_year, chapter_id, is_national_target)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Query by vertical
CREATE INDEX IF NOT EXISTS idx_cmp_targets_vertical ON cmp_targets(vertical_id);

-- Query by calendar year
CREATE INDEX IF NOT EXISTS idx_cmp_targets_calendar_year ON cmp_targets(calendar_year);

-- Query by chapter
CREATE INDEX IF NOT EXISTS idx_cmp_targets_chapter ON cmp_targets(chapter_id) WHERE chapter_id IS NOT NULL;

-- Query national targets
CREATE INDEX IF NOT EXISTS idx_cmp_targets_national ON cmp_targets(is_national_target) WHERE is_national_target = true;

-- Composite for common lookups
CREATE INDEX IF NOT EXISTS idx_cmp_targets_lookup ON cmp_targets(vertical_id, calendar_year, is_national_target);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER cmp_targets_updated_at
  BEFORE UPDATE ON cmp_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cmp_targets ENABLE ROW LEVEL SECURITY;

-- Everyone can view national targets
CREATE POLICY "Anyone can view national CMP targets"
  ON cmp_targets
  FOR SELECT
  TO authenticated
  USING (is_national_target = true);

-- Members can view their chapter's targets
CREATE POLICY "Members can view chapter CMP targets"
  ON cmp_targets
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

-- Only admins and chairs can insert targets
CREATE POLICY "Admins can insert CMP targets"
  ON cmp_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
    )
  );

-- Only admins and chairs can update targets
CREATE POLICY "Admins can update CMP targets"
  ON cmp_targets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
    )
  );

-- Only admins can delete targets
CREATE POLICY "Admins can delete CMP targets"
  ON cmp_targets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 5
    )
  );

-- ============================================================================
-- VIEWS FOR PROGRESS TRACKING
-- ============================================================================

-- View: CMP Progress by Vertical
CREATE OR REPLACE VIEW cmp_progress AS
SELECT
  t.id AS target_id,
  t.vertical_id,
  v.name AS vertical_name,
  v.color AS vertical_color,
  t.calendar_year,
  t.chapter_id,
  c.name AS chapter_name,
  t.is_national_target,

  -- Targets
  t.min_activities,
  t.min_participants,
  t.min_ec_participation,
  t.min_awareness_activities,
  t.min_action_activities,
  t.min_advocacy_activities,

  -- Actuals (calculated from health_card_entries)
  COALESCE(h.actual_activities, 0) AS actual_activities,
  COALESCE(h.actual_participants, 0) AS actual_participants,
  COALESCE(h.actual_ec_participation, 0) AS actual_ec_participation,
  COALESCE(h.awareness_count, 0) AS awareness_count,
  COALESCE(h.action_count, 0) AS action_count,
  COALESCE(h.advocacy_count, 0) AS advocacy_count,

  -- Progress percentages
  CASE WHEN t.min_activities > 0
    THEN ROUND((COALESCE(h.actual_activities, 0)::NUMERIC / t.min_activities) * 100, 1)
    ELSE 100
  END AS activity_progress_pct,

  CASE WHEN t.min_participants > 0
    THEN ROUND((COALESCE(h.actual_participants, 0)::NUMERIC / t.min_participants) * 100, 1)
    ELSE 100
  END AS participant_progress_pct

FROM cmp_targets t
JOIN verticals v ON v.id = t.vertical_id
LEFT JOIN chapters c ON c.id = t.chapter_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS actual_activities,
    SUM(ec_members_count + non_ec_members_count) AS actual_participants,
    SUM(ec_members_count) AS actual_ec_participation,
    COUNT(*) FILTER (WHERE aaa_type = 'awareness') AS awareness_count,
    COUNT(*) FILTER (WHERE aaa_type = 'action') AS action_count,
    COUNT(*) FILTER (WHERE aaa_type = 'advocacy') AS advocacy_count
  FROM health_card_entries hce
  WHERE hce.vertical_id = t.vertical_id
    AND hce.calendar_year = t.calendar_year
    AND (t.is_national_target = true OR hce.chapter_id = t.chapter_id)
) h ON true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cmp_targets IS 'Common Minimum Program targets per vertical per calendar year';
COMMENT ON COLUMN cmp_targets.min_activities IS 'Minimum number of activities required';
COMMENT ON COLUMN cmp_targets.min_participants IS 'Minimum total participants required';
COMMENT ON COLUMN cmp_targets.min_ec_participation IS 'Minimum EC member participation required';
COMMENT ON COLUMN cmp_targets.is_national_target IS 'If true, applies to all chapters nationally';
COMMENT ON VIEW cmp_progress IS 'Progress towards CMP targets with actual vs target metrics';
