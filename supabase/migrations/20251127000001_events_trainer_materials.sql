--
-- Part 2: Events Module Enhancements
-- Smart event creation, trainer assignment, materials approval, post-session reports
--

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Trainer Assignment Status
CREATE TYPE trainer_assignment_status AS ENUM (
  'recommended',     -- Algorithm recommended this trainer
  'selected',        -- Selected for invitation
  'invited',         -- Invitation sent, awaiting response
  'accepted',        -- Trainer accepted
  'declined',        -- Trainer declined
  'confirmed',       -- Final confirmation
  'completed',       -- Session delivered
  'cancelled'        -- Assignment cancelled
);

-- Material Approval Status
CREATE TYPE material_approval_status AS ENUM (
  'draft',              -- Not yet submitted
  'pending_review',     -- Submitted for approval
  'approved',           -- Approved by Chair
  'revision_requested', -- Changes requested
  'superseded'          -- Replaced by newer version
);

-- Service Event Type
CREATE TYPE service_event_type AS ENUM (
  'masoom',
  'thalir',
  'yuva',
  'road_safety',
  'career_guidance',
  'soft_skills',
  'other'
);

-- Add 'school_services' to event_category if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'school_services' AND enumtypid = 'event_category'::regtype) THEN
    ALTER TYPE event_category ADD VALUE 'school_services';
  END IF;
END
$$;

-- ============================================================================
-- EXTEND EVENTS TABLE FOR SERVICE EVENTS
-- ============================================================================

-- Add service event fields to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_service_event BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS service_type service_event_type,
ADD COLUMN IF NOT EXISTS stakeholder_type TEXT CHECK (stakeholder_type IN ('school', 'college', 'industry', 'ngo', 'government')),
ADD COLUMN IF NOT EXISTS stakeholder_id UUID,
ADD COLUMN IF NOT EXISTS contact_person_name TEXT,
ADD COLUMN IF NOT EXISTS contact_person_phone TEXT,
ADD COLUMN IF NOT EXISTS contact_person_email TEXT,
ADD COLUMN IF NOT EXISTS expected_students INTEGER,
ADD COLUMN IF NOT EXISTS trainers_needed INTEGER GENERATED ALWAYS AS (
  CASE
    WHEN expected_students IS NULL OR expected_students = 0 THEN 0
    ELSE CEIL(expected_students / 60.0)::INTEGER
  END
) STORED;

-- Index for service events lookup
CREATE INDEX IF NOT EXISTS idx_events_service
ON public.events(is_service_event, service_type)
WHERE is_service_event = true;

CREATE INDEX IF NOT EXISTS idx_events_stakeholder
ON public.events(stakeholder_type, stakeholder_id)
WHERE stakeholder_id IS NOT NULL;

COMMENT ON COLUMN public.events.is_service_event IS 'True for Yi Service Events (Masoom, Thalir, etc.) requiring trainers';
COMMENT ON COLUMN public.events.service_type IS 'Type of service session for service events';
COMMENT ON COLUMN public.events.expected_students IS 'Expected number of students/participants for service events';
COMMENT ON COLUMN public.events.trainers_needed IS 'Auto-calculated: 1 trainer per 60 students';

-- ============================================================================
-- EVENT TRAINER ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_trainer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  trainer_profile_id UUID NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,

  -- Assignment Details
  status trainer_assignment_status NOT NULL DEFAULT 'recommended',
  is_lead_trainer BOOLEAN DEFAULT false,

  -- AI Scoring (from matching algorithm)
  match_score DECIMAL(5,2) CHECK (match_score >= 0 AND match_score <= 100),
  score_breakdown JSONB DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   "location_score": 30,      -- Max 30 points: Same city = 30, Adjacent < 20km = 20
  --   "distribution_score": 30,  -- Max 30 points: Days since last session (60+ = 30, <7 = 0)
  --   "performance_score": 25,   -- Max 25 points: Based on average rating
  --   "engagement_score": 15     -- Max 15 points: Yi attendance score
  -- }

  -- Assignment Workflow
  assigned_by UUID REFERENCES public.members(id),
  assigned_at TIMESTAMPTZ,
  selection_method TEXT CHECK (selection_method IN ('auto', 'manual')),

  -- Response Tracking
  response_deadline TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Confirmation
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES public.members(id),

  -- Post-Session Feedback
  attendance_confirmed BOOLEAN,
  trainer_rating INTEGER CHECK (trainer_rating >= 1 AND trainer_rating <= 5),
  trainer_feedback TEXT,
  coordinator_rating INTEGER CHECK (coordinator_rating >= 1 AND coordinator_rating <= 5),
  coordinator_feedback TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_event_trainer UNIQUE (event_id, trainer_profile_id)
);

