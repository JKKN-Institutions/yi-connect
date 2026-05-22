-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Events module lifted to yi_connect.* (Batch 5, revised)
--
-- Combines 2 migrations:
--   - 20250119000002 add_eligibility_calculation
--   - 20251115000001 event_lifecycle_manager
--
-- DEFERRED to later batch (after Stakeholder CRM):
--   - 20251127000001 events_trainer_materials (needs trainer_profiles)
--   - 20251127000002 industry_opportunities (needs industries)
-- ═══════════════════════════════════════════════════════════════════════


-- ── 20250119000002_add_eligibility_calculation.sql ─────────────────────────────────
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

-- ── 20251115000001_event_lifecycle_manager.sql ─────────────────────────────────
--
-- Event Lifecycle Manager Module
-- Comprehensive event management with RSVPs, venues, volunteers, and reporting
--

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE yi_connect.event_status AS ENUM ('draft', 'published', 'ongoing', 'completed', 'cancelled');
CREATE TYPE yi_connect.event_category AS ENUM (
  'networking',
  'social',
  'professional_development',
  'community_service',
  'sports',
  'cultural',
  'fundraising',
  'workshop',
  'seminar',
  'conference',
  'webinar',
  'other'
);
CREATE TYPE yi_connect.rsvp_status AS ENUM ('pending', 'confirmed', 'declined', 'waitlist', 'attended', 'no_show');
CREATE TYPE yi_connect.booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE yi_connect.volunteer_status AS ENUM ('invited', 'accepted', 'declined', 'completed');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Event Templates Table
CREATE TABLE IF NOT EXISTS yi_connect.event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category yi_connect.event_category NOT NULL,
  default_duration_hours INTEGER DEFAULT 2,
  default_capacity INTEGER,
  default_volunteer_roles JSONB DEFAULT '[]'::jsonb, -- [{"role": "Registration Desk", "count": 2}]
  checklist JSONB DEFAULT '[]'::jsonb, -- Pre-event checklist items
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Venues Table
CREATE TABLE IF NOT EXISTS yi_connect.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  pincode TEXT,
  capacity INTEGER,
  amenities TEXT[], -- ['projector', 'sound_system', 'parking', 'ac']
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  booking_link TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events Table
CREATE TABLE IF NOT EXISTS yi_connect.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id),
  template_id UUID REFERENCES yi_connect.event_templates(id),

  -- Basic Information
  title TEXT NOT NULL,
  description TEXT,
  category yi_connect.event_category NOT NULL,
  status yi_connect.event_status NOT NULL DEFAULT 'draft',

  -- Date & Time
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  registration_start_date TIMESTAMPTZ,
  registration_end_date TIMESTAMPTZ,

  -- Venue
  venue_id UUID REFERENCES yi_connect.venues(id),
  venue_address TEXT, -- Custom address if not using venue table
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  virtual_meeting_link TEXT,

  -- Capacity
  max_capacity INTEGER,
  current_registrations INTEGER NOT NULL DEFAULT 0,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Organizers
  organizer_id UUID REFERENCES auth.users(id),
  co_organizers UUID[], -- Array of user IDs

  -- Budget & Finance (to be linked with Finance module)
  estimated_budget DECIMAL(10, 2),
  actual_expense DECIMAL(10, 2) DEFAULT 0,

  -- Settings
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  send_reminders BOOLEAN NOT NULL DEFAULT true,
  allow_guests BOOLEAN NOT NULL DEFAULT false,
  guest_limit INTEGER DEFAULT 0,

  -- Attachments
  banner_image_url TEXT,
  attachment_urls TEXT[],

  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT valid_registration_dates CHECK (
    registration_start_date IS NULL OR
    registration_end_date IS NULL OR
    registration_end_date > registration_start_date
  )
);

-- Venue Bookings Table
CREATE TABLE IF NOT EXISTS yi_connect.venue_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES yi_connect.venues(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status yi_connect.booking_status NOT NULL DEFAULT 'pending',
  booking_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_booking_time CHECK (end_time > start_time)
);

-- Resources Table (Projectors, Chairs, Sound Systems, etc.)
CREATE TABLE IF NOT EXISTS yi_connect.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'equipment', 'furniture', 'supplies'
  quantity_available INTEGER NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resource Bookings Table
