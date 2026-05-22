-- ============================================================================
-- Yi Connect Phase E — AAA Pathfinder Extensions
-- ============================================================================
-- Ported from public schema migrations (2026-01-02 through 2026-04-18):
--   #2  20260102000002_aaa_depth_metrics.sql       — ALTER aaa_plans depth metrics
--   #3  20260102000003_health_card_entries.sql     — enums + table
--   #4  20260102000004_cmp_targets.sql             — cmp_targets + cmp_progress view
--   #5  20260102000005_stretch_goals.sql           — stretch_goals + stretch_goal_progress view
--   #6  20260102000006_activity_templates.sql      — activity_templates + seed
--   #7  20260104000001_aaa_stretch_goals.sql       — ALTER aaa_plans stretch columns
--   #8  20260105000001_fix_readiness_score.sql     — CREATE OR REPLACE calculate_leadership_readiness
--   #9  20260125000002_planned_activities.sql      — enum + planned_activities table
--   #10 20260418000001_rename_aaa_plans_fiscal_year.sql — RENAME fiscal_year → calendar_year
--
-- Migration #1 (aaa_pathfinder_module.sql) was already ported in Phase A as
-- part of 20260522000019_yi_connect_batch10.sql (base aaa_plans, commitment_cards,
-- mentor_assignments tables). This migration extends those tables and adds the
-- supporting AAA modules.
-- ============================================================================

SET search_path TO yi_connect, public, extensions;

-- ============================================================================
-- MIGRATION #2 — AAA Depth Metrics (idempotent ALTER COLUMNs)
-- ============================================================================

ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_1_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_1_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_1_impact_measures TEXT;

ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_2_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_2_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_2_impact_measures TEXT;

ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_3_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_3_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_3_impact_measures TEXT;

ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_1_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_1_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_1_impact_measures TEXT;

ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_2_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_2_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_2_impact_measures TEXT;

COMMENT ON COLUMN aaa_plans.awareness_1_target_attendance IS 'Expected number of attendees';
COMMENT ON COLUMN aaa_plans.awareness_1_engagement_goal IS 'How attendees will engage (participate, learn, commit)';
COMMENT ON COLUMN aaa_plans.awareness_1_impact_measures IS 'How to measure success (surveys, pledges, follow-ups)';

