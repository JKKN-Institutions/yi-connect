-- ============================================================================
-- Part 3: Business Rules Enforcement Migration
-- Created: 2025-11-28
-- Description: Implements Rules 2, 3, 4 from Part3.md
--   Rule 2: Trainer max 6 sessions/month
--   Rule 3: Materials approval 3 days before session
--   Rule 4: Booking restrictions and validations
-- ============================================================================

-- ============================================================================
-- TABLE: trainer_workload_tracking
-- Caches monthly trainer session counts for quick lookups
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trainer_workload_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  session_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),

  UNIQUE(trainer_id, year, month)
);

CREATE INDEX idx_trainer_workload_lookup ON trainer_workload_tracking(trainer_id, year, month);

COMMENT ON TABLE trainer_workload_tracking IS 'Rule 2: Tracks trainer session counts per month for workload limits';

-- Enable RLS
ALTER TABLE trainer_workload_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Trainers can view own workload" ON trainer_workload_tracking
  FOR SELECT USING (trainer_id = auth.uid());

CREATE POLICY "Chair+ can view all workload" ON trainer_workload_tracking
  FOR SELECT USING (get_user_hierarchy_level() >= 3);

CREATE POLICY "System can manage workload" ON trainer_workload_tracking
  FOR ALL USING (get_user_hierarchy_level() >= 4);

GRANT ALL ON trainer_workload_tracking TO authenticated;

