-- ============================================================================
-- Chapter Settings Migration
-- Created: 2025-12-30
-- Description: Chapter-configurable business rules
--   Makes hardcoded business rules configurable per chapter
-- ============================================================================

-- ============================================================================
-- TABLE: chapter_settings
-- Stores configurable business rules per chapter
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chapter_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,

  -- Session Booking Rules
  session_booking_advance_days INTEGER DEFAULT 7,

  -- Trainer Workload Rules
  trainer_max_sessions_per_month INTEGER DEFAULT 6,
  trainer_warning_threshold INTEGER DEFAULT 4,

  -- Materials Approval Rules
  materials_approval_days_before INTEGER DEFAULT 3,
  materials_require_chair_approval BOOLEAN DEFAULT TRUE,

  -- MoU Rules
  mou_required_for_opportunities BOOLEAN DEFAULT TRUE,
  mou_auto_close_on_expiry BOOLEAN DEFAULT TRUE,

  -- Privacy Rules
  members_can_see_other_assessments BOOLEAN DEFAULT FALSE,
  members_can_see_other_applications BOOLEAN DEFAULT FALSE,
  coordinators_see_own_institution_only BOOLEAN DEFAULT TRUE,

  -- Engagement Score Weights (must sum to 1.0)
  engagement_weight_attendance NUMERIC(3,2) DEFAULT 0.50,
  engagement_weight_volunteer NUMERIC(3,2) DEFAULT 0.30,
  engagement_weight_feedback NUMERIC(3,2) DEFAULT 0.15,
  engagement_weight_skills NUMERIC(3,2) DEFAULT 0.05,

  -- Readiness Score Weights (must sum to 1.0)
  readiness_weight_tenure NUMERIC(3,2) DEFAULT 0.25,
  readiness_weight_positions NUMERIC(3,2) DEFAULT 0.25,
  readiness_weight_training NUMERIC(3,2) DEFAULT 0.25,
  readiness_weight_peer_input NUMERIC(3,2) DEFAULT 0.25,

  -- Financial Rules
  large_expense_threshold NUMERIC(12,2) DEFAULT 10000.00,
  expense_approval_required BOOLEAN DEFAULT TRUE,

  -- Maximum Values for Score Normalization
  max_volunteer_hours_per_year INTEGER DEFAULT 100,
  max_skills_for_full_score INTEGER DEFAULT 10,
  max_tenure_years INTEGER DEFAULT 10,
  max_leadership_positions INTEGER DEFAULT 5,
  max_nominations INTEGER DEFAULT 10,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(chapter_id),
  CONSTRAINT engagement_weights_sum CHECK (
    engagement_weight_attendance + engagement_weight_volunteer +
    engagement_weight_feedback + engagement_weight_skills = 1.00
  ),
  CONSTRAINT readiness_weights_sum CHECK (
    readiness_weight_tenure + readiness_weight_positions +
    readiness_weight_training + readiness_weight_peer_input = 1.00
  )
);

CREATE INDEX idx_chapter_settings_chapter ON chapter_settings(chapter_id);

COMMENT ON TABLE chapter_settings IS 'Chapter-configurable business rules and score weights';

-- Enable RLS
ALTER TABLE chapter_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view own chapter settings" ON chapter_settings
  FOR SELECT USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

