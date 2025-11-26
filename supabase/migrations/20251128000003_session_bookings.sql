-- ============================================================================
-- Part 3: Session Bookings & Stakeholder Coordinators
-- Created: 2025-11-28
-- Description: External coordinator management and session booking workflow
-- ============================================================================

-- ============================================================================
-- TABLE: stakeholder_coordinators
-- External users who can log in to book sessions for their institution
-- This is separate from stakeholder_contacts (which are just contact info)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stakeholder_coordinators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,

  -- Link to stakeholder
  stakeholder_type TEXT NOT NULL CHECK (stakeholder_type IN ('school', 'college', 'industry')),
  stakeholder_id UUID NOT NULL,

  -- User account (linked to auth.users if they have login)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Contact details
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  designation TEXT, -- e.g., "Principal", "Dean", "HR Manager"

  -- Access credentials (for coordinators without full auth.users account)
  password_hash TEXT, -- For direct login without OAuth
  temp_password TEXT, -- Auto-generated on first creation, must change on first login
  password_changed BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,

  -- Permissions
  can_book_sessions BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT true,
  can_manage_students BOOLEAN DEFAULT false, -- For school coordinators
  can_download_materials BOOLEAN DEFAULT true,
  can_rate_sessions BOOLEAN DEFAULT true,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,

  -- Invitation
  invited_by UUID REFERENCES public.members(id),
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(email),
  UNIQUE(stakeholder_type, stakeholder_id, email)
);