-- ============================================================================
-- FUNCTION: get_trainer_session_count
-- Returns the number of sessions a trainer has for a given month
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_trainer_session_count(
  p_trainer_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- First try to get from cache
  SELECT session_count INTO v_count
  FROM trainer_workload_tracking
  WHERE trainer_id = p_trainer_id
  AND year = p_year
  AND month = p_month;

  IF v_count IS NOT NULL THEN
    RETURN v_count;
  END IF;

  -- Calculate from session_booking_trainers
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM session_booking_trainers sbt
  JOIN session_bookings sb ON sbt.booking_id = sb.id
  WHERE sbt.trainer_id = p_trainer_id
  AND EXTRACT(YEAR FROM sb.session_date) = p_year
  AND EXTRACT(MONTH FROM sb.session_date) = p_month
  AND sb.status NOT IN ('cancelled', 'rejected');

  -- Cache the result
  INSERT INTO trainer_workload_tracking (trainer_id, year, month, session_count)
  VALUES (p_trainer_id, p_year, p_month, COALESCE(v_count, 0))
  ON CONFLICT (trainer_id, year, month)
  DO UPDATE SET session_count = COALESCE(v_count, 0), last_updated = now();

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_trainer_session_count IS 'Rule 2: Get trainer session count for a month';
GRANT EXECUTE ON FUNCTION public.get_trainer_session_count(UUID, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- FUNCTION: validate_trainer_workload
-- Validates if a trainer can be assigned to a session (Rule 2)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_trainer_workload(
  p_trainer_id UUID,
  p_session_date DATE,
  p_max_sessions INTEGER DEFAULT 6
)
RETURNS TABLE(
  can_assign BOOLEAN,
  current_count INTEGER,
  max_allowed INTEGER,
  message TEXT
) AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_current_count INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM p_session_date)::INTEGER;
  v_month := EXTRACT(MONTH FROM p_session_date)::INTEGER;

  v_current_count := get_trainer_session_count(p_trainer_id, v_year, v_month);

  IF v_current_count >= p_max_sessions THEN
    RETURN QUERY SELECT
      FALSE,
      v_current_count,
      p_max_sessions,
      format('Trainer has reached maximum sessions (%s/%s) for %s/%s',
             v_current_count, p_max_sessions, v_month, v_year);
  ELSE
    RETURN QUERY SELECT
      TRUE,
      v_current_count,
      p_max_sessions,
      format('Trainer can be assigned (%s/%s sessions used)',
             v_current_count, p_max_sessions);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.validate_trainer_workload IS 'Rule 2: Validate trainer can be assigned without exceeding workload';
GRANT EXECUTE ON FUNCTION public.validate_trainer_workload(UUID, DATE, INTEGER) TO authenticated;

-- ============================================================================
-- TRIGGER: Validate trainer assignment
-- Prevents assigning trainer if they exceed monthly limit
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_trainer_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_session_date DATE;
  v_can_assign BOOLEAN;
  v_current INTEGER;
  v_max INTEGER;
  v_message TEXT;
BEGIN
  -- Get the session date from the booking
  SELECT session_date INTO v_session_date
  FROM session_bookings
  WHERE id = NEW.booking_id;

  -- Validate workload
  SELECT can_assign, current_count, max_allowed, message
  INTO v_can_assign, v_current, v_max, v_message
  FROM validate_trainer_workload(NEW.trainer_id, v_session_date, 6);

  IF NOT v_can_assign THEN
    RAISE EXCEPTION 'Cannot assign trainer: %', v_message;
  END IF;

  -- Update workload cache
  UPDATE trainer_workload_tracking
  SET session_count = session_count + 1, last_updated = now()
  WHERE trainer_id = NEW.trainer_id
  AND year = EXTRACT(YEAR FROM v_session_date)
  AND month = EXTRACT(MONTH FROM v_session_date);

  IF NOT FOUND THEN
    INSERT INTO trainer_workload_tracking (trainer_id, year, month, session_count)
    VALUES (
      NEW.trainer_id,
      EXTRACT(YEAR FROM v_session_date),
      EXTRACT(MONTH FROM v_session_date),
      1
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_trainer_assignment ON session_booking_trainers;
CREATE TRIGGER trigger_validate_trainer_assignment
  BEFORE INSERT ON session_booking_trainers
  FOR EACH ROW
  EXECUTE FUNCTION validate_trainer_assignment();

COMMENT ON FUNCTION validate_trainer_assignment IS 'Rule 2: Enforce trainer workload limit on assignment';

-- ============================================================================
-- TRIGGER: Update workload cache on trainer removal
-- ============================================================================
CREATE OR REPLACE FUNCTION update_workload_on_trainer_removal()
RETURNS TRIGGER AS $$
DECLARE
  v_session_date DATE;
BEGIN
  SELECT session_date INTO v_session_date
  FROM session_bookings
  WHERE id = OLD.booking_id;

  UPDATE trainer_workload_tracking
  SET session_count = GREATEST(0, session_count - 1), last_updated = now()
  WHERE trainer_id = OLD.trainer_id
  AND year = EXTRACT(YEAR FROM v_session_date)
  AND month = EXTRACT(MONTH FROM v_session_date);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workload_removal ON session_booking_trainers;
CREATE TRIGGER trigger_update_workload_removal
  AFTER DELETE ON session_booking_trainers
  FOR EACH ROW
  EXECUTE FUNCTION update_workload_on_trainer_removal();

-- ============================================================================
-- TABLE: session_materials
-- Materials uploaded for training sessions (Rule 3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.session_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.session_bookings(id) ON DELETE CASCADE,

  -- File information
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  storage_path TEXT,

  -- Metadata
  title TEXT,
  description TEXT,
  material_type TEXT CHECK (material_type IN ('presentation', 'handout', 'worksheet', 'video', 'other')),

  -- Approval workflow (Rule 3)
  uploaded_by UUID NOT NULL REFERENCES public.members(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),

  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'revision_requested')),
  approved_by UUID REFERENCES public.members(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Version tracking
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES public.session_materials(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_session_materials_booking ON session_materials(booking_id);
CREATE INDEX idx_session_materials_approval ON session_materials(approval_status);
CREATE INDEX idx_session_materials_uploaded_by ON session_materials(uploaded_by);

COMMENT ON TABLE session_materials IS 'Rule 3: Training materials with approval workflow';

-- Enable RLS
ALTER TABLE session_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Trainers can view materials for their sessions" ON session_materials
  FOR SELECT USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM session_booking_trainers sbt
      WHERE sbt.booking_id = session_materials.booking_id
      AND sbt.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Coordinators can view materials for their bookings" ON session_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_bookings sb
      WHERE sb.id = session_materials.booking_id
      AND sb.stakeholder_id = get_coordinator_stakeholder_id()
    )
    AND approval_status = 'approved'
  );

CREATE POLICY "Chair+ can view all materials" ON session_materials
  FOR SELECT USING (get_user_hierarchy_level() >= 3);

CREATE POLICY "Trainers can upload materials" ON session_materials
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM session_booking_trainers sbt
      WHERE sbt.booking_id = session_materials.booking_id
      AND sbt.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can update own pending materials" ON session_materials
  FOR UPDATE USING (
    uploaded_by = auth.uid()
    AND approval_status IN ('pending', 'revision_requested')
  );

CREATE POLICY "Chair+ can approve materials" ON session_materials
  FOR UPDATE USING (get_user_hierarchy_level() >= 4);

GRANT ALL ON session_materials TO authenticated;

-- ============================================================================
-- FUNCTION: validate_materials_deadline
-- Rule 3: Materials must be uploaded at least 3 days before session
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_materials_deadline(
  p_booking_id UUID
)
RETURNS TABLE(
  can_upload BOOLEAN,
  session_date DATE,
  days_until_session INTEGER,
  deadline_date DATE,
  message TEXT
) AS $$
DECLARE
  v_session_date DATE;
  v_days_until INTEGER;
  v_deadline DATE;
  v_min_days INTEGER := 3; -- Rule 3
BEGIN
  SELECT sb.session_date INTO v_session_date
  FROM session_bookings sb
  WHERE sb.id = p_booking_id;

  IF v_session_date IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::DATE, 0, NULL::DATE, 'Booking not found';
    RETURN;
  END IF;

  v_days_until := v_session_date - CURRENT_DATE;
  v_deadline := v_session_date - v_min_days;

  IF CURRENT_DATE > v_deadline THEN
    RETURN QUERY SELECT
      FALSE,
      v_session_date,
      v_days_until,
      v_deadline,
      format('Materials deadline has passed. Materials were due by %s (%s days before session)',
             v_deadline, v_min_days);
  ELSE
    RETURN QUERY SELECT
      TRUE,
      v_session_date,
      v_days_until,
      v_deadline,
      format('Materials can be uploaded. Deadline: %s (%s days remaining)',
             v_deadline, v_deadline - CURRENT_DATE);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.validate_materials_deadline IS 'Rule 3: Validate materials upload deadline';
GRANT EXECUTE ON FUNCTION public.validate_materials_deadline(UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: check_materials_approval_status
-- Gets the approval status summary for a booking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_materials_approval_status(
  p_booking_id UUID
)
RETURNS TABLE(
  total_materials INTEGER,
  approved_count INTEGER,
  pending_count INTEGER,
  rejected_count INTEGER,
  all_approved BOOLEAN,
  has_pending BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_materials,
    COUNT(*) FILTER (WHERE approval_status = 'approved')::INTEGER AS approved_count,
    COUNT(*) FILTER (WHERE approval_status IN ('pending', 'revision_requested'))::INTEGER AS pending_count,
    COUNT(*) FILTER (WHERE approval_status = 'rejected')::INTEGER AS rejected_count,
    COUNT(*) FILTER (WHERE approval_status != 'approved') = 0 AS all_approved,
    COUNT(*) FILTER (WHERE approval_status IN ('pending', 'revision_requested')) > 0 AS has_pending
  FROM session_materials
  WHERE booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.check_materials_approval_status IS 'Rule 3: Get materials approval summary';
GRANT EXECUTE ON FUNCTION public.check_materials_approval_status(UUID) TO authenticated;

-- ============================================================================
-- VIEW: trainer_availability_summary
-- Shows trainer availability for assignment
-- ============================================================================
CREATE VIEW trainer_availability_summary AS
SELECT
  m.id AS trainer_id,
  m.full_name AS trainer_name,
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month,
  COALESCE(tw.session_count, 0) AS sessions_this_month,
  6 AS max_sessions, -- Rule 2
  6 - COALESCE(tw.session_count, 0) AS available_slots,
  CASE
    WHEN COALESCE(tw.session_count, 0) >= 6 THEN 'unavailable'
    WHEN COALESCE(tw.session_count, 0) >= 4 THEN 'limited'
    ELSE 'available'
  END AS availability_status
FROM members m
LEFT JOIN trainer_workload_tracking tw ON m.id = tw.trainer_id
  AND tw.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND tw.month = EXTRACT(MONTH FROM CURRENT_DATE)
WHERE EXISTS (
  SELECT 1 FROM session_booking_trainers sbt
  WHERE sbt.trainer_id = m.id
) OR EXISTS (
  SELECT 1 FROM skill_will_assessments swa
  WHERE swa.member_id = m.id
  AND swa.category IN ('star', 'enthusiast')
);

COMMENT ON VIEW trainer_availability_summary IS 'Rule 2: Trainer availability for session assignment';
GRANT SELECT ON trainer_availability_summary TO authenticated;

-- ============================================================================
-- VIEW: materials_pending_approval
-- For Chair dashboard - materials awaiting approval
-- ============================================================================
CREATE VIEW materials_pending_approval AS
SELECT
  sm.id AS material_id,
  sm.booking_id,
  sm.title,
  sm.file_name,
  sm.material_type,
  sm.uploaded_at,
  m.full_name AS uploaded_by_name,
  sb.session_date,
  sb.session_date - CURRENT_DATE AS days_until_session,
  CASE
    WHEN sb.session_date - CURRENT_DATE <= 3 THEN 'urgent'
    WHEN sb.session_date - CURRENT_DATE <= 5 THEN 'warning'
    ELSE 'normal'
  END AS urgency
FROM session_materials sm
JOIN session_bookings sb ON sm.booking_id = sb.id
JOIN members m ON sm.uploaded_by = m.id
WHERE sm.approval_status IN ('pending', 'revision_requested')
AND sb.status NOT IN ('cancelled', 'rejected')
ORDER BY sb.session_date ASC;

COMMENT ON VIEW materials_pending_approval IS 'Rule 3: Materials awaiting Chair approval';
GRANT SELECT ON materials_pending_approval TO authenticated;

-- ============================================================================
-- TABLE: booking_restrictions
-- Configurable restrictions per stakeholder type
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.booking_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_type TEXT NOT NULL CHECK (stakeholder_type IN ('school', 'college', 'industry')),

  -- Timing restrictions
  min_advance_days INTEGER DEFAULT 7, -- Rule 1
  max_advance_days INTEGER DEFAULT 90,

  -- Booking limits
  max_bookings_per_month INTEGER DEFAULT 10,
  max_concurrent_pending INTEGER DEFAULT 3,

  -- Session restrictions
  min_session_duration INTEGER DEFAULT 60, -- minutes
  max_session_duration INTEGER DEFAULT 180, -- minutes
  allowed_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],

  -- Time slots
  earliest_start_time TIME DEFAULT '09:00',
  latest_end_time TIME DEFAULT '17:00',

  -- Special rules
  requires_mou BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(stakeholder_type)
);

-- Insert default restrictions
INSERT INTO booking_restrictions (stakeholder_type, min_advance_days, max_bookings_per_month, requires_mou)
VALUES
  ('school', 7, 10, FALSE),
  ('college', 7, 15, FALSE),
  ('industry', 7, 8, TRUE)
ON CONFLICT (stakeholder_type) DO NOTHING;

COMMENT ON TABLE booking_restrictions IS 'Configurable booking restrictions per stakeholder type';

-- Enable RLS
ALTER TABLE booking_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view restrictions" ON booking_restrictions
  FOR SELECT USING (TRUE);

CREATE POLICY "Only admin can modify restrictions" ON booking_restrictions
  FOR ALL USING (get_user_hierarchy_level() >= 5);

GRANT SELECT ON booking_restrictions TO authenticated;

-- ============================================================================
-- FUNCTION: get_booking_restrictions
-- Gets applicable restrictions for a stakeholder type
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_booking_restrictions(
  p_stakeholder_type TEXT
)
RETURNS TABLE(
  min_advance_days INTEGER,
  max_advance_days INTEGER,
  max_bookings_per_month INTEGER,
  max_concurrent_pending INTEGER,
  min_session_duration INTEGER,
  max_session_duration INTEGER,
  allowed_days TEXT[],
  earliest_start_time TIME,
  latest_end_time TIME,
  requires_mou BOOLEAN,
  requires_approval BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    br.min_advance_days,
    br.max_advance_days,
    br.max_bookings_per_month,
    br.max_concurrent_pending,
    br.min_session_duration,
    br.max_session_duration,
    br.allowed_days,
    br.earliest_start_time,
    br.latest_end_time,
    br.requires_mou,
    br.requires_approval
  FROM booking_restrictions br
  WHERE br.stakeholder_type = p_stakeholder_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_booking_restrictions IS 'Get booking restrictions for stakeholder type';
GRANT EXECUTE ON FUNCTION public.get_booking_restrictions(TEXT) TO authenticated;

-- ============================================================================
-- FUNCTION: validate_booking_request
-- Comprehensive validation of a booking request
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_booking_request(
  p_stakeholder_id UUID,
  p_stakeholder_type TEXT,
  p_session_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS TABLE(
  is_valid BOOLEAN,
  errors TEXT[]
) AS $$
DECLARE
  v_restrictions RECORD;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_days_until INTEGER;
  v_session_day TEXT;
  v_duration INTEGER;
  v_pending_count INTEGER;
  v_monthly_count INTEGER;
BEGIN
  -- Get restrictions
  SELECT * INTO v_restrictions
  FROM booking_restrictions
  WHERE stakeholder_type = p_stakeholder_type;

  -- Rule 1: Advance time check
  v_days_until := p_session_date - CURRENT_DATE;

  IF v_days_until < v_restrictions.min_advance_days THEN
    v_errors := array_append(v_errors,
      format('Sessions must be booked at least %s days in advance (selected date is %s days away)',
             v_restrictions.min_advance_days, v_days_until));
  END IF;

  IF v_days_until > v_restrictions.max_advance_days THEN
    v_errors := array_append(v_errors,
      format('Sessions cannot be booked more than %s days in advance',
             v_restrictions.max_advance_days));
  END IF;

  -- Day of week check
  v_session_day := LOWER(to_char(p_session_date, 'day'));
  v_session_day := TRIM(v_session_day);

  IF NOT v_session_day = ANY(v_restrictions.allowed_days) THEN
    v_errors := array_append(v_errors,
      format('Sessions are not allowed on %s', initcap(v_session_day)));
  END IF;

  -- Time range check
  IF p_start_time < v_restrictions.earliest_start_time THEN
    v_errors := array_append(v_errors,
      format('Sessions cannot start before %s', v_restrictions.earliest_start_time));
  END IF;

  IF p_end_time > v_restrictions.latest_end_time THEN
    v_errors := array_append(v_errors,
      format('Sessions must end by %s', v_restrictions.latest_end_time));
  END IF;

  -- Duration check
  v_duration := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;

  IF v_duration < v_restrictions.min_session_duration THEN
    v_errors := array_append(v_errors,
      format('Session must be at least %s minutes', v_restrictions.min_session_duration));
  END IF;

  IF v_duration > v_restrictions.max_session_duration THEN
    v_errors := array_append(v_errors,
      format('Session cannot exceed %s minutes', v_restrictions.max_session_duration));
  END IF;

  -- Concurrent pending check
  SELECT COUNT(*) INTO v_pending_count
  FROM session_bookings
  WHERE stakeholder_id = p_stakeholder_id
  AND status IN ('pending', 'pending_chair_approval');

  IF v_pending_count >= v_restrictions.max_concurrent_pending THEN
    v_errors := array_append(v_errors,
      format('Maximum of %s pending bookings allowed. Please wait for existing bookings to be processed.',
             v_restrictions.max_concurrent_pending));
  END IF;

  -- Monthly limit check
  SELECT COUNT(*) INTO v_monthly_count
  FROM session_bookings
  WHERE stakeholder_id = p_stakeholder_id
  AND EXTRACT(YEAR FROM session_date) = EXTRACT(YEAR FROM p_session_date)
  AND EXTRACT(MONTH FROM session_date) = EXTRACT(MONTH FROM p_session_date)
  AND status NOT IN ('cancelled', 'rejected');

  IF v_monthly_count >= v_restrictions.max_bookings_per_month THEN
    v_errors := array_append(v_errors,
      format('Maximum of %s bookings per month reached', v_restrictions.max_bookings_per_month));
  END IF;

  -- MoU check for industry
  IF v_restrictions.requires_mou AND p_stakeholder_type = 'industry' THEN
    IF NOT has_active_mou(p_stakeholder_id) THEN
      v_errors := array_append(v_errors,
        'Your organization does not have an active MoU. Please contact the chapter to establish an MoU.');
    END IF;
  END IF;

  RETURN QUERY SELECT
    array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0,
    v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.validate_booking_request IS 'Comprehensive booking validation with all rules';
GRANT EXECUTE ON FUNCTION public.validate_booking_request(UUID, TEXT, DATE, TIME, TIME) TO authenticated;

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE TRIGGER set_session_materials_updated_at
BEFORE UPDATE ON session_materials
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_booking_restrictions_updated_at
BEFORE UPDATE ON booking_restrictions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
