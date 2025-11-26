--
-- Part 2: Industry Opportunities Bidirectional System
-- Industry-posted opportunities, member applications, visit requests
--

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Opportunity Type
CREATE TYPE opportunity_type AS ENUM (
  'industrial_visit',
  'internship',
  'mentorship',
  'guest_lecture',
  'job_opening',
  'project_collaboration',
  'training_program',
  'sponsorship',
  'csr_partnership',
  'other'
);

-- Opportunity Status
CREATE TYPE opportunity_status AS ENUM (
  'draft',
  'published',
  'accepting_applications',
  'closed',
  'completed',
  'cancelled',
  'expired'
);

-- Application Status
CREATE TYPE application_status AS ENUM (
  'draft',
  'pending_review',
  'under_review',
  'shortlisted',
  'accepted',
  'waitlisted',
  'declined',
  'withdrawn'
);

-- Visit Request Status (multi-party workflow)
CREATE TYPE visit_request_status AS ENUM (
  'pending_yi_review',
  'yi_approved',
  'forwarded_to_industry',
  'industry_accepted',
  'industry_declined',
  'scheduled',
  'completed',
  'cancelled'
);

-- Visit Type
CREATE TYPE visit_type AS ENUM (
  'solo',
  'group'
);

-- Partnership Stage (for MoU lifecycle)
CREATE TYPE partnership_stage AS ENUM (
  'initial_contact',
  'negotiation',
  'active_collaboration',
  'renewal_phase',
  'dormant'
);

-- ============================================================================
-- INDUSTRY OPPORTUNITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.industry_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  industry_id UUID NOT NULL REFERENCES public.industries(id) ON DELETE CASCADE,

  -- Basic Information
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  opportunity_type opportunity_type NOT NULL,
  status opportunity_status NOT NULL DEFAULT 'draft',

  -- Schedule
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  duration_description TEXT, -- "3 months", "1 day visit", etc.
  application_deadline TIMESTAMPTZ NOT NULL,

  -- Capacity Management
  max_participants INTEGER,
  current_applications INTEGER DEFAULT 0,
  accepted_count INTEGER DEFAULT 0,
  positions_filled INTEGER DEFAULT 0,

  -- Eligibility Criteria (JSONB for flexibility)
  eligibility_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   "industries": ["manufacturing", "it_services"],
  --   "skills": ["uuid1", "uuid2"],
  --   "experience_levels": ["entry", "mid", "senior"],
  --   "min_experience_years": 2,
  --   "min_engagement_score": 50,
  --   "membership_types": ["active"],
  --   "custom_requirements": ["Must have valid passport"]
  -- }

  -- Location & Format
  location TEXT,
  is_remote BOOLEAN DEFAULT false,
  meeting_link TEXT,

  -- Compensation (for jobs/internships)
  is_paid BOOLEAN DEFAULT false,
  compensation_type TEXT CHECK (compensation_type IN ('paid', 'unpaid', 'stipend', 'honorarium')),
  compensation_details TEXT, -- "Rs. 10,000/month stipend"
  benefits TEXT[],

  -- Learning Outcomes
  learning_outcomes TEXT[],
  requirements TEXT[],
  what_to_bring TEXT[],

  -- Contact Information
  contact_person_name TEXT,
  contact_person_email TEXT,
  contact_person_phone TEXT,

  -- Media & Attachments
  banner_image_url TEXT,
  attachment_urls TEXT[],

  -- Visibility & Features
  is_featured BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'chapter' CHECK (visibility IN ('chapter', 'national', 'public')),
  tags TEXT[],

  -- Analytics
  view_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,

  -- Approval Workflow (if needed)
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.members(id),
  rejection_reason TEXT,

  -- Relevance Matching (for member suggestions)
  target_member_profiles TEXT[], -- business_types that would be interested
  relevance_tags TEXT[],

  -- Timestamps
  created_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(title, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      array_to_string(COALESCE(learning_outcomes, '{}'), ' ')
    )
  ) STORED
);