-- Indexes
CREATE INDEX idx_event_trainer_event ON public.event_trainer_assignments(event_id);
CREATE INDEX idx_event_trainer_trainer ON public.event_trainer_assignments(trainer_profile_id);
CREATE INDEX idx_event_trainer_status ON public.event_trainer_assignments(status);
CREATE INDEX idx_event_trainer_pending ON public.event_trainer_assignments(response_deadline)
  WHERE status = 'invited';
CREATE INDEX idx_event_trainer_confirmed ON public.event_trainer_assignments(event_id, status)
  WHERE status IN ('accepted', 'confirmed', 'completed');

COMMENT ON TABLE public.event_trainer_assignments IS 'Trainer assignments for service events with AI-based scoring';

-- ============================================================================
-- EVENT MATERIALS TABLE (Multi-version with approval workflow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  trainer_assignment_id UUID REFERENCES public.event_trainer_assignments(id) ON DELETE SET NULL,

  -- Material Details
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT NOT NULL CHECK (material_type IN (
    'presentation', 'handout', 'worksheet', 'video',
    'assessment', 'certificate_template', 'other'
  )),

  -- File Information
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_kb INTEGER,
  mime_type TEXT,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  parent_material_id UUID REFERENCES public.event_materials(id) ON DELETE SET NULL,
  version_notes TEXT,

  -- Approval Workflow
  status material_approval_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES public.members(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.members(id),
  review_notes TEXT,
  rejection_reason TEXT,

  -- Visibility & Access
  is_coordinator_visible BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,

  -- Reusability
  is_template BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  tags TEXT[],

  -- Upload tracking
  uploaded_by UUID NOT NULL REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_event_materials_event ON public.event_materials(event_id);
CREATE INDEX idx_event_materials_trainer ON public.event_materials(trainer_assignment_id);
CREATE INDEX idx_event_materials_status ON public.event_materials(status);
CREATE INDEX idx_event_materials_current ON public.event_materials(event_id, is_current_version)
  WHERE is_current_version = true;
CREATE INDEX idx_event_materials_templates ON public.event_materials(material_type, is_template)
  WHERE is_template = true;
CREATE INDEX idx_event_materials_approved ON public.event_materials(event_id, status)
  WHERE status = 'approved';

COMMENT ON TABLE public.event_materials IS 'Training materials with multi-version support and Chair/Vertical Chair approval workflow';

-- ============================================================================
-- EVENT SESSION REPORTS TABLE (Post-session reporting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  trainer_assignment_id UUID REFERENCES public.event_trainer_assignments(id) ON DELETE SET NULL,

  -- Attendance Counts
  expected_attendance INTEGER,
  actual_attendance INTEGER NOT NULL,
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  staff_present INTEGER DEFAULT 0,

  -- Class/Grade Breakdown (for school sessions)
  class_breakdown JSONB DEFAULT '{}'::jsonb,
  -- Structure: {"class_8": 30, "class_9": 25, "class_10": 35}

  -- Session Timing
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  actual_duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN actual_start_time IS NOT NULL AND actual_end_time IS NOT NULL THEN
        EXTRACT(EPOCH FROM (actual_end_time - actual_start_time))::INTEGER / 60
      ELSE NULL
    END
  ) STORED,
  topics_covered TEXT[],

  -- Venue/Logistics Assessment
  venue_condition TEXT CHECK (venue_condition IN ('excellent', 'good', 'adequate', 'poor')),
  av_equipment_worked BOOLEAN DEFAULT true,
  logistical_issues TEXT,

  -- Impact Assessment
  engagement_level TEXT CHECK (engagement_level IN ('very_high', 'high', 'moderate', 'low', 'very_low')),
  knowledge_retention_score INTEGER CHECK (knowledge_retention_score >= 1 AND knowledge_retention_score <= 10),
  behavioral_change_observed TEXT,

  -- Coordinator/Host Feedback
  coordinator_name TEXT,
  coordinator_feedback TEXT,
  coordinator_rating INTEGER CHECK (coordinator_rating >= 1 AND coordinator_rating <= 5),
  willing_to_host_again BOOLEAN,

  -- Follow-up Requirements
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  follow_up_date DATE,
  follow_up_completed BOOLEAN DEFAULT false,
  follow_up_completed_at TIMESTAMPTZ,

  -- Evidence/Attachments
  photo_urls TEXT[],
  attendance_sheet_url TEXT,
  certificate_distribution_url TEXT,

  -- Trainer Notes
  trainer_notes TEXT,
  highlights TEXT,
  challenges_faced TEXT,
  recommendations TEXT,
  best_practices_noted TEXT,

  -- Submission
  submitted_by UUID NOT NULL REFERENCES public.members(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  verified_by UUID REFERENCES public.members(id),
  verified_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_session_reports_event ON public.event_session_reports(event_id);
CREATE INDEX idx_session_reports_trainer ON public.event_session_reports(trainer_assignment_id);
CREATE INDEX idx_session_reports_followup ON public.event_session_reports(follow_up_date)
  WHERE follow_up_required = true AND follow_up_completed = false;
CREATE INDEX idx_session_reports_submitted ON public.event_session_reports(submitted_at DESC);

COMMENT ON TABLE public.event_session_reports IS 'Post-session reports for service events with attendance, impact metrics, and feedback';

-- ============================================================================
-- EVENT CARPOOL MATCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_carpool_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Driver
  driver_rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  driver_member_id UUID NOT NULL REFERENCES public.members(id),

  -- Passenger
  passenger_rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  passenger_member_id UUID NOT NULL REFERENCES public.members(id),

  -- Match Status
  match_status TEXT NOT NULL DEFAULT 'proposed' CHECK (match_status IN (
    'proposed',      -- System suggested match
    'accepted',      -- Both parties confirmed
    'declined',      -- One party declined
    'cancelled',     -- Cancelled after acceptance
    'completed'      -- Ride completed
  )),

  -- Communication
  proposed_at TIMESTAMPTZ DEFAULT now(),
  driver_confirmed_at TIMESTAMPTZ,
  passenger_confirmed_at TIMESTAMPTZ,

  -- Pickup Details
  agreed_pickup_location TEXT,
  agreed_pickup_time TIME,
  pickup_notes TEXT,

  -- Post-Ride
  ride_completed BOOLEAN,
  driver_feedback TEXT,
  passenger_feedback TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_carpool_match UNIQUE (event_id, driver_rsvp_id, passenger_rsvp_id),
  CONSTRAINT different_members CHECK (driver_member_id != passenger_member_id)
);

-- Indexes
CREATE INDEX idx_carpool_event ON public.event_carpool_matches(event_id);
CREATE INDEX idx_carpool_driver ON public.event_carpool_matches(driver_rsvp_id);
CREATE INDEX idx_carpool_passenger ON public.event_carpool_matches(passenger_rsvp_id);
CREATE INDEX idx_carpool_status ON public.event_carpool_matches(match_status);

COMMENT ON TABLE public.event_carpool_matches IS 'Carpool matching between members offering and needing rides for events';

-- ============================================================================
-- ADD CARPOOL FIELDS TO EVENT_RSVPS (if not exist)
-- ============================================================================

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS travel_preference TEXT CHECK (travel_preference IN ('own_vehicle', 'need_ride', 'arrange_own', 'not_applicable')),
ADD COLUMN IF NOT EXISTS available_seats INTEGER,
ADD COLUMN IF NOT EXISTS pickup_location TEXT,
ADD COLUMN IF NOT EXISTS pickup_notes TEXT;

-- ============================================================================
-- TRAINER SCORING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_event_trainer_score(
  p_trainer_profile_id UUID,
  p_event_id UUID,
  p_event_city TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_trainer RECORD;
  v_member RECORD;
  v_event RECORD;
  v_location_score INTEGER := 0;
  v_distribution_score INTEGER := 0;
  v_performance_score INTEGER := 0;
  v_engagement_score INTEGER := 0;
  v_total_score DECIMAL(5,2);
  v_days_since_last INTEGER;
BEGIN
  -- Get trainer profile with stats
  SELECT * INTO v_trainer
  FROM public.trainer_profiles
  WHERE id = p_trainer_profile_id;

  IF v_trainer IS NULL THEN
    RETURN jsonb_build_object('error', 'Trainer not found');
  END IF;

  -- Get member details for engagement score
  SELECT * INTO v_member
  FROM public.members
  WHERE id = v_trainer.member_id;

  -- Get event details
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  -- 1. LOCATION SCORE (30 points max)
  -- For now, assume same chapter = same city = 30 points
  -- TODO: Implement actual distance calculation when city data available
  IF v_trainer.chapter_id = v_event.chapter_id THEN
    v_location_score := 30;
  ELSE
    v_location_score := 10;
  END IF;

  -- 2. FAIR DISTRIBUTION SCORE (30 points max)
  -- Based on days since last session
  v_days_since_last := COALESCE(v_trainer.days_since_last_session, 365);

  IF v_days_since_last >= 60 THEN
    v_distribution_score := 30;
  ELSIF v_days_since_last >= 30 THEN
    v_distribution_score := 20;
  ELSIF v_days_since_last >= 14 THEN
    v_distribution_score := 10;
  ELSIF v_days_since_last >= 7 THEN
    v_distribution_score := 5;
  ELSE
    v_distribution_score := 0;
  END IF;

  -- 3. PERFORMANCE SCORE (25 points max)
  -- Based on average rating
  IF v_trainer.average_rating IS NULL THEN
    v_performance_score := 15; -- Default for new trainers
  ELSIF v_trainer.average_rating >= 4.5 THEN
    v_performance_score := 25;
  ELSIF v_trainer.average_rating >= 4.0 THEN
    v_performance_score := 20;
  ELSIF v_trainer.average_rating >= 3.5 THEN
    v_performance_score := 15;
  ELSIF v_trainer.average_rating >= 3.0 THEN
    v_performance_score := 10;
  ELSE
    v_performance_score := 5;
  END IF;

  -- 4. ENGAGEMENT SCORE (15 points max)
  -- Based on Yi activity attendance
  IF v_member IS NOT NULL AND v_member.engagement_score IS NOT NULL THEN
    IF v_member.engagement_score >= 80 THEN
      v_engagement_score := 15;
    ELSIF v_member.engagement_score >= 60 THEN
      v_engagement_score := 10;
    ELSIF v_member.engagement_score >= 40 THEN
      v_engagement_score := 5;
    ELSE
      v_engagement_score := 0;
    END IF;
  ELSE
    v_engagement_score := 8; -- Default
  END IF;

  -- Calculate total
  v_total_score := v_location_score + v_distribution_score + v_performance_score + v_engagement_score;

  RETURN jsonb_build_object(
    'total_score', v_total_score,
    'breakdown', jsonb_build_object(
      'location_score', v_location_score,
      'distribution_score', v_distribution_score,
      'performance_score', v_performance_score,
      'engagement_score', v_engagement_score
    ),
    'trainer_stats', jsonb_build_object(
      'days_since_last_session', v_days_since_last,
      'average_rating', v_trainer.average_rating,
      'total_sessions', v_trainer.total_sessions,
      'sessions_this_month', v_trainer.sessions_this_month
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_event_trainer_score IS 'Calculate trainer match score for event assignment (100 points max)';

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to new tables
DROP TRIGGER IF EXISTS update_event_trainer_assignments_updated_at ON public.event_trainer_assignments;
CREATE TRIGGER update_event_trainer_assignments_updated_at
  BEFORE UPDATE ON public.event_trainer_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_materials_updated_at ON public.event_materials;
CREATE TRIGGER update_event_materials_updated_at
  BEFORE UPDATE ON public.event_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_session_reports_updated_at ON public.event_session_reports;
CREATE TRIGGER update_event_session_reports_updated_at
  BEFORE UPDATE ON public.event_session_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_carpool_matches_updated_at ON public.event_carpool_matches;
CREATE TRIGGER update_event_carpool_matches_updated_at
  BEFORE UPDATE ON public.event_carpool_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER: Update trainer stats when assignment completed
-- ============================================================================

CREATE OR REPLACE FUNCTION update_trainer_stats_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Update trainer profile stats
    UPDATE public.trainer_profiles
    SET
      total_sessions = total_sessions + 1,
      last_session_date = CURRENT_DATE,
      days_since_last_session = 0,
      updated_at = now()
    WHERE id = NEW.trainer_profile_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_trainer_stats ON public.event_trainer_assignments;
CREATE TRIGGER trigger_update_trainer_stats
  AFTER INSERT OR UPDATE ON public.event_trainer_assignments
  FOR EACH ROW EXECUTE FUNCTION update_trainer_stats_on_completion();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.event_trainer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpool_matches ENABLE ROW LEVEL SECURITY;

-- Event Trainer Assignments Policies
CREATE POLICY "Users can view trainer assignments for events they can see"
  ON public.event_trainer_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_trainer_assignments.event_id
      AND (
        e.status IN ('published', 'ongoing', 'completed')
        OR e.organizer_id = auth.uid()
        OR auth.uid() = ANY(e.co_organizers)
      )
    )
  );

CREATE POLICY "Event organizers can manage trainer assignments"
  ON public.event_trainer_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_trainer_assignments.event_id
      AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

CREATE POLICY "Trainers can view their own assignments"
  ON public.event_trainer_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_profiles tp
      WHERE tp.id = event_trainer_assignments.trainer_profile_id
      AND tp.member_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can respond to their assignments"
  ON public.event_trainer_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_profiles tp
      WHERE tp.id = event_trainer_assignments.trainer_profile_id
      AND tp.member_id = auth.uid()
    )
  );

-- Event Materials Policies
CREATE POLICY "Users can view approved materials for events they can see"
  ON public.event_materials FOR SELECT
  TO authenticated
  USING (
    status = 'approved' OR uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_materials.event_id
      AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

CREATE POLICY "Trainers can manage their own materials"
  ON public.event_materials FOR ALL
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Event organizers can review materials"
  ON public.event_materials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_materials.event_id
      AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

-- Event Session Reports Policies
CREATE POLICY "Users can view reports for completed events"
  ON public.event_session_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_session_reports.event_id
      AND e.status = 'completed'
    )
  );

CREATE POLICY "Trainers and organizers can manage session reports"
  ON public.event_session_reports FOR ALL
  TO authenticated
  USING (
    submitted_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_session_reports.event_id
      AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

-- Carpool Matches Policies
CREATE POLICY "Users can view carpool matches for events they RSVP'd to"
  ON public.event_carpool_matches FOR SELECT
  TO authenticated
  USING (
    driver_member_id = auth.uid() OR
    passenger_member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_carpool_matches.event_id
      AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

CREATE POLICY "Members can manage their carpool participation"
  ON public.event_carpool_matches FOR UPDATE
  TO authenticated
  USING (driver_member_id = auth.uid() OR passenger_member_id = auth.uid());

CREATE POLICY "Event organizers can manage carpool matches"
  ON public.event_carpool_matches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_carpool_matches.event_id
      AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON public.event_trainer_assignments TO authenticated;
GRANT ALL ON public.event_materials TO authenticated;
GRANT ALL ON public.event_session_reports TO authenticated;
GRANT ALL ON public.event_carpool_matches TO authenticated;
