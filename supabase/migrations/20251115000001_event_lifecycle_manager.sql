--
-- Event Lifecycle Manager Module
-- Comprehensive event management with RSVPs, venues, volunteers, and reporting
--

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE event_status AS ENUM ('draft', 'published', 'ongoing', 'completed', 'cancelled');
CREATE TYPE event_category AS ENUM (
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
CREATE TYPE rsvp_status AS ENUM ('pending', 'confirmed', 'declined', 'waitlist', 'attended', 'no_show');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE volunteer_status AS ENUM ('invited', 'accepted', 'declined', 'completed');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Event Templates Table
CREATE TABLE IF NOT EXISTS public.event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category event_category NOT NULL,
  default_duration_hours INTEGER DEFAULT 2,
  default_capacity INTEGER,
  default_volunteer_roles JSONB DEFAULT '[]'::jsonb, -- [{"role": "Registration Desk", "count": 2}]
  checklist JSONB DEFAULT '[]'::jsonb, -- Pre-event checklist items
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Venues Table
CREATE TABLE IF NOT EXISTS public.venues (
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
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.chapters(id),
  template_id UUID REFERENCES public.event_templates(id),

  -- Basic Information
  title TEXT NOT NULL,
  description TEXT,
  category event_category NOT NULL,
  status event_status NOT NULL DEFAULT 'draft',

  -- Date & Time
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  registration_start_date TIMESTAMPTZ,
  registration_end_date TIMESTAMPTZ,

  -- Venue
  venue_id UUID REFERENCES public.venues(id),
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
CREATE TABLE IF NOT EXISTS public.venue_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  booking_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_booking_time CHECK (end_time > start_time)
);

-- Resources Table (Projectors, Chairs, Sound Systems, etc.)
CREATE TABLE IF NOT EXISTS public.resources (
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
CREATE TABLE IF NOT EXISTS public.resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event RSVPs Table (Member RSVPs)
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status rsvp_status NOT NULL DEFAULT 'pending',
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
CREATE TABLE IF NOT EXISTS public.guest_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_by_member_id UUID REFERENCES public.members(id),

  -- Guest Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  designation TEXT,

  status rsvp_status NOT NULL DEFAULT 'pending',
  dietary_restrictions TEXT,
  special_requirements TEXT,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Volunteer Roles Table
CREATE TABLE IF NOT EXISTS public.volunteer_roles (
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
CREATE TABLE IF NOT EXISTS public.event_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.volunteer_roles(id),
  role_name TEXT NOT NULL, -- Denormalized for flexibility
  status volunteer_status NOT NULL DEFAULT 'invited',
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
CREATE TABLE IF NOT EXISTS public.event_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_type TEXT NOT NULL CHECK (attendee_type IN ('member', 'guest')), -- 'member' or 'guest'
  attendee_id UUID NOT NULL, -- References either member_id or guest_rsvp_id
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by UUID REFERENCES auth.users(id),
  check_in_method TEXT CHECK (check_in_method IN ('qr_code', 'manual', 'self_checkin')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Feedback Table
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,

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
CREATE TABLE IF NOT EXISTS public.event_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS public.event_impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,

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
CREATE INDEX idx_events_chapter_id ON public.events(chapter_id);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_category ON public.events(category);
CREATE INDEX idx_events_start_date ON public.events(start_date);
CREATE INDEX idx_events_organizer_id ON public.events(organizer_id);
CREATE INDEX idx_events_featured ON public.events(is_featured) WHERE is_featured = true;

-- RSVPs indexes
CREATE INDEX idx_event_rsvps_event_id ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_member_id ON public.event_rsvps(member_id);
CREATE INDEX idx_event_rsvps_status ON public.event_rsvps(status);

-- Volunteers indexes
CREATE INDEX idx_event_volunteers_event_id ON public.event_volunteers(event_id);
CREATE INDEX idx_event_volunteers_member_id ON public.event_volunteers(member_id);
CREATE INDEX idx_event_volunteers_status ON public.event_volunteers(status);

-- Venue bookings indexes
CREATE INDEX idx_venue_bookings_venue_id ON public.venue_bookings(venue_id);
CREATE INDEX idx_venue_bookings_event_id ON public.venue_bookings(event_id);

-- Check-ins indexes
CREATE INDEX idx_event_checkins_event_id ON public.event_checkins(event_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_impact_metrics ENABLE ROW LEVEL SECURITY;

-- Event Templates Policies
CREATE POLICY "Anyone can view active event templates"
  ON public.event_templates FOR SELECT
  USING (true);

CREATE POLICY "Co-Chair and above can manage event templates"
  ON public.event_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

-- Venues Policies
CREATE POLICY "Anyone can view active venues"
  ON public.venues FOR SELECT
  USING (is_active = true);

CREATE POLICY "Co-Chair and above can manage venues"
  ON public.venues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

-- Events Policies
CREATE POLICY "Anyone can view published events in their chapter"
  ON public.events FOR SELECT
  USING (
    status IN ('published', 'ongoing', 'completed') OR
    organizer_id = auth.uid() OR
    auth.uid() = ANY(co_organizers) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Co-Chair and above can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Organizers and Co-Chair+ can update events"
  ON public.events FOR UPDATE
  USING (
    organizer_id = auth.uid() OR
    auth.uid() = ANY(co_organizers) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Executive and above can delete events"
  ON public.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 5
    )
  );

-- Event RSVPs Policies
CREATE POLICY "Members can view RSVPs for events they can see"
  ON public.event_rsvps FOR SELECT
  USING (
    member_id = (SELECT id FROM public.members WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.organizer_id = auth.uid() OR
        auth.uid() = ANY(e.co_organizers) OR
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
    )
  );

CREATE POLICY "Members can manage their own RSVPs"
  ON public.event_rsvps FOR ALL
  USING (member_id = (SELECT id FROM public.members WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())));

-- Event Volunteers Policies
CREATE POLICY "Members can view volunteer assignments"
  ON public.event_volunteers FOR SELECT
  USING (
    member_id = (SELECT id FROM public.members WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.organizer_id = auth.uid() OR
        auth.uid() = ANY(e.co_organizers) OR
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
    )
  );

CREATE POLICY "Event organizers can assign volunteers"
  ON public.event_volunteers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.organizer_id = auth.uid() OR
        auth.uid() = ANY(e.co_organizers) OR
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
    )
  );

CREATE POLICY "Volunteers can update their own status"
  ON public.event_volunteers FOR UPDATE
  USING (
    member_id = (SELECT id FROM public.members WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))
    )
  );

