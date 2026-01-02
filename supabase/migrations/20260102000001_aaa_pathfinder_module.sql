-- ============================================================================
-- AAA Pathfinder Module
-- Created: 2026-01-02
-- Purpose: AAA Framework (Awareness → Action → Advocacy) for Pathfinder 2026
-- ============================================================================

-- ============================================================================
-- TABLE 1: aaa_plans
-- Stores AAA plans for each vertical per fiscal year
-- ============================================================================

CREATE TABLE aaa_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- ==================== AWARENESS (3 activities) ====================
  awareness_1_title VARCHAR(255),
  awareness_1_description TEXT,
  awareness_1_audience VARCHAR(255),
  awareness_1_target_date DATE,
  awareness_1_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_1_status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  awareness_2_title VARCHAR(255),
  awareness_2_description TEXT,
  awareness_2_audience VARCHAR(255),
  awareness_2_target_date DATE,
  awareness_2_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_2_status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  awareness_3_title VARCHAR(255),
  awareness_3_description TEXT,
  awareness_3_audience VARCHAR(255),
  awareness_3_target_date DATE,
  awareness_3_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_3_status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  -- ==================== ACTION (2 events) ====================
  action_1_title VARCHAR(255),
  action_1_description TEXT,
  action_1_target VARCHAR(255),
  action_1_target_date DATE,
  action_1_status VARCHAR(20) DEFAULT 'planned' CHECK (action_1_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  action_1_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  action_2_title VARCHAR(255),
  action_2_description TEXT,
  action_2_target VARCHAR(255),
  action_2_target_date DATE,
  action_2_status VARCHAR(20) DEFAULT 'planned' CHECK (action_2_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  action_2_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- First Event Commitment (locked date)
  first_event_date DATE,
  first_event_locked BOOLEAN DEFAULT false,
  first_event_locked_at TIMESTAMPTZ,

  -- ==================== ADVOCACY (1 goal) ====================
  advocacy_goal TEXT,
  advocacy_target_contact VARCHAR(255),
  advocacy_approach TEXT,
  advocacy_status VARCHAR(20) DEFAULT 'planned' CHECK (advocacy_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  advocacy_outcome TEXT,

  -- ==================== 90-DAY MILESTONES ====================
  milestone_jan_target TEXT,
  milestone_jan_status VARCHAR(20) DEFAULT 'pending' CHECK (milestone_jan_status IN ('pending', 'in_progress', 'completed')),
  milestone_jan_notes TEXT,

  milestone_feb_target TEXT,
  milestone_feb_status VARCHAR(20) DEFAULT 'pending' CHECK (milestone_feb_status IN ('pending', 'in_progress', 'completed')),
  milestone_feb_notes TEXT,

  milestone_mar_target TEXT,
  milestone_mar_status VARCHAR(20) DEFAULT 'pending' CHECK (milestone_mar_status IN ('pending', 'in_progress', 'completed')),
  milestone_mar_notes TEXT,

  -- ==================== METADATA ====================
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'active')),
  created_by UUID NOT NULL REFERENCES members(id),
  approved_by UUID REFERENCES members(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year)
);

CREATE INDEX idx_aaa_plans_vertical_id ON aaa_plans(vertical_id);
CREATE INDEX idx_aaa_plans_fiscal_year ON aaa_plans(fiscal_year);
CREATE INDEX idx_aaa_plans_chapter_id ON aaa_plans(chapter_id);
CREATE INDEX idx_aaa_plans_status ON aaa_plans(status);

COMMENT ON TABLE aaa_plans IS 'AAA Framework plans: 3 Awareness, 2 Action, 1 Advocacy per vertical per year';

-- ============================================================================
-- TABLE 2: commitment_cards
-- Digital commitment cards signed at Pathfinder
-- ============================================================================

CREATE TABLE commitment_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  aaa_plan_id UUID REFERENCES aaa_plans(id) ON DELETE SET NULL,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  pathfinder_year INT NOT NULL,

  -- Three commitments
  commitment_1 TEXT NOT NULL,
  commitment_2 TEXT,
  commitment_3 TEXT,

  -- Signature
  signed_at TIMESTAMPTZ,
  signature_data TEXT, -- Base64 encoded signature image

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(member_id, pathfinder_year)
);

CREATE INDEX idx_commitment_cards_member_id ON commitment_cards(member_id);
CREATE INDEX idx_commitment_cards_chapter_id ON commitment_cards(chapter_id);
CREATE INDEX idx_commitment_cards_pathfinder_year ON commitment_cards(pathfinder_year);