-- Indexes
CREATE INDEX idx_opportunities_chapter ON public.industry_opportunities(chapter_id);
CREATE INDEX idx_opportunities_industry ON public.industry_opportunities(industry_id);
CREATE INDEX idx_opportunities_status ON public.industry_opportunities(status);
CREATE INDEX idx_opportunities_type ON public.industry_opportunities(opportunity_type);
CREATE INDEX idx_opportunities_deadline ON public.industry_opportunities(application_deadline)
  WHERE status IN ('published', 'accepting_applications');
CREATE INDEX idx_opportunities_featured ON public.industry_opportunities(is_featured, published_at DESC)
  WHERE status = 'published';
CREATE INDEX idx_opportunities_search ON public.industry_opportunities USING gin(search_vector);
CREATE INDEX idx_opportunities_eligibility ON public.industry_opportunities USING gin(eligibility_criteria);

COMMENT ON TABLE public.industry_opportunities IS 'Opportunities posted by industries for Yi members';

-- ============================================================================
-- OPPORTUNITY APPLICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.industry_opportunities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  -- Match Score (calculated at application time)
  match_score DECIMAL(5,2) CHECK (match_score >= 0 AND match_score <= 100),
  match_breakdown JSONB DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   "industry_score": 80,
  --   "skills_score": 70,
  --   "experience_score": 90,
  --   "engagement_score": 85
  -- }

  -- Application Content
  motivation_statement TEXT NOT NULL,
  learning_goals TEXT,
  relevant_experience TEXT,

  -- Member Preferences
  transportation_preference TEXT CHECK (transportation_preference IN ('own_vehicle', 'need_carpool', 'public_transport')),
  dietary_preference TEXT,
  special_requirements TEXT,

  -- Attachments
  resume_url TEXT,
  portfolio_url TEXT,
  additional_documents TEXT[],

  -- Snapshot of member profile at application time (for audit)
  member_snapshot JSONB,

  -- Status Workflow
  status application_status NOT NULL DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ,
  status_changed_by UUID REFERENCES auth.users(id),

  -- Review Information
  reviewer_notes TEXT,
  priority_rank INTEGER, -- For sorting during bulk review
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),

  -- Interview (if applicable)
  interview_scheduled_at TIMESTAMPTZ,
  interview_location TEXT,
  interview_notes TEXT,
  interview_rating INTEGER CHECK (interview_rating >= 1 AND interview_rating <= 5),

  -- Outcome
  outcome_at TIMESTAMPTZ,
  outcome_notes TEXT, -- Feedback to applicant

  -- Notification tracking
  notification_sent_at TIMESTAMPTZ,

  -- Timestamps
  applied_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_member_opportunity UNIQUE (opportunity_id, member_id)
);

-- Indexes
CREATE INDEX idx_applications_opportunity ON public.opportunity_applications(opportunity_id);
CREATE INDEX idx_applications_member ON public.opportunity_applications(member_id);
CREATE INDEX idx_applications_status ON public.opportunity_applications(status);
CREATE INDEX idx_applications_match_score ON public.opportunity_applications(match_score DESC);
CREATE INDEX idx_applications_submitted ON public.opportunity_applications(applied_at DESC)
  WHERE status != 'draft';
CREATE INDEX idx_applications_pending ON public.opportunity_applications(opportunity_id, status)
  WHERE status = 'pending_review';

COMMENT ON TABLE public.opportunity_applications IS 'Member applications for industry opportunities with match scoring';