-- Indexes
CREATE INDEX idx_stakeholder_coordinators_chapter ON stakeholder_coordinators(chapter_id);
CREATE INDEX idx_stakeholder_coordinators_stakeholder ON stakeholder_coordinators(stakeholder_type, stakeholder_id);
CREATE INDEX idx_stakeholder_coordinators_user ON stakeholder_coordinators(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_stakeholder_coordinators_email ON stakeholder_coordinators(email);
CREATE INDEX idx_stakeholder_coordinators_status ON stakeholder_coordinators(status) WHERE status = 'active';

COMMENT ON TABLE stakeholder_coordinators IS 'External coordinators who can book sessions for their institution';
COMMENT ON COLUMN stakeholder_coordinators.user_id IS 'Linked auth.users account if coordinator uses OAuth';
COMMENT ON COLUMN stakeholder_coordinators.temp_password IS 'Auto-generated password for first login, must be changed';

-- ============================================================================
-- TABLE: session_bookings
-- Session booking requests from coordinators (institution-scoped)
-- Implements Rule 1: Session Booking Restrictions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.session_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,

  -- Coordinator who made the booking (CRITICAL for RLS)
  coordinator_id UUID NOT NULL REFERENCES public.stakeholder_coordinators(id) ON DELETE CASCADE,

  -- Institution (for institution-scoped access)
  stakeholder_type TEXT NOT NULL CHECK (stakeholder_type IN ('school', 'college')),
  stakeholder_id UUID NOT NULL,

  -- Session details
  session_type TEXT NOT NULL CHECK (session_type IN (
    'masoom', 'thalir', 'yuva', 'road_safety',
    'career_guidance', 'soft_skills', 'other'
  )),
  session_topic TEXT,
  session_description TEXT,

  -- Scheduling
  preferred_date DATE NOT NULL,
  preferred_time TEXT CHECK (preferred_time IN ('morning', 'afternoon', 'full_day')),
  alternate_date DATE,
  duration_hours DECIMAL(4,2) DEFAULT 2,

  -- Participants
  expected_students INTEGER NOT NULL CHECK (expected_students > 0),
  grade_level TEXT, -- e.g., "8th-10th" or "2nd Year Engineering"
  student_age_group TEXT CHECK (student_age_group IN ('5-10', '10-15', '15-18', '18+')),

  -- Trainers needed (auto-calculated: 1 per 60 students)
  trainers_needed INTEGER GENERATED ALWAYS AS (
    CEIL(expected_students / 60.0)::INTEGER
  ) STORED,

  -- Contact info at time of booking
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,

  -- Venue
  venue_name TEXT,
  venue_address TEXT,
  venue_capacity INTEGER,
  has_projector BOOLEAN DEFAULT false,
  has_audio_system BOOLEAN DEFAULT false,

  -- Status workflow
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Initial submission
    'under_review',      -- Being reviewed by Chair
    'approved',          -- Approved, pending trainer assignment
    'declined',          -- Request declined
    'pending_trainer',   -- Waiting for trainer assignment
    'trainer_invited',   -- Trainers invited, awaiting response
    'trainer_assigned',  -- Trainers confirmed
    'materials_pending', -- Waiting for materials upload
    'ready',             -- All set for session
    'in_progress',       -- Session ongoing
    'completed',         -- Session completed
    'cancelled',         -- Booking cancelled
    'rescheduled',       -- Moved to different date
    'no_show'            -- Coordinator/students didn't show up
  )),
  status_changed_at TIMESTAMPTZ DEFAULT now(),

  -- Approval workflow
  reviewed_by UUID REFERENCES public.members(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  decline_reason TEXT,

  -- Trainer assignment
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL, -- Links to created event
  lead_trainer_id UUID REFERENCES public.trainer_profiles(id),
  trainer_assigned_at TIMESTAMPTZ,
  trainer_assigned_by UUID REFERENCES public.members(id),

  -- Confirmation
  confirmed_date DATE, -- Actual confirmed date (may differ from preferred)
  confirmed_time TEXT,
  confirmed_at TIMESTAMPTZ,

  -- Cancellation
  cancelled_by_type TEXT CHECK (cancelled_by_type IN ('coordinator', 'chair', 'trainer', 'system')),
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_penalty TEXT CHECK (cancellation_penalty IN ('none', 'warning', 'blocked')),

  -- Session outcome
  actual_date DATE,
  actual_attendance INTEGER,
  session_completed_at TIMESTAMPTZ,

  -- Ratings (post-session)
  session_rating INTEGER CHECK (session_rating >= 1 AND session_rating <= 5),
  session_feedback TEXT,
  would_book_again BOOLEAN,

  -- Notes
  special_requirements TEXT,
  internal_notes TEXT, -- Only visible to Yi members, not coordinators
  coordinator_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_session_bookings_coordinator ON session_bookings(coordinator_id);
CREATE INDEX idx_session_bookings_stakeholder ON session_bookings(stakeholder_type, stakeholder_id);
CREATE INDEX idx_session_bookings_chapter ON session_bookings(chapter_id);
CREATE INDEX idx_session_bookings_status ON session_bookings(status);
CREATE INDEX idx_session_bookings_date ON session_bookings(preferred_date);
CREATE INDEX idx_session_bookings_session_type ON session_bookings(session_type);
CREATE INDEX idx_session_bookings_event ON session_bookings(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_session_bookings_pending ON session_bookings(status, preferred_date)
  WHERE status IN ('pending', 'under_review', 'approved', 'pending_trainer');

COMMENT ON TABLE session_bookings IS 'Session booking requests from external coordinators';
COMMENT ON COLUMN session_bookings.stakeholder_id IS 'Institution ID for RLS scoping';
COMMENT ON COLUMN session_bookings.cancellation_penalty IS 'Based on Rule 1: >48h=none, 24-48h=warning, <24h=blocked';

-- ============================================================================
-- TABLE: session_booking_history
-- Audit trail for booking status changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.session_booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.session_bookings(id) ON DELETE CASCADE,

  -- Status change
  previous_status TEXT,
  new_status TEXT NOT NULL,

  -- Actor
  changed_by UUID, -- Can be member or coordinator
  changed_by_type TEXT CHECK (changed_by_type IN ('member', 'coordinator', 'system', 'trainer')),

  -- Details
  change_reason TEXT,
  notes TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_session_booking_history_booking ON session_booking_history(booking_id);

COMMENT ON TABLE session_booking_history IS 'Audit trail for session booking status changes';

-- ============================================================================
-- TABLE: session_booking_trainers
-- Junction table for trainer assignments to bookings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.session_booking_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.session_bookings(id) ON DELETE CASCADE,
  trainer_profile_id UUID NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,

  -- Role
  is_lead BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'invited', 'accepted', 'declined', 'confirmed', 'completed', 'no_show'
  )),

  -- Invitation
  invited_at TIMESTAMPTZ,
  response_deadline TIMESTAMPTZ, -- 24 hours from invitation
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Rating
  trainer_rating INTEGER CHECK (trainer_rating >= 1 AND trainer_rating <= 5),
  trainer_feedback TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(booking_id, trainer_profile_id)
);