-- ============================================================================
-- MIGRATION #3 — Health Card Entries (enums + table)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE submitter_role AS ENUM (
    'chapter_em',
    'chair',
    'co_chair',
    'vertical_head',
    'member'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE yi_region AS ENUM (
    'east_region',
    'jksn',
    'north_region',
    'south_region',
    'srtn',
    'west_region'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE aaa_type AS ENUM (
    'awareness',
    'action',
    'advocacy'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

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
  aaa_type aaa_type,

  -- Chapter/Region
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  region yi_region NOT NULL,

  -- Participation Counts
  ec_members_count INTEGER NOT NULL DEFAULT 0 CHECK (ec_members_count >= 0),
  non_ec_members_count INTEGER NOT NULL DEFAULT 0 CHECK (non_ec_members_count >= 0),

  -- Vertical Link
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,

  -- Vertical-specific data (flexible JSONB)
  vertical_specific_data JSONB,

  -- Metadata
  calendar_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_card_chapter ON health_card_entries(chapter_id);
CREATE INDEX IF NOT EXISTS idx_health_card_vertical ON health_card_entries(vertical_id);
CREATE INDEX IF NOT EXISTS idx_health_card_region ON health_card_entries(region);
CREATE INDEX IF NOT EXISTS idx_health_card_date ON health_card_entries(activity_date);
CREATE INDEX IF NOT EXISTS idx_health_card_calendar_year ON health_card_entries(calendar_year);
CREATE INDEX IF NOT EXISTS idx_health_card_composite ON health_card_entries(chapter_id, vertical_id, calendar_year);
CREATE INDEX IF NOT EXISTS idx_health_card_aaa_type ON health_card_entries(aaa_type) WHERE aaa_type IS NOT NULL;

DROP TRIGGER IF EXISTS health_card_entries_updated_at ON health_card_entries;
CREATE TRIGGER health_card_entries_updated_at
  BEFORE UPDATE ON health_card_entries
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

ALTER TABLE health_card_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view chapter health cards" ON health_card_entries;
CREATE POLICY "Members can view chapter health cards"
  ON health_card_entries
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can submit health cards" ON health_card_entries;
CREATE POLICY "Members can submit health cards"
  ON health_card_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own health cards" ON health_card_entries;
CREATE POLICY "Users can update own health cards"
  ON health_card_entries
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Chairs can delete health cards" ON health_card_entries;
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

COMMENT ON TABLE health_card_entries IS 'Activity reports from verticals tracking EC/Non-EC participation';

-- ============================================================================
-- MIGRATION #4 — CMP Targets + cmp_progress view
-- ============================================================================

CREATE TABLE IF NOT EXISTS cmp_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  calendar_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  min_activities INTEGER NOT NULL DEFAULT 1 CHECK (min_activities >= 0),
  min_participants INTEGER NOT NULL DEFAULT 0 CHECK (min_participants >= 0),
  min_ec_participation INTEGER NOT NULL DEFAULT 0 CHECK (min_ec_participation >= 0),

  min_awareness_activities INTEGER DEFAULT 0 CHECK (min_awareness_activities >= 0),
  min_action_activities INTEGER DEFAULT 0 CHECK (min_action_activities >= 0),
  min_advocacy_activities INTEGER DEFAULT 0 CHECK (min_advocacy_activities >= 0),

  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,
  is_national_target BOOLEAN NOT NULL DEFAULT false,

  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_cmp_target UNIQUE (vertical_id, calendar_year, chapter_id, is_national_target)
);

CREATE INDEX IF NOT EXISTS idx_cmp_targets_vertical ON cmp_targets(vertical_id);
CREATE INDEX IF NOT EXISTS idx_cmp_targets_calendar_year ON cmp_targets(calendar_year);
CREATE INDEX IF NOT EXISTS idx_cmp_targets_chapter ON cmp_targets(chapter_id) WHERE chapter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cmp_targets_national ON cmp_targets(is_national_target) WHERE is_national_target = true;
CREATE INDEX IF NOT EXISTS idx_cmp_targets_lookup ON cmp_targets(vertical_id, calendar_year, is_national_target);

DROP TRIGGER IF EXISTS cmp_targets_updated_at ON cmp_targets;
CREATE TRIGGER cmp_targets_updated_at
  BEFORE UPDATE ON cmp_targets
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

ALTER TABLE cmp_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view national CMP targets" ON cmp_targets;
CREATE POLICY "Anyone can view national CMP targets"
  ON cmp_targets
  FOR SELECT
  TO authenticated
  USING (is_national_target = true);

DROP POLICY IF EXISTS "Members can view chapter CMP targets" ON cmp_targets;
CREATE POLICY "Members can view chapter CMP targets"
  ON cmp_targets
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert CMP targets" ON cmp_targets;
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

DROP POLICY IF EXISTS "Admins can update CMP targets" ON cmp_targets;
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

DROP POLICY IF EXISTS "Admins can delete CMP targets" ON cmp_targets;
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

  t.min_activities,
  t.min_participants,
  t.min_ec_participation,
  t.min_awareness_activities,
  t.min_action_activities,
  t.min_advocacy_activities,

  COALESCE(h.actual_activities, 0) AS actual_activities,
  COALESCE(h.actual_participants, 0) AS actual_participants,
  COALESCE(h.actual_ec_participation, 0) AS actual_ec_participation,
  COALESCE(h.awareness_count, 0) AS awareness_count,
  COALESCE(h.action_count, 0) AS action_count,
  COALESCE(h.advocacy_count, 0) AS advocacy_count,

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
LEFT JOIN yi.chapters c ON c.id = t.chapter_id
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

COMMENT ON TABLE cmp_targets IS 'Common Minimum Program targets per vertical per calendar year';
COMMENT ON VIEW cmp_progress IS 'Progress towards CMP targets with actual vs target metrics';

-- ============================================================================
-- MIGRATION #5 — Stretch Goals + stretch_goal_progress view
-- ============================================================================

CREATE TABLE IF NOT EXISTS stretch_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cmp_target_id UUID REFERENCES cmp_targets(id) ON DELETE CASCADE,
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE SET NULL,
  calendar_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  stretch_activities INTEGER NOT NULL,
  stretch_participants INTEGER NOT NULL,
  stretch_ec_participation INTEGER NOT NULL,

  stretch_awareness INTEGER,
  stretch_action INTEGER,
  stretch_advocacy INTEGER,

  name VARCHAR(255) NOT NULL DEFAULT 'Stretch Goal',
  description TEXT,
  reward_description TEXT,

  is_achieved BOOLEAN DEFAULT false,
  achieved_at TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vertical_id, chapter_id, calendar_year)
);