-- ============================================================================
-- MEMBER VISIT REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,

  -- Requestor
  requested_by UUID NOT NULL REFERENCES public.members(id),

  -- Target Industry (must have active MoU)
  industry_id UUID NOT NULL REFERENCES public.industries(id),
  mou_id UUID REFERENCES public.stakeholder_mous(id), -- Link to active MoU

  -- Request Details
  request_title TEXT NOT NULL,
  visit_purpose TEXT NOT NULL,
  visit_type visit_type NOT NULL DEFAULT 'solo',

  -- Preferred Dates (JSONB array for flexibility)
  preferred_dates JSONB NOT NULL,
  -- Structure: [{"date": "2025-01-15", "time_slot": "morning"}, ...]
  preferred_time_slot TEXT CHECK (preferred_time_slot IN ('morning', 'afternoon', 'full_day')),

  -- Group Details (if group visit)
  expected_participants INTEGER NOT NULL DEFAULT 1,
  participant_profile TEXT, -- "Young entrepreneurs in manufacturing"
  group_details TEXT, -- Names/details if group visit

  -- Additional Notes
  additional_notes TEXT,

  -- Status Workflow
  status visit_request_status NOT NULL DEFAULT 'pending_yi_review',

  -- Yi Review (Industry Chair)
  yi_reviewer_id UUID REFERENCES public.members(id),
  yi_reviewed_at TIMESTAMPTZ,
  yi_approval_notes TEXT,
  rejection_reason TEXT,

  -- Industry Response
  industry_contact_id UUID, -- From stakeholder_contacts
  industry_contacted_at TIMESTAMPTZ,
  industry_contacted_by UUID REFERENCES public.members(id),
  industry_responded_at TIMESTAMPTZ,
  industry_response_notes TEXT,

  -- Scheduled Visit
  scheduled_date DATE,
  scheduled_time TEXT,
  scheduled_duration TEXT, -- "2 hours", "Full day"
  visit_location TEXT,

  -- Conversion to Event (optional)
  converted_event_id UUID REFERENCES public.events(id),
  converted_at TIMESTAMPTZ,

  -- Completion & Feedback
  completed_at TIMESTAMPTZ,
  feedback TEXT,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),

  -- Interest Tracking (other members interested)
  interest_count INTEGER DEFAULT 1, -- Includes requestor

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_visit_requests_chapter ON public.member_visit_requests(chapter_id);
CREATE INDEX idx_visit_requests_member ON public.member_visit_requests(requested_by);
CREATE INDEX idx_visit_requests_industry ON public.member_visit_requests(industry_id);
CREATE INDEX idx_visit_requests_status ON public.member_visit_requests(status);
CREATE INDEX idx_visit_requests_pending ON public.member_visit_requests(created_at DESC)
  WHERE status = 'pending_yi_review';
CREATE INDEX idx_visit_requests_scheduled ON public.member_visit_requests(scheduled_date)
  WHERE status = 'scheduled';

COMMENT ON TABLE public.member_visit_requests IS 'Member-initiated visit requests to industry partners (requires active MoU)';

-- ============================================================================
-- VISIT REQUEST INTERESTS TABLE (other members showing interest)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visit_request_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_request_id UUID NOT NULL REFERENCES public.member_visit_requests(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  interest_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_visit_interest UNIQUE (visit_request_id, member_id)
);

CREATE INDEX idx_visit_interests_request ON public.visit_request_interests(visit_request_id);
CREATE INDEX idx_visit_interests_member ON public.visit_request_interests(member_id);

-- ============================================================================
-- OPPORTUNITY BOOKMARKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.industry_opportunities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_bookmark UNIQUE (opportunity_id, member_id)
);

CREATE INDEX idx_bookmarks_member ON public.opportunity_bookmarks(member_id);
CREATE INDEX idx_bookmarks_opportunity ON public.opportunity_bookmarks(opportunity_id);

