-- ============================================================================
-- ELIGIBILITY CALCULATION FUNCTION
-- ============================================================================
-- Calculates a member's eligibility score for a succession position
-- based on tenure, event participation, leadership experience, and skills
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_member_eligibility(
  p_member_id UUID,
  p_position_id UUID
)
RETURNS TABLE (
  is_eligible BOOLEAN,
  total_score NUMERIC,
  breakdown JSONB
) AS $$
DECLARE
  v_criteria JSONB;
  v_member_since TIMESTAMP;
  v_tenure_years NUMERIC;
  v_event_count INTEGER;
  v_has_leadership BOOLEAN;
  v_member_skills TEXT[];
  v_matching_skills TEXT[];

  v_tenure_score NUMERIC := 0;
  v_events_score NUMERIC := 0;
  v_leadership_score NUMERIC := 0;
  v_skills_score NUMERIC := 0;

  v_tenure_weight NUMERIC := 0;
  v_events_weight NUMERIC := 0;
  v_leadership_weight NUMERIC := 0;
  v_skills_weight NUMERIC := 0;

  v_min_tenure NUMERIC;
  v_min_events INTEGER;
  v_required_skills TEXT[];
  v_minimum_score NUMERIC;

  v_weighted_score NUMERIC := 0;
  v_is_eligible BOOLEAN := TRUE;