CREATE TABLE IF NOT EXISTS yi_connect.resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES yi_connect.resources(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event RSVPs Table (Member RSVPs)
CREATE TABLE IF NOT EXISTS yi_connect.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  status yi_connect.rsvp_status NOT NULL DEFAULT 'pending',
  guests_count INTEGER NOT NULL DEFAULT 0,
  dietary_restrictions TEXT,
  special_requirements TEXT,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(event_id, member_id)
);

-- Guest RSVPs Table (Non-member guests)
CREATE TABLE IF NOT EXISTS yi_connect.guest_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  invited_by_member_id UUID REFERENCES yi_connect.members(id),

  -- Guest Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  designation TEXT,

  status yi_connect.rsvp_status NOT NULL DEFAULT 'pending',
  dietary_restrictions TEXT,
  special_requirements TEXT,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Volunteer Roles Table
CREATE TABLE IF NOT EXISTS yi_connect.volunteer_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  required_skills TEXT[], -- Array of skill names
  responsibilities TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Volunteers Table
CREATE TABLE IF NOT EXISTS yi_connect.event_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  role_id UUID REFERENCES yi_connect.volunteer_roles(id),
  role_name TEXT NOT NULL, -- Denormalized for flexibility
  status yi_connect.volunteer_status NOT NULL DEFAULT 'invited',
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  hours_contributed DECIMAL(5, 2),
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(event_id, member_id, role_id)
);

-- Event Check-ins Table (QR Code / Manual Check-in)
CREATE TABLE IF NOT EXISTS yi_connect.event_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  attendee_type TEXT NOT NULL CHECK (attendee_type IN ('member', 'guest')), -- 'member' or 'guest'
  attendee_id UUID NOT NULL, -- References either member_id or guest_rsvp_id
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by UUID REFERENCES auth.users(id),
  check_in_method TEXT CHECK (check_in_method IN ('qr_code', 'manual', 'self_checkin')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Feedback Table
CREATE TABLE IF NOT EXISTS yi_connect.event_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES yi_connect.members(id) ON DELETE SET NULL,

  -- Ratings (1-5)
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  content_rating INTEGER CHECK (content_rating >= 1 AND content_rating <= 5),
  venue_rating INTEGER CHECK (venue_rating >= 1 AND venue_rating <= 5),
  organization_rating INTEGER CHECK (organization_rating >= 1 AND organization_rating <= 5),

  -- Feedback
  what_went_well TEXT,
  what_could_improve TEXT,
  suggestions TEXT,
  would_attend_again BOOLEAN,

  -- Metadata
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Documents Table (Photos, Reports, Certificates)
CREATE TABLE IF NOT EXISTS yi_connect.event_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN ('photo', 'report', 'certificate', 'invoice', 'other')),
  file_url TEXT NOT NULL,
  file_size_kb INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Impact Metrics Table
CREATE TABLE IF NOT EXISTS yi_connect.event_impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE UNIQUE,

  -- Attendance Metrics
  total_registered INTEGER NOT NULL DEFAULT 0,
  total_attended INTEGER NOT NULL DEFAULT 0,
  members_attended INTEGER NOT NULL DEFAULT 0,
  guests_attended INTEGER NOT NULL DEFAULT 0,
  attendance_rate DECIMAL(5, 2), -- Percentage

  -- Engagement Metrics
  volunteers_count INTEGER NOT NULL DEFAULT 0,
  total_volunteer_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,

  -- Feedback Metrics
  average_rating DECIMAL(3, 2),
  feedback_count INTEGER NOT NULL DEFAULT 0,
  satisfaction_rate DECIMAL(5, 2), -- Percentage of positive feedback

  -- Financial Metrics (linked to Finance module later)
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  total_expense DECIMAL(10, 2) DEFAULT 0,
  net_profit DECIMAL(10, 2) DEFAULT 0,

  -- Social Impact
  beneficiaries_count INTEGER DEFAULT 0, -- For community service events
  social_impact_description TEXT,

  -- Calculated At
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Events indexes
CREATE INDEX idx_events_chapter_id ON yi_connect.events(chapter_id);
CREATE INDEX idx_events_status ON yi_connect.events(status);
CREATE INDEX idx_events_category ON yi_connect.events(category);
CREATE INDEX idx_events_start_date ON yi_connect.events(start_date);
CREATE INDEX idx_events_organizer_id ON yi_connect.events(organizer_id);
CREATE INDEX idx_events_featured ON yi_connect.events(is_featured) WHERE is_featured = true;

