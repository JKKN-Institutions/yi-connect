-- ============================================================================
-- Part 3: Institution-Scoped RLS Policies & Skill-Will Assessments
-- Created: 2025-11-28
-- Description: Enhanced RLS policies for privacy (Rule 6), MoU validation (Rule 5),
--              and Skill-Will Assessment system
-- ============================================================================

-- ============================================================================
-- TABLE: skill_will_assessments
-- Stores the 5-question AI-adaptive assessment for members
-- Privacy Rule 6: Members cannot see other members' assessments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.skill_will_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,

  -- Assessment status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  version INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '90 days'),

  -- Question 1: Energy Focus (Base Question)
  q1_energy_focus TEXT CHECK (q1_energy_focus IN (
    'teaching_mentoring', 'organizing_events', 'corporate_partnerships',
    'fieldwork', 'creative_work'
  )),
  q1_ai_suggestion TEXT,
  q1_ai_reason TEXT,

  -- Question 2: Age Group Preference (Adaptive)
  q2_age_group TEXT CHECK (q2_age_group IN (
    'children_5_12', 'teenagers_15_22', 'adults_25_plus', 'all_ages'
  )),
  q2_ai_suggestion TEXT,
  q2_ai_reason TEXT,
  q2_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- Question 3: Skill Level
  q3_skill_level TEXT CHECK (q3_skill_level IN (
    'none', 'beginner', 'intermediate', 'expert'
  )),
  q3_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- Question 4: Time Commitment
  q4_time_commitment TEXT CHECK (q4_time_commitment IN (
    'under_2_hours', 'hours_5_10', 'hours_10_15', 'hours_15_plus'
  )),
  q4_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- Question 5: Travel Willingness
  q5_travel_willingness TEXT CHECK (q5_travel_willingness IN (
    'city_only', 'district', 'neighboring', 'all_state'
  )),
  q5_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- AI Analysis
  ai_helper_suggestions JSONB DEFAULT '{}'::jsonb,
  -- Structure: {"q1": {"suggestion": "...", "reason": "...", "confidence": 0.85}, ...}

  ai_scoring_result JSONB,
  ai_classification_confidence DECIMAL(3,2),
  profile_bonus_score DECIMAL(4,2) DEFAULT 0,

  -- Scores (0-1 scale)
  skill_score DECIMAL(4,2) CHECK (skill_score >= 0 AND skill_score <= 1),
  will_score DECIMAL(4,2) CHECK (will_score >= 0 AND will_score <= 1),

  -- Category (calculated from skill/will scores)
  category TEXT CHECK (category IN ('star', 'enthusiast', 'cynic', 'dead_wood')),

  -- Vertical Recommendation
  recommended_vertical_id UUID REFERENCES public.verticals(id),
  recommended_match_pct INTEGER CHECK (recommended_match_pct >= 0 AND recommended_match_pct <= 100),
  alternative_verticals JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"vertical_name": "...", "match_pct": 75, "reason": "..."}, ...]

  -- Final Assignment (may differ from recommendation)
  assigned_vertical_id UUID REFERENCES public.verticals(id),
  assigned_by UUID REFERENCES public.members(id),
  assigned_at TIMESTAMPTZ,
  assignment_notes TEXT,

  -- Mentor Assignment
  mentor_id UUID REFERENCES public.members(id),
  mentor_assigned_at TIMESTAMPTZ,
  mentor_notes TEXT,

  -- Development Roadmap
  roadmap JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"month": 1, "title": "...", "tasks": [], "completed": false}, ...]

  -- Member Response
  recommendation_accepted BOOLEAN,
  change_requested BOOLEAN DEFAULT false,
  change_request_reason TEXT,
  change_reviewed_by UUID REFERENCES public.members(id),
  change_reviewed_at TIMESTAMPTZ,
  change_decision TEXT CHECK (change_decision IN ('approved', 'denied')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_skill_will_assessments_member ON skill_will_assessments(member_id)
  WHERE status IN ('pending', 'in_progress'); -- Only one active assessment per member
CREATE INDEX idx_skill_will_assessments_chapter ON skill_will_assessments(chapter_id);
CREATE INDEX idx_skill_will_assessments_status ON skill_will_assessments(status);
CREATE INDEX idx_skill_will_assessments_category ON skill_will_assessments(category)
  WHERE status = 'completed';
CREATE INDEX idx_skill_will_assessments_mentor ON skill_will_assessments(mentor_id)
  WHERE mentor_id IS NOT NULL;

COMMENT ON TABLE skill_will_assessments IS 'AI-adaptive Skill-Will assessment for member vertical matching';
COMMENT ON COLUMN skill_will_assessments.category IS 'star=high skill+high will, enthusiast=low skill+high will, cynic=high skill+low will, dead_wood=low skill+low will';

-- Enable RLS
ALTER TABLE skill_will_assessments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS: skill_will_assessments (Privacy Rule 6)
-- Members can ONLY see their own assessments
-- ============================================================================

-- Members can view ONLY their own assessment
CREATE POLICY "assessments_select_own" ON skill_will_assessments
  FOR SELECT USING (
    member_id = auth.uid()
  );

-- Chair+ and assigned mentors can view assessments
CREATE POLICY "assessments_select_admin" ON skill_will_assessments
  FOR SELECT USING (
    get_user_hierarchy_level() >= 3  -- Co-Chair+
    OR mentor_id = auth.uid()         -- Assigned mentor
  );

-- Members can create/update their own assessment
CREATE POLICY "assessments_insert_own" ON skill_will_assessments
  FOR INSERT WITH CHECK (
    member_id = auth.uid()
    AND user_belongs_to_chapter(chapter_id)
  );

CREATE POLICY "assessments_update_own" ON skill_will_assessments
  FOR UPDATE USING (
    member_id = auth.uid()
    AND status IN ('pending', 'in_progress')
  );

-- Chair+ can update any assessment (for assignment)
CREATE POLICY "assessments_update_admin" ON skill_will_assessments
  FOR UPDATE USING (
    get_user_hierarchy_level() >= 3
  );

-- ============================================================================
-- FUNCTION: Auto-close opportunities when MoU expires (Rule 5)
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_close_expired_mou_opportunities()
RETURNS TRIGGER AS $$
BEGIN
  -- When MoU status changes to expired or expiry_date passes
  IF NEW.mou_status = 'expired' OR (NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE) THEN
    UPDATE industry_opportunities
    SET
      status = 'closed',
      closed_at = now(),
      close_reason = 'MoU expired'
    WHERE
      industry_id = NEW.stakeholder_id
      AND status IN ('draft', 'published', 'accepting_applications')
      AND NEW.stakeholder_type = 'industry';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_auto_close_mou_opportunities ON stakeholder_mous;
CREATE TRIGGER trigger_auto_close_mou_opportunities
  AFTER UPDATE ON stakeholder_mous
  FOR EACH ROW
  WHEN (OLD.mou_status IS DISTINCT FROM NEW.mou_status OR OLD.expiry_date IS DISTINCT FROM NEW.expiry_date)
  EXECUTE FUNCTION auto_close_expired_mou_opportunities();

COMMENT ON FUNCTION auto_close_expired_mou_opportunities IS 'Rule 5: Auto-close opportunities when MoU expires';

-- ============================================================================
-- FUNCTION: Validate MoU before opportunity creation (Rule 5)
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_mou_for_opportunity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate when publishing (status changes to published or accepting_applications)
  IF NEW.status IN ('published', 'accepting_applications') THEN
    IF NOT has_active_mou(NEW.industry_id) THEN
      RAISE EXCEPTION 'Cannot publish opportunity: Industry does not have an active MoU. Please ensure MoU is signed and not expired.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_validate_mou_opportunity ON industry_opportunities;
CREATE TRIGGER trigger_validate_mou_opportunity
  BEFORE INSERT OR UPDATE OF status ON industry_opportunities
  FOR EACH ROW
  WHEN (NEW.status IN ('published', 'accepting_applications'))
  EXECUTE FUNCTION validate_mou_for_opportunity();

COMMENT ON FUNCTION validate_mou_for_opportunity IS 'Rule 5: Validate active MoU before publishing opportunity';

-- ============================================================================
-- Enhanced RLS: opportunity_applications (Privacy Rule 6)
-- Add admin override policies
-- ============================================================================

-- Drop existing admin policy if any and recreate
DROP POLICY IF EXISTS "Admins can view all applications" ON opportunity_applications;

CREATE POLICY "Admins can view all applications" ON opportunity_applications
  FOR SELECT USING (
    get_user_hierarchy_level() >= 4  -- Chair+
    OR is_vertical_chair()           -- Industry Chair
  );

-- ============================================================================
-- Enhanced RLS: industry_opportunities (MoU Check)
-- Add MoU validation in policies
-- ============================================================================

-- Update the insert/update policy to check MoU
DROP POLICY IF EXISTS "Industry coordinators can manage their opportunities" ON industry_opportunities;

CREATE POLICY "Industry coordinators can create opportunities with active MoU" ON industry_opportunities
  FOR INSERT WITH CHECK (
    -- Creator must have active MoU
    (has_active_mou(industry_id) OR status = 'draft')
    AND (
      created_by = auth.uid()
      OR get_user_hierarchy_level() >= 4
    )
  );

CREATE POLICY "Industry coordinators can update their opportunities" ON industry_opportunities
  FOR UPDATE USING (
    created_by = auth.uid()
    OR get_user_hierarchy_level() >= 4
    OR is_vertical_chair()
  )
  WITH CHECK (
    -- MoU check when publishing
    (status NOT IN ('published', 'accepting_applications') OR has_active_mou(industry_id))
  );

CREATE POLICY "Only Chair+ can delete opportunities" ON industry_opportunities
  FOR DELETE USING (
    get_user_hierarchy_level() >= 4
  );

-- ============================================================================
-- VIEW: member_assessment_summary
-- For Chair dashboard - anonymized view of assessment completion
-- ============================================================================
CREATE VIEW member_assessment_summary AS
SELECT
  swa.chapter_id,
  swa.category,
  COUNT(*) AS member_count,
  AVG(swa.skill_score) AS avg_skill_score,
  AVG(swa.will_score) AS avg_will_score
FROM skill_will_assessments swa
WHERE swa.status = 'completed'
GROUP BY swa.chapter_id, swa.category;

COMMENT ON VIEW member_assessment_summary IS 'Anonymized summary of assessment results by category';

-- ============================================================================
-- VIEW: vertical_assessment_recommendations
-- For Chair - shows recommended vertical assignments
-- ============================================================================
CREATE VIEW vertical_assessment_recommendations AS
SELECT
  swa.id AS assessment_id,
  swa.member_id,
  m.full_name AS member_name,
  swa.category,
  swa.skill_score,
  swa.will_score,
  v.name AS recommended_vertical,
  swa.recommended_match_pct,
  swa.alternative_verticals,
  swa.recommendation_accepted,
  swa.change_requested,
  swa.assigned_vertical_id IS NOT NULL AS is_assigned,
  swa.completed_at
FROM skill_will_assessments swa
JOIN members m ON swa.member_id = m.id
LEFT JOIN verticals v ON swa.recommended_vertical_id = v.id
WHERE swa.status = 'completed'
ORDER BY swa.completed_at DESC;

COMMENT ON VIEW vertical_assessment_recommendations IS 'Assessment recommendations for Chair review';

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE TRIGGER set_skill_will_assessments_updated_at
BEFORE UPDATE ON skill_will_assessments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT ALL ON skill_will_assessments TO authenticated;
GRANT SELECT ON member_assessment_summary TO authenticated;
GRANT SELECT ON vertical_assessment_recommendations TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