BEGIN
  -- Get position eligibility criteria
  SELECT eligibility_criteria INTO v_criteria
  FROM succession_positions
  WHERE id = p_position_id;

  IF v_criteria IS NULL THEN
    RAISE EXCEPTION 'Position not found: %', p_position_id;
  END IF;

  -- Extract criteria values
  v_min_tenure := (v_criteria->>'min_tenure')::NUMERIC;
  v_min_events := (v_criteria->>'min_events')::INTEGER;
  v_required_skills := ARRAY(SELECT jsonb_array_elements_text(v_criteria->'required_skills'));
  v_tenure_weight := COALESCE((v_criteria->>'tenure_weight')::NUMERIC, 0);
  v_events_weight := COALESCE((v_criteria->>'events_weight')::NUMERIC, 0);
  v_leadership_weight := COALESCE((v_criteria->>'leadership_weight')::NUMERIC, 0);
  v_skills_weight := COALESCE((v_criteria->>'skills_weight')::NUMERIC, 0);
  v_minimum_score := COALESCE((v_criteria->>'minimum_score')::NUMERIC, 0);

  -- Get member data
  SELECT created_at INTO v_member_since
  FROM members
  WHERE id = p_member_id;

  IF v_member_since IS NULL THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  -- Calculate tenure in years
  v_tenure_years := EXTRACT(EPOCH FROM (NOW() - v_member_since)) / (365.25 * 24 * 60 * 60);

  -- Get event participation count
  SELECT COUNT(*) INTO v_event_count
  FROM event_registrations
  WHERE member_id = p_member_id
    AND status = 'attended';

  -- Check leadership experience (simplified - check if member has any leadership role)
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_member_id
      AND r.name IN ('Chair', 'Co-Chair', 'Executive Member')
  ) INTO v_has_leadership;

  -- Get member skills
  SELECT ARRAY_AGG(skill_name) INTO v_member_skills
  FROM member_skills
  WHERE member_id = p_member_id;

  v_member_skills := COALESCE(v_member_skills, ARRAY[]::TEXT[]);

  -- Calculate matching skills
  IF v_required_skills IS NOT NULL AND array_length(v_required_skills, 1) > 0 THEN
    v_matching_skills := ARRAY(
      SELECT unnest(v_member_skills)
      INTERSECT
      SELECT unnest(v_required_skills)
    );
  ELSE
    v_matching_skills := ARRAY[]::TEXT[];
  END IF;

  -- ============================================================================
  -- SCORE CALCULATION
  -- ============================================================================

  -- Tenure Score
  IF v_tenure_weight > 0 THEN
    IF v_min_tenure IS NOT NULL AND v_min_tenure > 0 THEN
      v_tenure_score := LEAST(100, (v_tenure_years / v_min_tenure) * 100);
      IF v_tenure_years < v_min_tenure THEN
        v_is_eligible := FALSE;
      END IF;
    ELSE
      -- No minimum tenure required, full score if any tenure
      v_tenure_score := 100;
    END IF;
  END IF;

  -- Events Score
  IF v_events_weight > 0 THEN
    IF v_min_events IS NOT NULL AND v_min_events > 0 THEN
      v_events_score := LEAST(100, (v_event_count::NUMERIC / v_min_events) * 100);
      IF v_event_count < v_min_events THEN
        v_is_eligible := FALSE;
      END IF;
    ELSE
      -- No minimum events required, full score if any participation
      v_events_score := 100;
    END IF;
  END IF;

  -- Leadership Score
  IF v_leadership_weight > 0 THEN
    IF v_has_leadership THEN
      v_leadership_score := 100;
    ELSE
      v_leadership_score := 0;
      IF (v_criteria->>'min_leadership_experience')::BOOLEAN = TRUE THEN
        v_is_eligible := FALSE;
      END IF;
    END IF;
  END IF;

  -- Skills Score
  IF v_skills_weight > 0 THEN
    IF v_required_skills IS NOT NULL AND array_length(v_required_skills, 1) > 0 THEN
      v_skills_score := (array_length(v_matching_skills, 1)::NUMERIC /
                        array_length(v_required_skills, 1)) * 100;
      v_skills_score := COALESCE(v_skills_score, 0);
    ELSE
      -- No required skills, full score
      v_skills_score := 100;
    END IF;
  END IF;

  -- Calculate weighted total score
  v_weighted_score := (
    (v_tenure_score * v_tenure_weight / 100) +
    (v_events_score * v_events_weight / 100) +
    (v_leadership_score * v_leadership_weight / 100) +
    (v_skills_score * v_skills_weight / 100)
  );

  -- Check if score meets minimum threshold
  IF v_weighted_score < v_minimum_score THEN
    v_is_eligible := FALSE;
  END IF;

  -- Return results
  RETURN QUERY SELECT
    v_is_eligible,
    v_weighted_score,
    jsonb_build_object(
      'tenure', jsonb_build_object(
        'value', v_tenure_years,
        'score', v_tenure_score,
        'required', v_min_tenure,
        'weight', v_tenure_weight
      ),
      'events', jsonb_build_object(
        'value', v_event_count,
        'score', v_events_score,
        'required', v_min_events,
        'weight', v_events_weight
      ),
      'leadership', jsonb_build_object(
        'value', v_has_leadership,
        'score', v_leadership_score,
        'weight', v_leadership_weight
      ),
      'skills', jsonb_build_object(
        'required', v_required_skills,
        'matched', v_matching_skills,
        'score', v_skills_score,
        'weight', v_skills_weight
      ),
      'weighted_total', v_weighted_score,
      'minimum_required', v_minimum_score
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- BULK ELIGIBILITY CALCULATION FUNCTION
-- ============================================================================
-- Calculates and stores eligibility for all members for all positions in a cycle
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_calculate_cycle_eligibility(p_cycle_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_position_record RECORD;
  v_member_record RECORD;
  v_eligibility RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Delete existing eligibility records for this cycle
  DELETE FROM succession_eligibility_records
  WHERE cycle_id = p_cycle_id;

  -- Loop through all active positions in the cycle
  FOR v_position_record IN
    SELECT id FROM succession_positions
    WHERE cycle_id = p_cycle_id AND is_active = TRUE
  LOOP
    -- Loop through all members
    FOR v_member_record IN
      SELECT id FROM members WHERE deleted_at IS NULL
    LOOP
      -- Calculate eligibility
      SELECT * INTO v_eligibility
      FROM calculate_member_eligibility(v_member_record.id, v_position_record.id);

      -- Insert eligibility record
      INSERT INTO succession_eligibility_records (
        cycle_id,
        position_id,
        member_id,
        is_eligible,
        eligibility_score,
        score_breakdown,
        calculated_at
      ) VALUES (
        p_cycle_id,
        v_position_record.id,
        v_member_record.id,
        v_eligibility.is_eligible,
        v_eligibility.total_score,
        v_eligibility.breakdown,
        NOW()
      );

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_member_eligibility(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_calculate_cycle_eligibility(UUID) TO authenticated;

-- ============================================================================
-- COMMENT DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION calculate_member_eligibility IS
'Calculates a member''s eligibility score for a succession position based on tenure, events, leadership, and skills';

COMMENT ON FUNCTION bulk_calculate_cycle_eligibility IS
'Calculates and stores eligibility records for all members for all positions in a cycle';