ALTER TABLE stretch_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stretch_goals_select_authenticated" ON stretch_goals;
CREATE POLICY "stretch_goals_select_authenticated"
  ON stretch_goals FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "stretch_goals_insert_admin" ON stretch_goals;
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

DROP POLICY IF EXISTS "stretch_goals_update_admin" ON stretch_goals;
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

DROP POLICY IF EXISTS "stretch_goals_delete_admin" ON stretch_goals;
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

CREATE INDEX IF NOT EXISTS idx_stretch_goals_vertical ON stretch_goals(vertical_id);
CREATE INDEX IF NOT EXISTS idx_stretch_goals_chapter ON stretch_goals(chapter_id);
CREATE INDEX IF NOT EXISTS idx_stretch_goals_calendar_year ON stretch_goals(calendar_year);

DROP TRIGGER IF EXISTS stretch_goals_updated_at ON stretch_goals;
CREATE TRIGGER stretch_goals_updated_at
  BEFORE UPDATE ON stretch_goals
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE OR REPLACE VIEW stretch_goal_progress AS
SELECT
  sg.id AS stretch_goal_id,
  sg.vertical_id,
  v.name AS vertical_name,
  v.color AS vertical_color,
  sg.chapter_id,
  c.name AS chapter_name,
  sg.calendar_year,
  sg.name AS goal_name,
  sg.description,
  sg.reward_description,

  COALESCE(ct.min_activities, 0) AS cmp_activities,
  COALESCE(ct.min_participants, 0) AS cmp_participants,
  COALESCE(ct.min_ec_participation, 0) AS cmp_ec_participation,

  sg.stretch_activities,
  sg.stretch_participants,
  sg.stretch_ec_participation,
  sg.stretch_awareness,
  sg.stretch_action,
  sg.stretch_advocacy,

  COALESCE(hc.actual_activities, 0) AS actual_activities,
  COALESCE(hc.actual_participants, 0) AS actual_participants,
  COALESCE(hc.actual_ec_participation, 0) AS actual_ec_participation,
  COALESCE(hc.awareness_count, 0) AS awareness_count,
  COALESCE(hc.action_count, 0) AS action_count,
  COALESCE(hc.advocacy_count, 0) AS advocacy_count,

  CASE WHEN COALESCE(ct.min_activities, 0) > 0
    THEN ROUND((COALESCE(hc.actual_activities, 0)::numeric / ct.min_activities) * 100, 1)
    ELSE 0
  END AS cmp_progress_pct,

  CASE WHEN sg.stretch_activities > 0
    THEN ROUND((COALESCE(hc.actual_activities, 0)::numeric / sg.stretch_activities) * 100, 1)
    ELSE 0
  END AS stretch_progress_pct,

  sg.is_achieved,
  sg.achieved_at

FROM stretch_goals sg
JOIN verticals v ON sg.vertical_id = v.id
LEFT JOIN yi.chapters c ON sg.chapter_id = c.id
LEFT JOIN cmp_targets ct ON sg.cmp_target_id = ct.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS actual_activities,
    SUM(COALESCE(he.ec_members_count, 0) + COALESCE(he.non_ec_members_count, 0)) AS actual_participants,
    SUM(COALESCE(he.ec_members_count, 0)) AS actual_ec_participation,
    COUNT(*) FILTER (WHERE he.aaa_type = 'awareness') AS awareness_count,
    COUNT(*) FILTER (WHERE he.aaa_type = 'action') AS action_count,
    COUNT(*) FILTER (WHERE he.aaa_type = 'advocacy') AS advocacy_count
  FROM health_card_entries he
  WHERE he.vertical_id = sg.vertical_id
    AND (sg.chapter_id IS NULL OR he.chapter_id = sg.chapter_id)
    AND he.calendar_year = sg.calendar_year
) hc ON true;

GRANT SELECT ON stretch_goal_progress TO authenticated;

