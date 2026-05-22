--
-- Fix Leadership Readiness Score Calculation
-- Replaces hardcoded values with actual calculations from user_roles and member_certifications tables
--

-- Drop and recreate the function with proper calculations
CREATE OR REPLACE FUNCTION public.calculate_leadership_readiness(p_member_id UUID)
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
  FROM public.engagement_metrics
  WHERE member_id = p_member_id;
  v_engagement := COALESCE(v_engagement, 0);

  -- Calculate tenure score (0-100 based on years)
  SELECT member_since INTO v_member_since
  FROM public.members
  WHERE id = p_member_id;

  IF v_member_since IS NOT NULL THEN
    v_tenure := LEAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_member_since))::INTEGER * 20, 100);
  ELSE
    v_tenure := 0;
  END IF;

  -- Calculate skills score based on count and proficiency
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE proficiency IN ('advanced', 'expert'))
  INTO v_skills_count, v_advanced_skills
  FROM public.member_skills
  WHERE member_id = p_member_id;

  v_skills := LEAST((COALESCE(v_skills_count, 0) * 5) + (COALESCE(v_advanced_skills, 0) * 10), 100);

  -- Calculate leadership experience score from user_roles table
  -- Count total roles and roles with hierarchy_level >= 3 (leadership positions)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE r.hierarchy_level >= 3)
  INTO v_roles_count, v_leadership_roles_count
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_member_id
    AND ur.is_active = true;

  -- Score based on leadership roles held:
  -- Each leadership role (hierarchy >= 3) = 25 points
  -- Each regular role = 5 points
  -- Max 100 points
  v_leadership_exp := LEAST(
    (COALESCE(v_leadership_roles_count, 0) * 25) +
    ((COALESCE(v_roles_count, 0) - COALESCE(v_leadership_roles_count, 0)) * 5),
    100
  );

  -- Calculate training score from member_certifications table
  -- Count total certifications and valid (non-expired) certifications
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE expiry_date IS NULL OR expiry_date > CURRENT_DATE)
  INTO v_certifications_count, v_valid_certifications_count
  FROM public.member_certifications
  WHERE member_id = p_member_id;

  -- Score based on certifications:
  -- Each valid certification = 20 points
  -- Each expired certification = 5 points (still shows effort)
  -- Max 100 points
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
  INSERT INTO public.leadership_assessments (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment documenting the function
COMMENT ON FUNCTION public.calculate_leadership_readiness(UUID) IS
'Calculates leadership readiness score based on:
- Engagement score (30%): From engagement_metrics table
- Tenure score (20%): Years since member_since date
- Skills score (20%): Count and proficiency of member_skills
- Leadership experience (20%): Calculated from user_roles with hierarchy_level >= 3
- Training score (10%): Calculated from member_certifications (valid vs expired)';