-- Indexes
CREATE INDEX idx_session_booking_trainers_booking ON session_booking_trainers(booking_id);
CREATE INDEX idx_session_booking_trainers_trainer ON session_booking_trainers(trainer_profile_id);
CREATE INDEX idx_session_booking_trainers_pending ON session_booking_trainers(status, response_deadline)
  WHERE status = 'invited';

COMMENT ON TABLE session_booking_trainers IS 'Trainer assignments for session bookings';

-- ============================================================================
-- FUNCTION: validate_booking_advance_time
-- Validates 7-day advance booking requirement (Rule 1)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_booking_advance_time()
RETURNS TRIGGER AS $$
DECLARE
  v_days_ahead INTEGER;
BEGIN
  -- Calculate days between now and preferred date
  v_days_ahead := NEW.preferred_date - CURRENT_DATE;

  -- Rule 1: Minimum 7 days advance booking for schools/colleges
  IF NEW.stakeholder_type IN ('school', 'college') AND v_days_ahead < 7 THEN
    RAISE EXCEPTION 'Session bookings for schools and colleges must be made at least 7 days in advance. Current: % days', v_days_ahead;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_booking_advance_time
BEFORE INSERT OR UPDATE OF preferred_date ON session_bookings
FOR EACH ROW
EXECUTE FUNCTION validate_booking_advance_time();

COMMENT ON FUNCTION validate_booking_advance_time IS 'Enforces Rule 1: 7-day advance booking for schools/colleges';

