-- ============================================================================
-- STRETCH GOALS
-- Ambitious targets beyond CMP minimums
-- ============================================================================

-- Stretch goals table
CREATE TABLE IF NOT EXISTS stretch_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  cmp_target_id UUID REFERENCES cmp_targets(id) ON DELETE CASCADE,
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  -- Stretch targets (multipliers or absolute values)
  stretch_activities INTEGER NOT NULL,
  stretch_participants INTEGER NOT NULL,
  stretch_ec_participation INTEGER NOT NULL,

  -- Optional AAA stretch targets
  stretch_awareness INTEGER,
  stretch_action INTEGER,
  stretch_advocacy INTEGER,

  -- Goal metadata
  name VARCHAR(255) NOT NULL DEFAULT 'Stretch Goal',
  description TEXT,
  reward_description TEXT, -- What happens if stretch is achieved

  -- Status
  is_achieved BOOLEAN DEFAULT false,
  achieved_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(vertical_id, chapter_id, fiscal_year)
);

-- Enable RLS
ALTER TABLE stretch_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "stretch_goals_select_authenticated"
  ON stretch_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "stretch_goals_insert_admin"
  ON stretch_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair')
    )
  );

CREATE POLICY "stretch_goals_update_admin"
  ON stretch_goals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair')
    )
  );

CREATE POLICY "stretch_goals_delete_admin"
  ON stretch_goals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stretch_goals_vertical ON stretch_goals(vertical_id);
CREATE INDEX IF NOT EXISTS idx_stretch_goals_chapter ON stretch_goals(chapter_id);
CREATE INDEX IF NOT EXISTS idx_stretch_goals_fiscal_year ON stretch_goals(fiscal_year);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_stretch_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stretch_goals_updated_at
  BEFORE UPDATE ON stretch_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_stretch_goals_updated_at();

-- View for stretch goal progress
CREATE OR REPLACE VIEW stretch_goal_progress AS
SELECT
  sg.id AS stretch_goal_id,
  sg.vertical_id,
  v.name AS vertical_name,
  v.color AS vertical_color,
  sg.chapter_id,
  c.name AS chapter_name,
  sg.fiscal_year,
  sg.name AS goal_name,
  sg.description,
  sg.reward_description,

  -- CMP Targets (baseline)
  COALESCE(ct.min_activities, 0) AS cmp_activities,
  COALESCE(ct.min_participants, 0) AS cmp_participants,
  COALESCE(ct.min_ec_participation, 0) AS cmp_ec_participation,

  -- Stretch Targets
  sg.stretch_activities,
  sg.stretch_participants,
  sg.stretch_ec_participation,
  sg.stretch_awareness,
  sg.stretch_action,
  sg.stretch_advocacy,

  -- Actuals (from health card)
  COALESCE(hc.actual_activities, 0) AS actual_activities,
  COALESCE(hc.actual_participants, 0) AS actual_participants,
  COALESCE(hc.actual_ec_participation, 0) AS actual_ec_participation,
  COALESCE(hc.awareness_count, 0) AS awareness_count,
  COALESCE(hc.action_count, 0) AS action_count,
  COALESCE(hc.advocacy_count, 0) AS advocacy_count,

  -- CMP Progress %
  CASE WHEN COALESCE(ct.min_activities, 0) > 0
    THEN ROUND((COALESCE(hc.actual_activities, 0)::numeric / ct.min_activities) * 100, 1)
    ELSE 0
  END AS cmp_progress_pct,

  -- Stretch Progress %
  CASE WHEN sg.stretch_activities > 0
    THEN ROUND((COALESCE(hc.actual_activities, 0)::numeric / sg.stretch_activities) * 100, 1)
    ELSE 0
  END AS stretch_progress_pct,

  -- Status
  sg.is_achieved,
  sg.achieved_at

FROM stretch_goals sg
JOIN verticals v ON sg.vertical_id = v.id
LEFT JOIN chapters c ON sg.chapter_id = c.id
LEFT JOIN cmp_targets ct ON sg.cmp_target_id = ct.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS actual_activities,
    SUM(COALESCE(he.ec_count, 0) + COALESCE(he.external_count, 0)) AS actual_participants,
    SUM(COALESCE(he.ec_count, 0)) AS actual_ec_participation,
    COUNT(*) FILTER (WHERE he.aaa_classification = 'awareness') AS awareness_count,
    COUNT(*) FILTER (WHERE he.aaa_classification = 'action') AS action_count,
    COUNT(*) FILTER (WHERE he.aaa_classification = 'advocacy') AS advocacy_count
  FROM health_card_entries he
  WHERE he.vertical_id = sg.vertical_id
    AND (sg.chapter_id IS NULL OR he.chapter_id = sg.chapter_id)
    AND EXTRACT(YEAR FROM he.activity_date) = sg.fiscal_year
) hc ON true;

-- Grant access to the view
GRANT SELECT ON stretch_goal_progress TO authenticated;