COMMENT ON TABLE commitment_cards IS 'Digital commitment cards signed by EC Chairs at Pathfinder events';

-- ============================================================================
-- TABLE 3: mentor_assignments
-- Mentor-mentee relationships for EC Chairs
-- ============================================================================

CREATE TABLE mentor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ec_chair_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL,
  pathfinder_year INT NOT NULL,

  -- Mentor details (cached for display)
  mentor_name VARCHAR(255),
  mentor_title VARCHAR(255),
  mentor_expertise TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,

  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(ec_chair_id, pathfinder_year)
);

CREATE INDEX idx_mentor_assignments_ec_chair_id ON mentor_assignments(ec_chair_id);
CREATE INDEX idx_mentor_assignments_mentor_id ON mentor_assignments(mentor_id);
CREATE INDEX idx_mentor_assignments_chapter_id ON mentor_assignments(chapter_id);

COMMENT ON TABLE mentor_assignments IS 'Mentor-mentee assignments for EC Chairs from Pathfinder';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE aaa_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_assignments ENABLE ROW LEVEL SECURITY;

-- AAA Plans: Members can view their chapter's plans, EC+ can edit
CREATE POLICY "Members can view chapter AAA plans" ON aaa_plans
  FOR SELECT USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "EC and above can insert AAA plans" ON aaa_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.chapter_id = aaa_plans.chapter_id
      AND m.hierarchy_level >= 3
    )
  );

CREATE POLICY "EC and above can update AAA plans" ON aaa_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.chapter_id = aaa_plans.chapter_id
      AND m.hierarchy_level >= 3
    )
  );

-- Commitment Cards: Members can view/edit their own
CREATE POLICY "Members can view own commitment cards" ON commitment_cards
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR chapter_id IN (
      SELECT chapter_id FROM members WHERE user_id = auth.uid() AND hierarchy_level >= 4
    )
  );

CREATE POLICY "Members can insert own commitment cards" ON commitment_cards
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can update own commitment cards" ON commitment_cards
  FOR UPDATE USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Mentor Assignments: View chapter assignments, Chair+ can manage
CREATE POLICY "Members can view chapter mentor assignments" ON mentor_assignments
  FOR SELECT USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Chair can manage mentor assignments" ON mentor_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.chapter_id = mentor_assignments.chapter_id
      AND m.hierarchy_level >= 4
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_aaa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER aaa_plans_updated_at
  BEFORE UPDATE ON aaa_plans
  FOR EACH ROW EXECUTE FUNCTION update_aaa_updated_at();

CREATE TRIGGER commitment_cards_updated_at
  BEFORE UPDATE ON commitment_cards
  FOR EACH ROW EXECUTE FUNCTION update_aaa_updated_at();

CREATE TRIGGER mentor_assignments_updated_at
  BEFORE UPDATE ON mentor_assignments
  FOR EACH ROW EXECUTE FUNCTION update_aaa_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get AAA completion percentage for a plan
CREATE OR REPLACE FUNCTION get_aaa_completion(plan_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_items INT := 6; -- 3 awareness + 2 action + 1 advocacy
  completed_items INT := 0;
  plan_record RECORD;
BEGIN
  SELECT * INTO plan_record FROM aaa_plans WHERE id = plan_id;

  IF plan_record IS NULL THEN
    RETURN 0;
  END IF;

  -- Count completed items
  IF plan_record.awareness_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_3_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.advocacy_status = 'completed' THEN completed_items := completed_items + 1; END IF;

  RETURN ROUND((completed_items::NUMERIC / total_items) * 100, 1);
END;
$$ LANGUAGE plpgsql;

-- Get milestone completion for Q1
CREATE OR REPLACE FUNCTION get_milestone_completion(plan_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_milestones INT := 3;
  completed_milestones INT := 0;
  plan_record RECORD;
BEGIN
  SELECT * INTO plan_record FROM aaa_plans WHERE id = plan_id;

  IF plan_record IS NULL THEN
    RETURN 0;
  END IF;

  IF plan_record.milestone_jan_status = 'completed' THEN completed_milestones := completed_milestones + 1; END IF;
  IF plan_record.milestone_feb_status = 'completed' THEN completed_milestones := completed_milestones + 1; END IF;
  IF plan_record.milestone_mar_status = 'completed' THEN completed_milestones := completed_milestones + 1; END IF;

  RETURN ROUND((completed_milestones::NUMERIC / total_milestones) * 100, 1);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_aaa_completion IS 'Calculate AAA plan completion percentage (0-100)';
COMMENT ON FUNCTION get_milestone_completion IS 'Calculate 90-day milestone completion percentage (0-100)';