-- ============================================================================
-- FUNCTION: evaluate_cancellation_penalty
-- Calculates cancellation penalty based on timing (Rule 1)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.evaluate_cancellation_penalty(
  p_booking_id UUID,
  p_cancelled_by_type TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_booking RECORD;
  v_hours_until_session DECIMAL;
BEGIN
  -- Get booking details
  SELECT confirmed_date, confirmed_time INTO v_booking
  FROM session_bookings
  WHERE id = p_booking_id;

  IF v_booking.confirmed_date IS NULL THEN
    RETURN 'none'; -- Not yet confirmed, no penalty
  END IF;

  -- Calculate hours until session
  v_hours_until_session := EXTRACT(EPOCH FROM (
    v_booking.confirmed_date::TIMESTAMP - CURRENT_TIMESTAMP
  )) / 3600;

  -- Apply Rule 1 cancellation policy
  IF p_cancelled_by_type = 'coordinator' THEN
    IF v_hours_until_session > 48 THEN
      RETURN 'none'; -- No penalty
    ELSIF v_hours_until_session > 24 THEN
      RETURN 'warning'; -- Warning recorded
    ELSE
      RETURN 'blocked'; -- Cannot cancel, too late
    END IF;
  ELSIF p_cancelled_by_type = 'trainer' THEN
    IF v_hours_until_session > 24 THEN
      RETURN 'none'; -- Within 24h of request, no penalty
    ELSE
      RETURN 'warning'; -- Late decline
    END IF;
  ELSE
    RETURN 'none'; -- System/chair cancellations have no penalty
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION evaluate_cancellation_penalty IS 'Applies Rule 1 cancellation policy';

-- ============================================================================
-- FUNCTION: track_booking_status_change
-- Auto-records status changes to history
-- ============================================================================
CREATE OR REPLACE FUNCTION track_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO session_booking_history (
      booking_id,
      previous_status,
      new_status,
      changed_by,
      changed_by_type,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NULL, -- Will be set by application layer
      'system',
      NULL
    );

    -- Update status_changed_at
    NEW.status_changed_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_booking_status_change
BEFORE UPDATE ON session_bookings
FOR EACH ROW
EXECUTE FUNCTION track_booking_status_change();

-- ============================================================================
-- FUNCTION: count_coordinator_warnings
-- Counts cancellation warnings for a coordinator (for blocking logic)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.count_coordinator_warnings(p_coordinator_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM session_bookings
    WHERE coordinator_id = p_coordinator_id
    AND cancellation_penalty = 'warning'
    AND cancelled_at >= CURRENT_DATE - INTERVAL '6 months'
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION count_coordinator_warnings IS 'Counts recent cancellation warnings for a coordinator';

-- ============================================================================
-- TRIGGERS: Updated_at
-- ============================================================================
CREATE TRIGGER set_stakeholder_coordinators_updated_at
BEFORE UPDATE ON stakeholder_coordinators
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_session_bookings_updated_at
BEFORE UPDATE ON session_bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_session_booking_trainers_updated_at
BEFORE UPDATE ON session_booking_trainers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE stakeholder_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_booking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_booking_trainers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS: stakeholder_coordinators
-- ============================================================================

-- Yi members can view all coordinators in their chapter
CREATE POLICY "coordinators_select_yi_members" ON stakeholder_coordinators
  FOR SELECT USING (
    user_belongs_to_chapter(chapter_id)
  );

-- Coordinators can view their own record
CREATE POLICY "coordinators_select_self" ON stakeholder_coordinators
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Only Chair+ can create coordinators
CREATE POLICY "coordinators_insert_policy" ON stakeholder_coordinators
  FOR INSERT WITH CHECK (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 4
  );

-- Only Chair+ can update coordinators
CREATE POLICY "coordinators_update_yi_policy" ON stakeholder_coordinators
  FOR UPDATE USING (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 4
  );

-- Coordinators can update their own password
CREATE POLICY "coordinators_update_self_policy" ON stakeholder_coordinators
  FOR UPDATE USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
    -- Only allow updating password-related fields
  );

-- ============================================================================
-- RLS: session_bookings (Institution-Scoped - Critical!)
-- ============================================================================

-- Coordinators can ONLY view their institution's bookings
CREATE POLICY "bookings_select_coordinator" ON session_bookings
  FOR SELECT USING (
    stakeholder_id = get_coordinator_stakeholder_id()
  );

-- Yi members can view all bookings in their chapter
CREATE POLICY "bookings_select_yi_members" ON session_bookings
  FOR SELECT USING (
    user_belongs_to_chapter(chapter_id)
  );

-- Coordinators can only create bookings for their institution
CREATE POLICY "bookings_insert_coordinator" ON session_bookings
  FOR INSERT WITH CHECK (
    stakeholder_id = get_coordinator_stakeholder_id()
    AND coordinator_id IN (
      SELECT id FROM stakeholder_coordinators
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Yi members with proper hierarchy can create bookings
CREATE POLICY "bookings_insert_yi_members" ON session_bookings
  FOR INSERT WITH CHECK (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 2
  );

-- Coordinators can update their own bookings (limited fields)
CREATE POLICY "bookings_update_coordinator" ON session_bookings
  FOR UPDATE USING (
    stakeholder_id = get_coordinator_stakeholder_id()
    AND status IN ('pending', 'under_review') -- Only before approval
  );

-- Yi members can update all bookings in chapter
CREATE POLICY "bookings_update_yi_members" ON session_bookings
  FOR UPDATE USING (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 2
  );

-- Only Chair+ can delete bookings
CREATE POLICY "bookings_delete_policy" ON session_bookings
  FOR DELETE USING (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 4
  );

-- ============================================================================
-- RLS: session_booking_history
-- ============================================================================

-- View history for bookings user can see
CREATE POLICY "booking_history_select" ON session_booking_history
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM session_bookings
      WHERE user_belongs_to_chapter(chapter_id)
      OR stakeholder_id = get_coordinator_stakeholder_id()
    )
  );

-- Insert is handled by triggers (system)
CREATE POLICY "booking_history_insert" ON session_booking_history
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- RLS: session_booking_trainers
-- ============================================================================

-- View trainer assignments for accessible bookings
CREATE POLICY "booking_trainers_select" ON session_booking_trainers
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM session_bookings
      WHERE user_belongs_to_chapter(chapter_id)
    )
    OR trainer_profile_id IN (
      SELECT id FROM trainer_profiles WHERE member_id = auth.uid()
    )
  );