-- Event Feedback Policies
CREATE POLICY "Members can view non-anonymous feedback"
  ON public.event_feedback FOR SELECT
  USING (
    is_anonymous = false OR
    member_id = (SELECT id FROM public.members WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
    )
  );

CREATE POLICY "Members can submit feedback for events they attended"
  ON public.event_feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_rsvps
      WHERE event_id = event_feedback.event_id
        AND member_id = (SELECT id FROM public.members WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid()))
        AND status = 'attended'
    )
  );

-- Simplified policies for other tables (Co-Chair and above can manage)
CREATE POLICY "Co-Chair+ can manage venue bookings" ON public.venue_bookings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Co-Chair+ can manage resources" ON public.resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Anyone can view resources" ON public.resources FOR SELECT USING (is_active = true);

CREATE POLICY "Co-Chair+ can manage resource bookings" ON public.resource_bookings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Co-Chair+ can manage volunteer roles" ON public.volunteer_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Anyone can view volunteer roles" ON public.volunteer_roles FOR SELECT USING (is_active = true);

CREATE POLICY "Event organizers can manage check-ins" ON public.event_checkins FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))));

CREATE POLICY "Event organizers can manage guest RSVPs" ON public.guest_rsvps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND (e.organizer_id = auth.uid() OR auth.uid() = ANY(e.co_organizers))));