-- ============================================================================
-- INDUSTRY IMPACT METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.industry_impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES public.industries(id) ON DELETE CASCADE UNIQUE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id),

  -- Opportunity Metrics
  total_opportunities_posted INTEGER DEFAULT 0,
  active_opportunities INTEGER DEFAULT 0,
  total_applications_received INTEGER DEFAULT 0,
  total_positions_filled INTEGER DEFAULT 0,
  average_applications_per_opportunity DECIMAL(5,2),

  -- Visit Metrics
  total_visits_hosted INTEGER DEFAULT 0,
  total_visitors INTEGER DEFAULT 0,
  visit_satisfaction_avg DECIMAL(3,2),

  -- Session Metrics (if they host service events)
  total_sessions_hosted INTEGER DEFAULT 0,
  total_beneficiaries INTEGER DEFAULT 0,
  session_satisfaction_avg DECIMAL(3,2),

  -- Financial Impact
  total_csr_contribution DECIMAL(15,2) DEFAULT 0,
  total_sponsorship_value DECIMAL(15,2) DEFAULT 0,

  -- Engagement Score
  engagement_score DECIMAL(5,2) DEFAULT 0,
  engagement_tier TEXT CHECK (engagement_tier IN ('platinum', 'gold', 'silver', 'bronze', 'new')),

  -- Top Learning Outcomes (from member feedback)
  top_learning_outcomes TEXT[],
  average_rating DECIMAL(3,2),

  -- Last Activity
  last_opportunity_posted_at TIMESTAMPTZ,
  last_visit_hosted_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,

  -- Calculation
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_industry_impact_industry ON public.industry_impact_metrics(industry_id);
CREATE INDEX idx_industry_impact_chapter ON public.industry_impact_metrics(chapter_id);
CREATE INDEX idx_industry_impact_score ON public.industry_impact_metrics(engagement_score DESC);
CREATE INDEX idx_industry_impact_tier ON public.industry_impact_metrics(engagement_tier);

COMMENT ON TABLE public.industry_impact_metrics IS 'Aggregated impact metrics per industry partner';

-- ============================================================================
-- EXTEND STAKEHOLDER_MOUS FOR PARTNERSHIP LIFECYCLE
-- ============================================================================

ALTER TABLE public.stakeholder_mous
ADD COLUMN IF NOT EXISTS partnership_stage partnership_stage DEFAULT 'initial_contact',
ADD COLUMN IF NOT EXISTS first_opportunity_date DATE,
ADD COLUMN IF NOT EXISTS last_opportunity_date DATE,
ADD COLUMN IF NOT EXISTS opportunities_provided INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS members_benefited INTEGER DEFAULT 0;

-- ============================================================================
-- ADD INDUSTRY COORDINATOR ROLE
-- ============================================================================

-- Check if role exists before inserting
INSERT INTO public.roles (name, description, hierarchy_level)
SELECT 'Industry Coordinator', 'External industry partner coordinator who can post opportunities and review applications', 1
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Industry Coordinator');