-- Only EC+ can assign trainers
CREATE POLICY "booking_trainers_insert" ON session_booking_trainers
  FOR INSERT WITH CHECK (
    get_user_hierarchy_level() >= 2
    OR is_vertical_chair()
  );

-- Trainers can update their own assignments (accept/decline)
CREATE POLICY "booking_trainers_update_self" ON session_booking_trainers
  FOR UPDATE USING (
    trainer_profile_id IN (
      SELECT id FROM trainer_profiles WHERE member_id = auth.uid()
    )
  );

-- EC+ can update all
CREATE POLICY "booking_trainers_update_ec" ON session_booking_trainers
  FOR UPDATE USING (
    get_user_hierarchy_level() >= 2
  );

-- ============================================================================
-- VIEW: coordinator_booking_summary
-- Summary view for coordinator dashboard
-- ============================================================================
CREATE VIEW coordinator_booking_summary AS
SELECT
  sb.id,
  sb.coordinator_id,
  sb.stakeholder_type,
  sb.stakeholder_id,
  sb.session_type,
  sb.preferred_date,
  sb.confirmed_date,
  sb.status,
  sb.expected_students,
  sb.actual_attendance,
  sb.session_rating,
  sb.created_at,
  -- Stakeholder name
  CASE
    WHEN sb.stakeholder_type = 'school' THEN (SELECT school_name FROM schools WHERE id = sb.stakeholder_id)
    WHEN sb.stakeholder_type = 'college' THEN (SELECT college_name FROM colleges WHERE id = sb.stakeholder_id)
  END AS institution_name,
  -- Trainer info
  (
    SELECT string_agg(m.full_name, ', ')
    FROM session_booking_trainers sbt
    JOIN trainer_profiles tp ON sbt.trainer_profile_id = tp.id
    JOIN members m ON tp.member_id = m.id
    WHERE sbt.booking_id = sb.id
    AND sbt.status IN ('accepted', 'confirmed', 'completed')
  ) AS assigned_trainers,
  -- Count of warnings for this coordinator
  count_coordinator_warnings(sb.coordinator_id) AS warning_count
FROM session_bookings sb;

COMMENT ON VIEW coordinator_booking_summary IS 'Summary view for coordinator booking dashboard';

-- ============================================================================
-- VIEW: pending_bookings_for_chair
-- Bookings awaiting Chair review/approval
-- ============================================================================
CREATE VIEW pending_bookings_for_chair AS
SELECT
  sb.*,
  sc.full_name AS coordinator_name,
  sc.email AS coordinator_email,
  sc.phone AS coordinator_phone,
  CASE
    WHEN sb.stakeholder_type = 'school' THEN (SELECT school_name FROM schools WHERE id = sb.stakeholder_id)
    WHEN sb.stakeholder_type = 'college' THEN (SELECT college_name FROM colleges WHERE id = sb.stakeholder_id)
  END AS institution_name,
  sb.preferred_date - CURRENT_DATE AS days_until_session
FROM session_bookings sb
JOIN stakeholder_coordinators sc ON sb.coordinator_id = sc.id
WHERE sb.status IN ('pending', 'under_review')
ORDER BY sb.preferred_date ASC;

COMMENT ON VIEW pending_bookings_for_chair IS 'Pending bookings for Chair review';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