CREATE POLICY "Co-Chair+ can manage event documents" ON public.event_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

CREATE POLICY "Anyone can view public event documents" ON public.event_documents FOR SELECT USING (is_public = true);

CREATE POLICY "Co-Chair+ can view impact metrics" ON public.event_impact_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Check Venue Availability
CREATE OR REPLACE FUNCTION public.check_venue_availability(
  p_venue_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.venue_bookings
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
CREATE OR REPLACE FUNCTION public.calculate_event_impact(p_event_id UUID)
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
  FROM public.event_rsvps
  WHERE event_id = p_event_id AND status != 'declined';

  -- Count attendees
  SELECT COUNT(*) INTO v_members_attended
  FROM public.event_rsvps
  WHERE event_id = p_event_id AND status = 'attended';

  SELECT COUNT(*) INTO v_guests_attended
  FROM public.guest_rsvps
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
  FROM public.event_volunteers
  WHERE event_id = p_event_id AND status = 'completed';

  -- Calculate average rating
  SELECT AVG(overall_rating), COUNT(*)
  INTO v_avg_rating, v_feedback_count
  FROM public.event_feedback
  WHERE event_id = p_event_id AND overall_rating IS NOT NULL;

  -- Upsert impact metrics
  INSERT INTO public.event_impact_metrics (
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
CREATE OR REPLACE FUNCTION public.update_event_registrations_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.events
  SET current_registrations = (
    SELECT COUNT(*)
    FROM public.event_rsvps
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
      AND status IN ('confirmed', 'attended')
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_event_registrations
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.update_event_registrations_count();

-- Trigger: Auto-update engagement metrics when volunteer completes work
CREATE OR REPLACE FUNCTION public.update_member_engagement_on_volunteer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.engagement_metrics
    SET
      volunteer_hours = volunteer_hours + COALESCE(NEW.hours_contributed, 0),
      updated_at = now()
    WHERE member_id = NEW.member_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_engagement_on_volunteer
AFTER UPDATE ON public.event_volunteers
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.update_member_engagement_on_volunteer();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default volunteer roles
INSERT INTO public.volunteer_roles (name, description, responsibilities) VALUES
  ('Registration Desk', 'Manage event registration and check-ins', ARRAY['Welcome attendees', 'Verify registrations', 'Distribute name tags']),
  ('Hospitality', 'Ensure attendee comfort and satisfaction', ARRAY['Manage refreshments', 'Assist guests', 'Handle queries']),
  ('Photography', 'Document the event through photos and videos', ARRAY['Capture key moments', 'Take group photos', 'Share media post-event']),
  ('Technical Support', 'Manage audio-visual and technical needs', ARRAY['Setup equipment', 'Troubleshoot issues', 'Manage presentations']),
  ('Logistics Coordinator', 'Oversee event setup and breakdown', ARRAY['Arrange seating', 'Coordinate vendors', 'Manage supplies']),
  ('Social Media Manager', 'Handle live social media coverage', ARRAY['Post updates', 'Engage followers', 'Share highlights'])
ON CONFLICT (name) DO NOTHING;

-- Insert default resources
INSERT INTO public.resources (name, category, quantity_available, unit_cost) VALUES
  ('Projector', 'equipment', 2, 1000.00),
  ('Sound System', 'equipment', 1, 2500.00),
  ('Microphone', 'equipment', 4, 500.00),
  ('Chairs', 'furniture', 100, 50.00),
  ('Tables', 'furniture', 20, 200.00),
  ('Banners', 'supplies', 5, 300.00),
  ('Registration Desk', 'furniture', 2, 500.00)
ON CONFLICT DO NOTHING;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.check_venue_availability TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_event_impact TO authenticated;