-- ============================================================================
-- MIGRATION #6 — Activity Templates + seed data
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL,

  default_title VARCHAR(255),
  default_activity_type VARCHAR(100),
  default_aaa_classification VARCHAR(50) CHECK (default_aaa_classification IN ('awareness', 'action', 'advocacy')),
  default_target_audience VARCHAR(255),
  default_duration_hours DECIMAL(4,1),

  expected_participants INTEGER,
  expected_ec_count INTEGER,

  icon VARCHAR(50),
  color VARCHAR(7),
  tags TEXT[],

  is_national BOOLEAN DEFAULT true,
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,

  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_templates_select_authenticated" ON activity_templates;
CREATE POLICY "activity_templates_select_authenticated"
  ON activity_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "activity_templates_insert_admin" ON activity_templates;
CREATE POLICY "activity_templates_insert_admin"
  ON activity_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair')
    )
  );

DROP POLICY IF EXISTS "activity_templates_update_admin" ON activity_templates;
CREATE POLICY "activity_templates_update_admin"
  ON activity_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair')
    )
  );

DROP POLICY IF EXISTS "activity_templates_delete_admin" ON activity_templates;
CREATE POLICY "activity_templates_delete_admin"
  ON activity_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair')
    )
  );

CREATE INDEX IF NOT EXISTS idx_activity_templates_vertical ON activity_templates(vertical_id);
CREATE INDEX IF NOT EXISTS idx_activity_templates_active ON activity_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_activity_templates_national ON activity_templates(is_national);
CREATE INDEX IF NOT EXISTS idx_activity_templates_tags ON activity_templates USING GIN(tags);

DROP TRIGGER IF EXISTS activity_templates_updated_at ON activity_templates;
CREATE TRIGGER activity_templates_updated_at
  BEFORE UPDATE ON activity_templates
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE OR REPLACE FUNCTION yi_connect.increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE activity_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = yi_connect, public;

GRANT EXECUTE ON FUNCTION yi_connect.increment_template_usage TO authenticated;