-- ============================================================================
-- MATCH SCORE CALCULATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_opportunity_match_score(
  p_member_id UUID,
  p_opportunity_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_member RECORD;
  v_opportunity RECORD;
  v_eligibility JSONB;
  v_industry_score DECIMAL := 0;
  v_skills_score DECIMAL := 0;
  v_experience_score DECIMAL := 0;
  v_engagement_score DECIMAL := 0;
  v_overall_score DECIMAL;
  v_member_skills TEXT[];
  v_required_skills TEXT[];
  v_matching_count INTEGER := 0;
BEGIN
  -- Get member data
  SELECT
    m.id,
    m.industry,
    m.business_type,
    m.years_of_experience,
    m.engagement_score
  INTO v_member
  FROM public.members m
  WHERE m.id = p_member_id;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object('error', 'Member not found');
  END IF;

  -- Get opportunity eligibility criteria
  SELECT eligibility_criteria INTO v_eligibility
  FROM public.industry_opportunities
  WHERE id = p_opportunity_id;

  IF v_eligibility IS NULL THEN
    RETURN jsonb_build_object('error', 'Opportunity not found');
  END IF;

  -- 1. INDUSTRY MATCH (40% weight)
  IF v_eligibility->'industries' IS NOT NULL AND jsonb_array_length(v_eligibility->'industries') > 0 THEN
    IF v_member.industry IS NOT NULL AND v_member.industry = ANY(
      SELECT jsonb_array_elements_text(v_eligibility->'industries')
    ) THEN
      v_industry_score := 100;
    ELSE
      v_industry_score := 30; -- Partial score for non-matching
    END IF;
  ELSE
    v_industry_score := 80; -- No specific industry required
  END IF;

  -- 2. SKILLS MATCH (30% weight)
  -- For now, simplified - would need to join with member_skills table
  v_skills_score := 70; -- Default moderate score

  -- 3. EXPERIENCE MATCH (20% weight)
  IF (v_eligibility->>'min_experience_years')::INTEGER IS NOT NULL THEN
    IF v_member.years_of_experience >= (v_eligibility->>'min_experience_years')::INTEGER THEN
      v_experience_score := 100;
    ELSIF v_member.years_of_experience >= ((v_eligibility->>'min_experience_years')::INTEGER - 1) THEN
      v_experience_score := 70;
    ELSE
      v_experience_score := 40;
    END IF;
  ELSE
    v_experience_score := 80;
  END IF;

  -- 4. ENGAGEMENT SCORE (10% weight)
  v_engagement_score := COALESCE(v_member.engagement_score, 50);

  -- Calculate Overall Score (weighted average)
  v_overall_score := (
    (v_industry_score * 0.40) +
    (v_skills_score * 0.30) +
    (v_experience_score * 0.20) +
    (v_engagement_score * 0.10)
  );

  RETURN jsonb_build_object(
    'overall_score', ROUND(v_overall_score, 2),
    'breakdown', jsonb_build_object(
      'industry_score', ROUND(v_industry_score, 2),
      'skills_score', ROUND(v_skills_score, 2),
      'experience_score', ROUND(v_experience_score, 2),
      'engagement_score', ROUND(v_engagement_score, 2)
    ),
    'weights', jsonb_build_object(
      'industry', 0.40,
      'skills', 0.30,
      'experience', 0.20,
      'engagement', 0.10
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_opportunity_match_score IS 'Calculate member-opportunity match score (100 points max)';

-- ============================================================================
-- TRIGGER: Update application count on opportunity
-- ============================================================================

CREATE OR REPLACE FUNCTION update_opportunity_application_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current_applications count
  UPDATE public.industry_opportunities
  SET
    current_applications = (
      SELECT COUNT(*) FROM public.opportunity_applications
      WHERE opportunity_id = COALESCE(NEW.opportunity_id, OLD.opportunity_id)
      AND status NOT IN ('draft', 'withdrawn')
    ),
    accepted_count = (
      SELECT COUNT(*) FROM public.opportunity_applications
      WHERE opportunity_id = COALESCE(NEW.opportunity_id, OLD.opportunity_id)
      AND status = 'accepted'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.opportunity_id, OLD.opportunity_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_application_count ON public.opportunity_applications;
CREATE TRIGGER trigger_update_application_count
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunity_applications
  FOR EACH ROW EXECUTE FUNCTION update_opportunity_application_count();

-- ============================================================================
-- TRIGGER: Update interest count on visit request
-- ============================================================================

CREATE OR REPLACE FUNCTION update_visit_request_interest_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.member_visit_requests
  SET
    interest_count = (
      SELECT COUNT(*) + 1 FROM public.visit_request_interests
      WHERE visit_request_id = COALESCE(NEW.visit_request_id, OLD.visit_request_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.visit_request_id, OLD.visit_request_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_interest_count ON public.visit_request_interests;
CREATE TRIGGER trigger_update_interest_count
  AFTER INSERT OR DELETE ON public.visit_request_interests
  FOR EACH ROW EXECUTE FUNCTION update_visit_request_interest_count();

-- ============================================================================
-- TRIGGER: Update industry impact metrics when opportunity created/updated
-- ============================================================================

CREATE OR REPLACE FUNCTION update_industry_impact_on_opportunity()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert industry impact metrics
  INSERT INTO public.industry_impact_metrics (industry_id, chapter_id)
  SELECT NEW.industry_id, NEW.chapter_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.industry_impact_metrics WHERE industry_id = NEW.industry_id
  );

  -- Update metrics
  UPDATE public.industry_impact_metrics
  SET
    total_opportunities_posted = (
      SELECT COUNT(*) FROM public.industry_opportunities
      WHERE industry_id = NEW.industry_id
    ),
    active_opportunities = (
      SELECT COUNT(*) FROM public.industry_opportunities
      WHERE industry_id = NEW.industry_id
      AND status IN ('published', 'accepting_applications')
    ),
    last_opportunity_posted_at = CASE
      WHEN NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status != 'published')
      THEN now()
      ELSE last_opportunity_posted_at
    END,
    calculated_at = now(),
    updated_at = now()
  WHERE industry_id = NEW.industry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_industry_impact ON public.industry_opportunities;
CREATE TRIGGER trigger_update_industry_impact
  AFTER INSERT OR UPDATE ON public.industry_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_industry_impact_on_opportunity();

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_industry_opportunities_updated_at ON public.industry_opportunities;
CREATE TRIGGER update_industry_opportunities_updated_at
  BEFORE UPDATE ON public.industry_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunity_applications_updated_at ON public.opportunity_applications;
CREATE TRIGGER update_opportunity_applications_updated_at
  BEFORE UPDATE ON public.opportunity_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_visit_requests_updated_at ON public.member_visit_requests;
CREATE TRIGGER update_member_visit_requests_updated_at
  BEFORE UPDATE ON public.member_visit_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_industry_impact_metrics_updated_at ON public.industry_impact_metrics;
CREATE TRIGGER update_industry_impact_metrics_updated_at
  BEFORE UPDATE ON public.industry_impact_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.industry_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_request_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_impact_metrics ENABLE ROW LEVEL SECURITY;

-- Industry Opportunities Policies
CREATE POLICY "Members can view published opportunities"
  ON public.industry_opportunities FOR SELECT
  TO authenticated
  USING (status IN ('published', 'accepting_applications', 'closed', 'completed'));

CREATE POLICY "Industry coordinators can manage their opportunities"
  ON public.industry_opportunities FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chapter Chair', 'Industry Chair')
    )
  );

-- Opportunity Applications Policies
CREATE POLICY "Members can view their own applications"
  ON public.opportunity_applications FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Members can create their own applications"
  ON public.opportunity_applications FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Members can update their own draft applications"
  ON public.opportunity_applications FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid() AND status IN ('draft', 'pending_review'));

CREATE POLICY "Industry coordinators can view applications for their opportunities"
  ON public.opportunity_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.industry_opportunities io
      WHERE io.id = opportunity_applications.opportunity_id
      AND io.created_by = auth.uid()
    )
  );