CREATE POLICY "Chair+ can modify chapter settings" ON chapter_settings
  FOR ALL USING (
    get_user_hierarchy_level() >= 4
    AND chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all settings" ON chapter_settings
  FOR ALL USING (get_user_hierarchy_level() >= 5);

GRANT ALL ON chapter_settings TO authenticated;

-- ============================================================================
-- FUNCTION: get_chapter_settings
-- Gets settings for a chapter with defaults
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_chapter_settings(
  p_chapter_id UUID
)
RETURNS TABLE(
  -- Session Booking Rules
  session_booking_advance_days INTEGER,
  -- Trainer Workload Rules
  trainer_max_sessions_per_month INTEGER,
  trainer_warning_threshold INTEGER,
  -- Materials Approval Rules
  materials_approval_days_before INTEGER,
  materials_require_chair_approval BOOLEAN,
  -- MoU Rules
  mou_required_for_opportunities BOOLEAN,
  mou_auto_close_on_expiry BOOLEAN,
  -- Privacy Rules
  members_can_see_other_assessments BOOLEAN,
  members_can_see_other_applications BOOLEAN,
  coordinators_see_own_institution_only BOOLEAN,
  -- Engagement Score Weights
  engagement_weight_attendance NUMERIC(3,2),
  engagement_weight_volunteer NUMERIC(3,2),
  engagement_weight_feedback NUMERIC(3,2),
  engagement_weight_skills NUMERIC(3,2),
  -- Readiness Score Weights
  readiness_weight_tenure NUMERIC(3,2),
  readiness_weight_positions NUMERIC(3,2),
  readiness_weight_training NUMERIC(3,2),
  readiness_weight_peer_input NUMERIC(3,2),
  -- Financial Rules
  large_expense_threshold NUMERIC(12,2),
  expense_approval_required BOOLEAN,
  -- Normalization Values
  max_volunteer_hours_per_year INTEGER,
  max_skills_for_full_score INTEGER,
  max_tenure_years INTEGER,
  max_leadership_positions INTEGER,
  max_nominations INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(cs.session_booking_advance_days, 7),
    COALESCE(cs.trainer_max_sessions_per_month, 6),
    COALESCE(cs.trainer_warning_threshold, 4),
    COALESCE(cs.materials_approval_days_before, 3),
    COALESCE(cs.materials_require_chair_approval, TRUE),
    COALESCE(cs.mou_required_for_opportunities, TRUE),
    COALESCE(cs.mou_auto_close_on_expiry, TRUE),
    COALESCE(cs.members_can_see_other_assessments, FALSE),
    COALESCE(cs.members_can_see_other_applications, FALSE),
    COALESCE(cs.coordinators_see_own_institution_only, TRUE),
    COALESCE(cs.engagement_weight_attendance, 0.50),
    COALESCE(cs.engagement_weight_volunteer, 0.30),
    COALESCE(cs.engagement_weight_feedback, 0.15),
    COALESCE(cs.engagement_weight_skills, 0.05),
    COALESCE(cs.readiness_weight_tenure, 0.25),
    COALESCE(cs.readiness_weight_positions, 0.25),
    COALESCE(cs.readiness_weight_training, 0.25),
    COALESCE(cs.readiness_weight_peer_input, 0.25),
    COALESCE(cs.large_expense_threshold, 10000.00),
    COALESCE(cs.expense_approval_required, TRUE),
    COALESCE(cs.max_volunteer_hours_per_year, 100),
    COALESCE(cs.max_skills_for_full_score, 10),
    COALESCE(cs.max_tenure_years, 10),
    COALESCE(cs.max_leadership_positions, 5),
    COALESCE(cs.max_nominations, 10)
  FROM chapters c
  LEFT JOIN chapter_settings cs ON cs.chapter_id = c.id
  WHERE c.id = p_chapter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_chapter_settings IS 'Get chapter settings with defaults';
GRANT EXECUTE ON FUNCTION public.get_chapter_settings(UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: ensure_chapter_settings
-- Creates default settings for a chapter if they don't exist
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_chapter_settings(
  p_chapter_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_settings_id UUID;
BEGIN
  -- Try to get existing settings
  SELECT id INTO v_settings_id
  FROM chapter_settings
  WHERE chapter_id = p_chapter_id;

  -- If not found, create with defaults
  IF v_settings_id IS NULL THEN
    INSERT INTO chapter_settings (chapter_id)
    VALUES (p_chapter_id)
    RETURNING id INTO v_settings_id;
  END IF;

  RETURN v_settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.ensure_chapter_settings IS 'Ensures chapter settings exist, creates with defaults if not';
GRANT EXECUTE ON FUNCTION public.ensure_chapter_settings(UUID) TO authenticated;

-- ============================================================================
-- TRIGGER: Auto-create settings for new chapters
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_chapter_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO chapter_settings (chapter_id)
  VALUES (NEW.id)
  ON CONFLICT (chapter_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_chapter_settings ON chapters;
CREATE TRIGGER trigger_auto_create_chapter_settings
  AFTER INSERT ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_chapter_settings();

-- ============================================================================
-- Create default settings for existing chapters
-- ============================================================================
INSERT INTO chapter_settings (chapter_id)
SELECT id FROM chapters
WHERE id NOT IN (SELECT chapter_id FROM chapter_settings)
ON CONFLICT (chapter_id) DO NOTHING;

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================
CREATE TRIGGER set_chapter_settings_updated_at
BEFORE UPDATE ON chapter_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