-- Seed default Yi activity templates
INSERT INTO activity_templates (
  name, description, default_aaa_classification, default_activity_type,
  expected_participants, expected_ec_count, icon, tags, is_national
) VALUES
  ('MASOOM Workshop', 'Child safety awareness session in schools', 'awareness', 'Workshop',
   100, 5, 'Shield', ARRAY['masoom', 'child-safety', 'school'], true),
  ('MASOOM Teacher Training', 'Training teachers on child protection', 'action', 'Training',
   30, 3, 'GraduationCap', ARRAY['masoom', 'training', 'teachers'], true),
  ('MASOOM Policy Advocacy', 'Meeting with officials for child safety policies', 'advocacy', 'Meeting',
   10, 4, 'Landmark', ARRAY['masoom', 'policy', 'advocacy'], true),
  ('Tree Plantation Drive', 'Community tree planting activity', 'action', 'Drive',
   50, 10, 'TreePine', ARRAY['climate', 'trees', 'environment'], true),
  ('Climate Awareness Session', 'Session on climate change and sustainability', 'awareness', 'Session',
   80, 5, 'Leaf', ARRAY['climate', 'awareness', 'sustainability'], true),
  ('Clean Energy Workshop', 'Workshop on solar and renewable energy', 'awareness', 'Workshop',
   40, 5, 'Zap', ARRAY['climate', 'renewable', 'energy'], true),
  ('Road Safety Awareness', 'Traffic rules and safety awareness session', 'awareness', 'Session',
   100, 5, 'Car', ARRAY['road-safety', 'traffic', 'awareness'], true),
  ('Helmet Distribution', 'Distributing helmets to two-wheeler riders', 'action', 'Distribution',
   50, 8, 'HardHat', ARRAY['road-safety', 'helmet', 'distribution'], true),
  ('Health Camp', 'Free health checkup camp', 'action', 'Camp',
   200, 10, 'Heart', ARRAY['health', 'camp', 'checkup'], true),
  ('Blood Donation Drive', 'Blood donation camp for the community', 'action', 'Drive',
   100, 15, 'Droplet', ARRAY['health', 'blood-donation', 'drive'], true),
  ('Mental Health Workshop', 'Awareness session on mental health', 'awareness', 'Workshop',
   50, 5, 'Brain', ARRAY['health', 'mental-health', 'workshop'], true),
  ('Yuva Leadership Session', 'Leadership development for college students', 'awareness', 'Session',
   60, 5, 'Users', ARRAY['yuva', 'leadership', 'students'], true),
  ('Thalir School Visit', 'Engaging school students in nation building', 'awareness', 'Visit',
   100, 5, 'School', ARRAY['thalir', 'school', 'students'], true),
  ('Skill Development Workshop', 'Practical skills training for youth', 'action', 'Workshop',
   40, 5, 'Wrench', ARRAY['yuva', 'skills', 'training'], true),
  ('Community Service', 'General community service activity', 'action', 'Service',
   30, 8, 'HeartHandshake', ARRAY['community', 'service', 'general'], true),
  ('Guest Speaker Session', 'Session with industry/thought leader', 'awareness', 'Session',
   80, 10, 'Mic', ARRAY['speaker', 'session', 'learning'], true),
  ('Industry Visit', 'Visit to local industry/factory', 'awareness', 'Visit',
   25, 5, 'Factory', ARRAY['industry', 'visit', 'learning'], true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION #7 — AAA Stretch Goals (idempotent ALTERs on aaa_plans)
-- ============================================================================

ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS has_stretch_awareness BOOLEAN DEFAULT false;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS has_stretch_action BOOLEAN DEFAULT false;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS has_stretch_advocacy BOOLEAN DEFAULT false;

-- Awareness 4 (Optional Stretch)
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_title VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_description TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_audience VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_target_date DATE;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_4_status IS NULL OR awareness_4_status IN ('planned', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_impact_measures TEXT;

-- Action 3 (Optional Stretch)
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_title VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_description TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_target VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_target_date DATE;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_status VARCHAR(20) DEFAULT 'planned' CHECK (action_3_status IS NULL OR action_3_status IN ('planned', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_impact_measures TEXT;

-- Advocacy 2 (Optional Stretch)
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_target_contact VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_approach TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_status VARCHAR(20) DEFAULT 'planned' CHECK (advocacy_2_status IS NULL OR advocacy_2_status IN ('planned', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_outcome TEXT;

COMMENT ON COLUMN aaa_plans.has_stretch_awareness IS 'Flag indicating if vertical has added a 4th awareness session';
COMMENT ON COLUMN aaa_plans.has_stretch_action IS 'Flag indicating if vertical has added a 3rd action event';
COMMENT ON COLUMN aaa_plans.has_stretch_advocacy IS 'Flag indicating if vertical has added a 2nd advocacy goal';

-- Update the get_aaa_completion function to include stretch goals
CREATE OR REPLACE FUNCTION yi_connect.get_aaa_completion(plan_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  base_items INT := 6;
  stretch_items INT := 0;
  total_items INT;
  completed_items INT := 0;
  plan_record RECORD;
BEGIN
  SELECT * INTO plan_record FROM yi_connect.aaa_plans WHERE id = plan_id;

  IF plan_record IS NULL THEN
    RETURN 0;
  END IF;

  IF plan_record.has_stretch_awareness THEN stretch_items := stretch_items + 1; END IF;
  IF plan_record.has_stretch_action THEN stretch_items := stretch_items + 1; END IF;
  IF plan_record.has_stretch_advocacy THEN stretch_items := stretch_items + 1; END IF;

  total_items := base_items + stretch_items;

  IF plan_record.awareness_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_3_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.advocacy_status = 'completed' THEN completed_items := completed_items + 1; END IF;

  IF plan_record.has_stretch_awareness AND plan_record.awareness_4_status = 'completed' THEN
    completed_items := completed_items + 1;
  END IF;
  IF plan_record.has_stretch_action AND plan_record.action_3_status = 'completed' THEN
    completed_items := completed_items + 1;
  END IF;
  IF plan_record.has_stretch_advocacy AND plan_record.advocacy_2_status = 'completed' THEN
    completed_items := completed_items + 1;
  END IF;

  RETURN ROUND((completed_items::NUMERIC / total_items) * 100, 1);
END;
$$ LANGUAGE plpgsql
SET search_path = yi_connect, public;

COMMENT ON FUNCTION yi_connect.get_aaa_completion IS 'Calculate AAA plan completion percentage (0-100), including stretch goals if enabled';

-- ============================================================================
-- MIGRATION #8 — Fix Leadership Readiness Score
-- ============================================================================

CREATE OR REPLACE FUNCTION yi_connect.calculate_leadership_readiness(p_member_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_engagement INTEGER := 0;
  v_tenure INTEGER := 0;
  v_skills INTEGER := 0;
  v_leadership_exp INTEGER := 0;
  v_training INTEGER := 0;
  v_readiness INTEGER := 0;
  v_level TEXT;
  v_member_since DATE;
  v_skills_count INTEGER;
  v_advanced_skills INTEGER;
  v_roles_count INTEGER;
  v_leadership_roles_count INTEGER;
  v_certifications_count INTEGER;
  v_valid_certifications_count INTEGER;
BEGIN
  -- Get engagement score
  SELECT engagement_score INTO v_engagement
  FROM yi_connect.engagement_metrics
  WHERE member_id = p_member_id;
  v_engagement := COALESCE(v_engagement, 0);

  -- Calculate tenure score (0-100 based on years)
  SELECT member_since INTO v_member_since
  FROM yi_connect.members
  WHERE id = p_member_id;

  IF v_member_since IS NOT NULL THEN
    v_tenure := LEAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_member_since))::INTEGER * 20, 100);
  ELSE
    v_tenure := 0;
  END IF;

  -- Calculate skills score
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE proficiency IN ('advanced', 'expert'))
  INTO v_skills_count, v_advanced_skills
  FROM yi_connect.member_skills
  WHERE member_id = p_member_id;

  v_skills := LEAST((COALESCE(v_skills_count, 0) * 5) + (COALESCE(v_advanced_skills, 0) * 10), 100);

  -- Calculate leadership experience score from user_roles
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE r.hierarchy_level >= 3)
  INTO v_roles_count, v_leadership_roles_count
  FROM yi_connect.user_roles ur
  JOIN yi_connect.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_member_id
    AND ur.is_active = true;

  v_leadership_exp := LEAST(
    (COALESCE(v_leadership_roles_count, 0) * 25) +
    ((COALESCE(v_roles_count, 0) - COALESCE(v_leadership_roles_count, 0)) * 5),
    100
  );

  -- Calculate training score from member_certifications
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE expiry_date IS NULL OR expiry_date > CURRENT_DATE)
  INTO v_certifications_count, v_valid_certifications_count
  FROM yi_connect.member_certifications
  WHERE member_id = p_member_id;

  v_training := LEAST(
    (COALESCE(v_valid_certifications_count, 0) * 20) +
    ((COALESCE(v_certifications_count, 0) - COALESCE(v_valid_certifications_count, 0)) * 5),
    100
  );

  -- Calculate weighted average readiness score
  v_readiness := (
    (v_engagement * 0.30) +
    (v_tenure * 0.20) +
    (v_skills * 0.20) +
    (v_leadership_exp * 0.20) +
    (v_training * 0.10)
  )::INTEGER;

  -- Determine readiness level
  IF v_readiness >= 80 THEN
    v_level := 'highly_ready';
  ELSIF v_readiness >= 60 THEN
    v_level := 'ready';
  ELSIF v_readiness >= 40 THEN
    v_level := 'developing';
  ELSE
    v_level := 'not_ready';
  END IF;

  -- Upsert leadership assessment
  INSERT INTO yi_connect.leadership_assessments (
    member_id,
    engagement_score,
    tenure_score,
    skills_score,
    leadership_experience_score,
    training_score,
    readiness_score,
    readiness_level,
    assessed_at,
    next_assessment_date
  ) VALUES (
    p_member_id,
    v_engagement,
    v_tenure,
    v_skills,
    v_leadership_exp,
    v_training,
    v_readiness,
    v_level,
    now(),
    CURRENT_DATE + INTERVAL '3 months'
  )
  ON CONFLICT (member_id) DO UPDATE SET
    engagement_score = EXCLUDED.engagement_score,
    tenure_score = EXCLUDED.tenure_score,
    skills_score = EXCLUDED.skills_score,
    leadership_experience_score = EXCLUDED.leadership_experience_score,
    training_score = EXCLUDED.training_score,
    readiness_score = EXCLUDED.readiness_score,
    readiness_level = EXCLUDED.readiness_level,
    assessed_at = EXCLUDED.assessed_at,
    next_assessment_date = EXCLUDED.next_assessment_date,
    updated_at = now();

  RETURN v_readiness;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = yi_connect, public;

COMMENT ON FUNCTION yi_connect.calculate_leadership_readiness(UUID) IS
'Calculates leadership readiness score based on:
- Engagement score (30%): From engagement_metrics table
- Tenure score (20%): Years since member_since date
- Skills score (20%): Count and proficiency of member_skills
- Leadership experience (20%): Calculated from user_roles with hierarchy_level >= 3
- Training score (10%): Calculated from member_certifications (valid vs expired)';

-- ============================================================================
-- MIGRATION #9 — Planned Activities
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE planned_activity_status AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS planned_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  activity_name VARCHAR(500) NOT NULL,
  activity_description TEXT,
  planned_date DATE NOT NULL,

  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,

  expected_ec_count INTEGER NOT NULL DEFAULT 0 CHECK (expected_ec_count >= 0),
  expected_non_ec_count INTEGER NOT NULL DEFAULT 0 CHECK (expected_non_ec_count >= 0),

  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  status planned_activity_status NOT NULL DEFAULT 'planned',
  health_card_entry_id UUID REFERENCES health_card_entries(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  preparation_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planned_activities_chapter
  ON planned_activities(chapter_id);

CREATE INDEX IF NOT EXISTS idx_planned_activities_vertical
  ON planned_activities(vertical_id);

CREATE INDEX IF NOT EXISTS idx_planned_activities_status
  ON planned_activities(status);

CREATE INDEX IF NOT EXISTS idx_planned_activities_created_by
  ON planned_activities(created_by);

CREATE INDEX IF NOT EXISTS idx_planned_activities_date
  ON planned_activities(planned_date);

CREATE INDEX IF NOT EXISTS idx_planned_activities_composite
  ON planned_activities(chapter_id, status, planned_date DESC);

CREATE INDEX IF NOT EXISTS idx_planned_activities_health_card
  ON planned_activities(health_card_entry_id)
  WHERE health_card_entry_id IS NOT NULL;

DROP TRIGGER IF EXISTS planned_activities_updated_at ON planned_activities;
CREATE TRIGGER planned_activities_updated_at
  BEFORE UPDATE ON planned_activities
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

ALTER TABLE planned_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view chapter planned activities" ON planned_activities;
CREATE POLICY "Members can view chapter planned activities"
  ON planned_activities
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can create planned activities" ON planned_activities;
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

DROP POLICY IF EXISTS "Users can update own planned activities" ON planned_activities;
CREATE POLICY "Users can update own planned activities"
  ON planned_activities
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Chairs can update chapter planned activities" ON planned_activities;
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

DROP POLICY IF EXISTS "Users can delete own planned activities" ON planned_activities;
CREATE POLICY "Users can delete own planned activities"
  ON planned_activities
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND status != 'completed'
  );

DROP POLICY IF EXISTS "Chairs can delete chapter planned activities" ON planned_activities;
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

COMMENT ON TABLE planned_activities IS 'Activities planned by EC members before reporting to health card';

-- ============================================================================
-- MIGRATION #10 — Rename aaa_plans.fiscal_year → calendar_year
-- ============================================================================
-- Idempotent: only rename if fiscal_year still exists and calendar_year doesn't

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'yi_connect'
      AND table_name = 'aaa_plans'
      AND column_name = 'fiscal_year'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'yi_connect'
      AND table_name = 'aaa_plans'
      AND column_name = 'calendar_year'
  ) THEN
    EXECUTE 'ALTER TABLE yi_connect.aaa_plans RENAME COLUMN fiscal_year TO calendar_year';
  END IF;
END $$;

-- Rename the supporting index if it still has the old name
ALTER INDEX IF EXISTS yi_connect.idx_aaa_plans_fiscal_year RENAME TO idx_aaa_plans_calendar_year;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'yi_connect'
      AND table_name = 'aaa_plans'
      AND column_name = 'calendar_year'
  ) THEN
    EXECUTE $cmt$COMMENT ON COLUMN yi_connect.aaa_plans.calendar_year IS 'Calendar year the AAA plan covers (renamed from fiscal_year 2026-04-18 to match application code).'$cmt$;
  END IF;
END $$;