-- RSVPs indexes
CREATE INDEX idx_event_rsvps_event_id ON yi_connect.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_member_id ON yi_connect.event_rsvps(member_id);
CREATE INDEX idx_event_rsvps_status ON yi_connect.event_rsvps(status);

-- Volunteers indexes
CREATE INDEX idx_event_volunteers_event_id ON yi_connect.event_volunteers(event_id);
CREATE INDEX idx_event_volunteers_member_id ON yi_connect.event_volunteers(member_id);
CREATE INDEX idx_event_volunteers_status ON yi_connect.event_volunteers(status);

-- Venue bookings indexes
CREATE INDEX idx_venue_bookings_venue_id ON yi_connect.venue_bookings(venue_id);
CREATE INDEX idx_venue_bookings_event_id ON yi_connect.venue_bookings(event_id);

-- Check-ins indexes
CREATE INDEX idx_event_checkins_event_id ON yi_connect.event_checkins(event_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE yi_connect.event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.resource_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.guest_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.volunteer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.event_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.event_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.event_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.event_impact_metrics ENABLE ROW LEVEL SECURITY;

-- Event Templates Policies
CREATE POLICY "Anyone can view active event templates"
  ON yi_connect.event_templates FOR SELECT
  USING (true);

CREATE POLICY "Co-Chair and above can manage event templates"
  ON yi_connect.event_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

-- Venues Policies
CREATE POLICY "Anyone can view active venues"
  ON yi_connect.venues FOR SELECT
  USING (is_active = true);

CREATE POLICY "Co-Chair and above can manage venues"
  ON yi_connect.venues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

-- Events Policies
CREATE POLICY "Anyone can view published events in their chapter"
  ON yi_connect.events FOR SELECT
  USING (
    status IN ('published', 'ongoing', 'completed') OR
    organizer_id = auth.uid() OR
    auth.uid() = ANY(co_organizers) OR
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Co-Chair and above can create events"
  ON yi_connect.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Organizers and Co-Chair+ can update events"
  ON yi_connect.events FOR UPDATE
  USING (
    organizer_id = auth.uid() OR
    auth.uid() = ANY(co_organizers) OR
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Executive and above can delete events"
  ON yi_connect.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 5
    )
  );

-- Event RSVPs Policies
CREATE POLICY "Members can view RSVPs for events they can see"
  ON yi_connect.event_rsvps FOR SELECT
  USING (
    member_id = (SELECT id FROM yi_connect.members WHERE id = (SELECT id FROM yi_connect.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM yi_connect.events e
      WHERE e.id = event_id AND (
        e.organizer_id = auth.uid() OR
        auth.uid() = ANY(e.co_organizers) OR
        EXISTS (
          SELECT 1 FROM yi_connect.user_roles ur
          JOIN yi_connect.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
    )
  );

CREATE POLICY "Members can manage their own RSVPs"
  ON yi_connect.event_rsvps FOR ALL
  USING (member_id = (SELECT id FROM yi_connect.members WHERE id = (SELECT id FROM yi_connect.profiles WHERE id = auth.uid())));

-- Event Volunteers Policies
CREATE POLICY "Members can view volunteer assignments"
  ON yi_connect.event_volunteers FOR SELECT
  USING (
    member_id = (SELECT id FROM yi_connect.members WHERE id = (SELECT id FROM yi_connect.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM yi_connect.events e
      WHERE e.id = event_id AND (
        e.organizer_id = auth.uid() OR
        auth.uid() = ANY(e.co_organizers) OR
        EXISTS (
          SELECT 1 FROM yi_connect.user_roles ur
          JOIN yi_connect.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
    )
  );

CREATE POLICY "Event organizers can assign volunteers"
  ON yi_connect.event_volunteers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi_connect.events e
      WHERE e.id = event_id AND (
        e.organizer_id = auth.uid() OR
        auth.uid() = ANY(e.co_organizers) OR
        EXISTS (
          SELECT 1 FROM yi_connect.user_roles ur
          JOIN yi_connect.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
    )
  );

CREATE POLICY "Volunteers can update their own status"
  ON yi_connect.event_volunteers FOR UPDATE
  USING (
    member_id = (SELECT id FROM yi_connect.members WHERE id = (SELECT id FROM yi_connect.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM yi_connect.events e
      WHERE e.id = event_id AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

-- Event Feedback Policies
CREATE POLICY "Members can view non-anonymous feedback"
  ON yi_connect.event_feedback FOR SELECT
  USING (
    is_anonymous = false OR
    member_id = (SELECT id FROM yi_connect.members WHERE id = (SELECT id FROM yi_connect.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Members can submit feedback for events they attended"
  ON yi_connect.event_feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi_connect.event_rsvps
      WHERE event_id = event_feedback.event_id
        AND member_id = (SELECT id FROM yi_connect.members WHERE id = (SELECT id FROM yi_connect.profiles WHERE id = auth.uid()))
        AND status = 'attended'
    )
  );

-- Simplified policies for other tables (Co-Chair and above can manage)
CREATE POLICY "Co-Chair+ can manage venue bookings" ON yi_connect.venue_bookings FOR ALL
  USING (EXISTS (SELECT 1 FROM yi_connect.user_roles ur JOIN yi_connect.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Co-Chair+ can manage resources" ON yi_connect.resources FOR ALL
  USING (EXISTS (SELECT 1 FROM yi_connect.user_roles ur JOIN yi_connect.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Anyone can view resources" ON yi_connect.resources FOR SELECT USING (is_active = true);

CREATE POLICY "Co-Chair+ can manage resource bookings" ON yi_connect.resource_bookings FOR ALL
  USING (EXISTS (SELECT 1 FROM yi_connect.user_roles ur JOIN yi_connect.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Co-Chair+ can manage volunteer roles" ON yi_connect.volunteer_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM yi_connect.user_roles ur JOIN yi_connect.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Anyone can view volunteer roles" ON yi_connect.volunteer_roles FOR SELECT USING (is_active = true);

CREATE POLICY "Event organizers can manage check-ins" ON yi_connect.event_checkins FOR ALL
  USING (EXISTS (SELECT 1 FROM yi_connect.events e WHERE e.id = event_id AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))));

CREATE POLICY "Event organizers can manage guest RSVPs" ON yi_connect.guest_rsvps FOR ALL
  USING (EXISTS (SELECT 1 FROM yi_connect.events e WHERE e.id = event_id AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))));

CREATE POLICY "Co-Chair+ can manage event documents" ON yi_connect.event_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM yi_connect.user_roles ur JOIN yi_connect.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Anyone can view public event documents" ON yi_connect.event_documents FOR SELECT USING (is_public = true);

CREATE POLICY "Co-Chair+ can view impact metrics" ON yi_connect.event_impact_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM yi_connect.user_roles ur JOIN yi_connect.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Check Venue Availability
CREATE OR REPLACE FUNCTION yi_connect.check_venue_availability(
  p_venue_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM yi_connect.venue_bookings
    WHERE venue_id = p_venue_id
      AND status != 'cancelled'
      AND (id != p_exclude_booking_id OR p_exclude_booking_id IS NULL)
      AND (
        (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate Event Impact Metrics
CREATE OR REPLACE FUNCTION yi_connect.calculate_event_impact(p_event_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_registered INTEGER;
  v_total_attended INTEGER;
  v_members_attended INTEGER;
  v_guests_attended INTEGER;
  v_volunteers_count INTEGER;
  v_total_volunteer_hours DECIMAL(8, 2);
  v_avg_rating DECIMAL(3, 2);
  v_feedback_count INTEGER;
  v_attendance_rate DECIMAL(5, 2);
BEGIN
  -- Count registrations
  SELECT COUNT(*) INTO v_total_registered
  FROM yi_connect.event_rsvps
  WHERE event_id = p_event_id AND status != 'declined';

  -- Count attendees
  SELECT COUNT(*) INTO v_members_attended
  FROM yi_connect.event_rsvps
  WHERE event_id = p_event_id AND status = 'attended';

  SELECT COUNT(*) INTO v_guests_attended
  FROM yi_connect.guest_rsvps
  WHERE event_id = p_event_id AND status = 'attended';

  v_total_attended := v_members_attended + v_guests_attended;

  -- Calculate attendance rate
  IF v_total_registered > 0 THEN
    v_attendance_rate := (v_total_attended::DECIMAL / v_total_registered::DECIMAL) * 100;
  ELSE
    v_attendance_rate := 0;
  END IF;

  -- Count volunteers and hours
  SELECT COUNT(*), COALESCE(SUM(hours_contributed), 0)
  INTO v_volunteers_count, v_total_volunteer_hours
  FROM yi_connect.event_volunteers
  WHERE event_id = p_event_id AND status = 'completed';

  -- Calculate average rating
  SELECT AVG(overall_rating), COUNT(*)
  INTO v_avg_rating, v_feedback_count
  FROM yi_connect.event_feedback
  WHERE event_id = p_event_id AND overall_rating IS NOT NULL;

  -- Upsert impact metrics
  INSERT INTO yi_connect.event_impact_metrics (
    event_id,
    total_registered,
    total_attended,
    members_attended,
    guests_attended,
    attendance_rate,
    volunteers_count,
    total_volunteer_hours,
    average_rating,
    feedback_count,
    calculated_at,
    updated_at
  ) VALUES (
    p_event_id,
    v_total_registered,
    v_total_attended,
    v_members_attended,
    v_guests_attended,
    v_attendance_rate,
    v_volunteers_count,
    v_total_volunteer_hours,
    v_avg_rating,
    v_feedback_count,
    now(),
    now()
  )
  ON CONFLICT (event_id) DO UPDATE SET
    total_registered = EXCLUDED.total_registered,
    total_attended = EXCLUDED.total_attended,
    members_attended = EXCLUDED.members_attended,
    guests_attended = EXCLUDED.guests_attended,
    attendance_rate = EXCLUDED.attendance_rate,
    volunteers_count = EXCLUDED.volunteers_count,
    total_volunteer_hours = EXCLUDED.total_volunteer_hours,
    average_rating = EXCLUDED.average_rating,
    feedback_count = EXCLUDED.feedback_count,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update event current_registrations count
CREATE OR REPLACE FUNCTION yi_connect.update_event_registrations_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE yi_connect.events
  SET current_registrations = (
    SELECT COUNT(*)
    FROM yi_connect.event_rsvps
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
      AND status IN ('confirmed', 'attended')
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_event_registrations
AFTER INSERT OR UPDATE OR DELETE ON yi_connect.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_event_registrations_count();

-- Trigger: Auto-update engagement metrics when volunteer completes work
CREATE OR REPLACE FUNCTION yi_connect.update_member_engagement_on_volunteer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE yi_connect.engagement_metrics
    SET
      volunteer_hours = volunteer_hours + COALESCE(NEW.hours_contributed, 0),
      updated_at = now()
    WHERE member_id = NEW.member_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_engagement_on_volunteer
AFTER UPDATE ON yi_connect.event_volunteers
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION yi_connect.update_member_engagement_on_volunteer();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default volunteer roles
INSERT INTO yi_connect.volunteer_roles (name, description, responsibilities) VALUES
  ('Registration Desk', 'Manage event registration and check-ins', ARRAY['Welcome attendees', 'Verify registrations', 'Distribute name tags']),
  ('Hospitality', 'Ensure attendee comfort and satisfaction', ARRAY['Manage refreshments', 'Assist guests', 'Handle queries']),
  ('Photography', 'Document the event through photos and videos', ARRAY['Capture key moments', 'Take group photos', 'Share media post-event']),
  ('Technical Support', 'Manage audio-visual and technical needs', ARRAY['Setup equipment', 'Troubleshoot issues', 'Manage presentations']),
  ('Logistics Coordinator', 'Oversee event setup and breakdown', ARRAY['Arrange seating', 'Coordinate vendors', 'Manage supplies']),
  ('Social Media Manager', 'Handle live social media coverage', ARRAY['Post updates', 'Engage followers', 'Share highlights'])
ON CONFLICT (name) DO NOTHING;

-- Insert default resources
INSERT INTO yi_connect.resources (name, category, quantity_available, unit_cost) VALUES
  ('Projector', 'equipment', 2, 1000.00),
  ('Sound System', 'equipment', 1, 2500.00),
  ('Microphone', 'equipment', 4, 500.00),
  ('Chairs', 'furniture', 100, 50.00),
  ('Tables', 'furniture', 20, 200.00),
  ('Banners', 'supplies', 5, 300.00),
  ('Registration Desk', 'furniture', 2, 500.00)
ON CONFLICT DO NOTHING;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION yi_connect.check_venue_availability TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.calculate_event_impact TO authenticated;