CREATE POLICY "Industry coordinators can update applications"
  ON public.opportunity_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.industry_opportunities io
      WHERE io.id = opportunity_applications.opportunity_id
      AND io.created_by = auth.uid()
    )
  );

-- Visit Request Policies
CREATE POLICY "Members can view their own visit requests"
  ON public.member_visit_requests FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

CREATE POLICY "Members can create visit requests"
  ON public.member_visit_requests FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Yi chairs can manage visit requests"
  ON public.member_visit_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chapter Chair', 'Industry Chair')
    )
  );

-- Visit Request Interests Policies
CREATE POLICY "Members can view interests for visible requests"
  ON public.visit_request_interests FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.member_visit_requests vr
      WHERE vr.id = visit_request_interests.visit_request_id
      AND vr.requested_by = auth.uid()
    )
  );

CREATE POLICY "Members can express interest"
  ON public.visit_request_interests FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Members can remove their interest"
  ON public.visit_request_interests FOR DELETE
  TO authenticated
  USING (member_id = auth.uid());

-- Bookmarks Policies
CREATE POLICY "Members can manage their own bookmarks"
  ON public.opportunity_bookmarks FOR ALL
  TO authenticated
  USING (member_id = auth.uid());

-- Industry Impact Metrics Policies
CREATE POLICY "Anyone can view industry impact metrics"
  ON public.industry_impact_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can update industry impact metrics"
  ON public.industry_impact_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON public.industry_opportunities TO authenticated;
GRANT ALL ON public.opportunity_applications TO authenticated;
GRANT ALL ON public.member_visit_requests TO authenticated;
GRANT ALL ON public.visit_request_interests TO authenticated;
GRANT ALL ON public.opportunity_bookmarks TO authenticated;
GRANT ALL ON public.industry_impact_metrics TO authenticated;
