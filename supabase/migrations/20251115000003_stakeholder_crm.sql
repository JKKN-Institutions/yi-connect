-- ================================================
-- MODULE 2: STAKEHOLDER RELATIONSHIP CRM
-- ================================================
-- Migration: 20251115000003_stakeholder_crm.sql
-- Description: Comprehensive stakeholder management system for schools,
--              colleges, industries, government, NGOs, vendors, and speakers
-- Dependencies: Requires profiles, chapters, members tables
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- ENUMS & TYPES
-- ================================================

-- Stakeholder relationship status
CREATE TYPE stakeholder_status AS ENUM (
  'active',
  'inactive',
  'prospective',
  'dormant',
  'archived'
);

-- Interaction types
CREATE TYPE interaction_type AS ENUM (
  'call',
  'meeting',
  'email',
  'session',
  'event',
  'mou_signing',
  'follow_up',
  'visit',
  'other'
);

-- Interaction outcomes
CREATE TYPE interaction_outcome AS ENUM (
  'positive',
  'neutral',
  'negative',
  'pending',
  'no_response'
);

-- MoU status
CREATE TYPE mou_status AS ENUM (
  'none',
  'in_discussion',
  'draft',
  'signed',
  'expired',
  'renewed'
);

-- School types
CREATE TYPE school_type AS ENUM (
  'primary',
  'secondary',
  'high_school',
  'cbse',
  'state_board',
  'matric',
  'icse',
  'international'
);

-- College types
CREATE TYPE college_type AS ENUM (
  'engineering',
  'arts_science',
  'medical',
  'management',
  'polytechnic',
  'other'
);

-- Industry sectors
CREATE TYPE industry_sector AS ENUM (
  'manufacturing',
  'it_services',
  'healthcare',
  'education',
  'retail',
  'hospitality',
  'construction',
  'agriculture',
  'finance',
  'other'
);

-- Partnership types
CREATE TYPE partnership_type AS ENUM (
  'joint_projects',
  'resource_sharing',
  'funding',
  'implementation',
  'advocacy',
  'knowledge_exchange'
);

-- Vendor categories
CREATE TYPE vendor_category AS ENUM (
  'catering',
  'printing',
  'venue',
  'av_equipment',
  'decoration',
  'photography',
  'transportation',
  'merchandise',
  'other'
);

-- Connection types
CREATE TYPE connection_type AS ENUM (
  'direct',
  'through_member',
  'through_ngo',
  'cold',
  'referral'
);

-- Health score tiers
CREATE TYPE health_tier AS ENUM (
  'healthy',        -- 80-100
  'needs_attention', -- 60-79
  'at_risk'         -- <60
);

-- ================================================
-- SCHOOLS TABLE
-- ================================================

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Basic Information
  school_name TEXT NOT NULL,
  school_type school_type NOT NULL,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT DEFAULT 'Erode',
  state TEXT DEFAULT 'Tamil Nadu',
  pincode TEXT,

  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Connection
  connection_type connection_type DEFAULT 'cold',
  connected_through_member_id UUID REFERENCES members(id),
  connection_notes TEXT,

  -- School Profile
  total_students INTEGER,
  grade_range TEXT, -- e.g., "1-12", "6-10"
  medium TEXT[], -- Array of mediums: English, Tamil, Hindi
  school_category TEXT, -- Co-ed, Boys, Girls
  management_type TEXT, -- Government, Private, Aided

  -- Yi Program Suitability
  suitable_programs TEXT[], -- Masoom, Road Safety, etc.

  -- Facilities
  has_auditorium BOOLEAN DEFAULT false,
  has_smart_class BOOLEAN DEFAULT false,
  has_ground BOOLEAN DEFAULT false,
  has_parking BOOLEAN DEFAULT false,
  facility_notes TEXT,

  -- Operational Info
  best_time_to_approach TEXT, -- e.g., "Avoid March-April (exams)"
  decision_maker TEXT,
  lead_time_required TEXT, -- 1 week, 1 month, 3+ months

  -- Status
  status stakeholder_status DEFAULT 'prospective',

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(school_name, '') || ' ' ||
      COALESCE(city, '') || ' ' ||
      COALESCE(email, '')
    )
  ) STORED
);

-- Indexes for schools
CREATE INDEX idx_schools_chapter ON schools(chapter_id);
CREATE INDEX idx_schools_status ON schools(status);
CREATE INDEX idx_schools_type ON schools(school_type);
CREATE INDEX idx_schools_search ON schools USING gin(search_vector);
CREATE INDEX idx_schools_connected_member ON schools(connected_through_member_id);

-- ================================================
-- COLLEGES TABLE
-- ================================================

CREATE TABLE colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Basic Information
  college_name TEXT NOT NULL,
  college_type college_type NOT NULL,
  affiliation TEXT, -- Anna University, State Board, etc.

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT DEFAULT 'Erode',
  state TEXT DEFAULT 'Tamil Nadu',
  pincode TEXT,

  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Connection
  connection_type connection_type DEFAULT 'cold',
  connected_through_member_id UUID REFERENCES members(id),
  connection_notes TEXT,

  -- College Profile
  total_students INTEGER,
  departments TEXT[], -- Array of departments
  faculty_count INTEGER,

  -- Yi Collaboration
  has_yuva_chapter BOOLEAN DEFAULT false,
  yuva_coordinator_name TEXT,
  yuva_coordinator_contact TEXT,
  collaboration_areas TEXT[], -- Industrial visits, faculty speakers, volunteers

  -- Facilities
  has_auditorium BOOLEAN DEFAULT false,
  has_seminar_hall BOOLEAN DEFAULT false,
  has_hostel BOOLEAN DEFAULT false,
  has_placement_cell BOOLEAN DEFAULT false,
  facility_notes TEXT,

  -- Operational Info
  best_time_to_approach TEXT,
  decision_maker TEXT,
  lead_time_required TEXT,

  -- Status
  status stakeholder_status DEFAULT 'prospective',

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(college_name, '') || ' ' ||
      COALESCE(city, '') || ' ' ||
      COALESCE(affiliation, '')
    )
  ) STORED
);

-- Indexes for colleges
CREATE INDEX idx_colleges_chapter ON colleges(chapter_id);
CREATE INDEX idx_colleges_status ON colleges(status);
CREATE INDEX idx_colleges_type ON colleges(college_type);
CREATE INDEX idx_colleges_search ON colleges USING gin(search_vector);

-- ================================================
-- INDUSTRIES TABLE
-- ================================================

CREATE TABLE industries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Basic Information
  company_name TEXT NOT NULL,
  industry_sector industry_sector NOT NULL,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,

  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Company Profile
  employee_count INTEGER,
  annual_turnover DECIMAL(15, 2),
  established_year INTEGER,

  -- Connection
  connection_type connection_type DEFAULT 'cold',
  connected_through_member_id UUID REFERENCES members(id),
  connection_notes TEXT,
  member_works_here BOOLEAN DEFAULT false,

  -- Collaboration Areas
  offers_industrial_visits BOOLEAN DEFAULT false,
  offers_csr BOOLEAN DEFAULT false,
  offers_sponsorship BOOLEAN DEFAULT false,
  offers_volunteering BOOLEAN DEFAULT false,
  collaboration_notes TEXT,

  -- CSR Profile
  has_csr_budget BOOLEAN DEFAULT false,
  csr_budget_amount DECIMAL(15, 2),
  csr_focus_areas TEXT[], -- Education, Health, Environment, etc.
  csr_contact_name TEXT,
  csr_contact_designation TEXT,
  csr_contact_phone TEXT,
  csr_contact_email TEXT,
  past_csr_projects TEXT,

  -- Sponsorship Pipeline
  sponsorship_stage TEXT, -- Prospect, Active, Past
  sponsorship_potential_amount DECIMAL(15, 2),

  -- Status
  status stakeholder_status DEFAULT 'prospective',

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(company_name, '') || ' ' ||
      COALESCE(city, '') || ' ' ||
      COALESCE(csr_contact_name, '')
    )
  ) STORED
);

-- Indexes for industries
CREATE INDEX idx_industries_chapter ON industries(chapter_id);
CREATE INDEX idx_industries_status ON industries(status);
CREATE INDEX idx_industries_sector ON industries(industry_sector);
CREATE INDEX idx_industries_search ON industries USING gin(search_vector);

-- ================================================
-- GOVERNMENT STAKEHOLDERS TABLE
-- ================================================

CREATE TABLE government_stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Basic Information
  department_name TEXT NOT NULL,
  official_name TEXT NOT NULL,
  designation TEXT NOT NULL,

  -- Contact
  office_phone TEXT,
  mobile_phone TEXT,
  email TEXT,
  office_address TEXT,

  -- Tenure Information
  join_date DATE,
  expected_transfer_date DATE,
  transfer_alert_sent BOOLEAN DEFAULT false,
  tenure_notes TEXT,

  -- Engagement
  decision_authority TEXT, -- What they can approve/decide
  interests TEXT[], -- Areas of interest
  past_collaborations TEXT,

  -- Protocol
  preferred_contact_method TEXT, -- Phone, Email, Office Visit
  formality_level TEXT, -- Formal, Semi-formal, Informal
  lead_time_required TEXT,
  best_time_to_contact TEXT,
  protocol_notes TEXT,

  -- Status
  status stakeholder_status DEFAULT 'active',

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(official_name, '') || ' ' ||
      COALESCE(department_name, '') || ' ' ||
      COALESCE(designation, '')
    )
  ) STORED
);

-- Indexes for government stakeholders
CREATE INDEX idx_govt_chapter ON government_stakeholders(chapter_id);
CREATE INDEX idx_govt_status ON government_stakeholders(status);
CREATE INDEX idx_govt_transfer_date ON government_stakeholders(expected_transfer_date);
CREATE INDEX idx_govt_search ON government_stakeholders USING gin(search_vector);

-- ================================================
-- NGOs TABLE
-- ================================================

CREATE TABLE ngos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Basic Information
  ngo_name TEXT NOT NULL,
  registration_number TEXT,
  registration_type TEXT, -- Section 8, Trust, Society, etc.
  focus_areas TEXT[] NOT NULL, -- Education, Health, Environment, etc.

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,

  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Leadership
  founder_name TEXT,
  director_name TEXT,
  contact_person_name TEXT,
  contact_person_designation TEXT,
  contact_person_phone TEXT,
  contact_person_email TEXT,

  -- Partnership
  partnership_types partnership_type[],
  resource_sharing_areas TEXT[], -- Volunteers, Venues, Funding, Materials

  -- Capacity
  team_size INTEGER,
  volunteer_count INTEGER,
  annual_budget DECIMAL(15, 2),
  operational_areas TEXT[], -- Cities/Districts where they operate

  -- Past Collaborations
  collaboration_history JSONB, -- [{year, project, outcome}]

  -- Status
  status stakeholder_status DEFAULT 'prospective',

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(ngo_name, '') || ' ' ||
      COALESCE(contact_person_name, '') || ' ' ||
      array_to_string(focus_areas, ' ')
    )
  ) STORED
);

-- Indexes for NGOs
CREATE INDEX idx_ngos_chapter ON ngos(chapter_id);
CREATE INDEX idx_ngos_status ON ngos(status);
CREATE INDEX idx_ngos_search ON ngos USING gin(search_vector);

-- ================================================
-- VENDORS TABLE
-- ================================================

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Basic Information
  vendor_name TEXT NOT NULL,
  vendor_category vendor_category NOT NULL,

  -- Contact
  contact_person_name TEXT,
  contact_person_phone TEXT,
  contact_person_email TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,

  -- Business Details
  gst_number TEXT,
  pan_number TEXT,
  services_offered TEXT[],
  service_area TEXT[], -- Cities where they can provide service
  capacity TEXT, -- e.g., "Can handle 500 pax"

  -- Pricing
  pricing_structure JSONB, -- {service: price} flexible structure
  discount_offered DECIMAL(5, 2), -- Percentage
  payment_terms TEXT, -- Advance, On delivery, 30 days, etc.

  -- Performance Metrics
  average_rating DECIMAL(3, 2) DEFAULT 0, -- 0-5 stars
  delivery_percentage DECIMAL(5, 2) DEFAULT 100, -- % of on-time deliveries
  quality_percentage DECIMAL(5, 2) DEFAULT 100, -- % satisfaction
  total_events_served INTEGER DEFAULT 0,
  total_amount_paid DECIMAL(15, 2) DEFAULT 0,

  -- CII Approval
  is_cii_approved BOOLEAN DEFAULT false,
  cii_approval_date DATE,
  cii_approval_notes TEXT,

  -- Status
  status stakeholder_status DEFAULT 'active',

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(vendor_name, '') || ' ' ||
      COALESCE(contact_person_name, '') || ' ' ||
      array_to_string(services_offered, ' ')
    )
  ) STORED
);

-- Indexes for vendors
CREATE INDEX idx_vendors_chapter ON vendors(chapter_id);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_category ON vendors(vendor_category);
CREATE INDEX idx_vendors_rating ON vendors(average_rating);
CREATE INDEX idx_vendors_search ON vendors USING gin(search_vector);

-- ================================================
-- SPEAKERS/TRAINERS TABLE
-- ================================================

CREATE TABLE speakers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Basic Information
  speaker_name TEXT NOT NULL,
  title TEXT, -- Dr., Prof., Mr., Ms., etc.
  current_organization TEXT,
  designation TEXT,

  -- Contact
  phone TEXT,
  email TEXT NOT NULL,
  linkedin TEXT,
  website TEXT,
  photo_url TEXT,

  -- Profile
  bio TEXT,
  expertise_areas TEXT[] NOT NULL, -- Leadership, Entrepreneurship, etc.
  achievements TEXT,
  certifications TEXT[],
  languages TEXT[], -- English, Tamil, Hindi

  -- Availability
  available_for TEXT[], -- Workshops, Keynotes, Panels, Mentoring
  notice_required TEXT, -- 1 week, 1 month, etc.
  preferred_duration TEXT, -- 1 hour, 2 hours, half-day, full-day

  -- Fee Structure
  fee_structure JSONB, -- {type: amount} e.g., {keynote: 10000, workshop: 15000}
  travel_charges TEXT, -- Actual, Flat rate, None
  accommodation_required BOOLEAN DEFAULT false,

  -- Yi Engagement
  past_yi_topics TEXT[],
  past_yi_events INTEGER DEFAULT 0,
  last_yi_engagement_date DATE,
  feedback_summary TEXT,
  average_rating DECIMAL(3, 2) DEFAULT 0,

  -- Media
  video_links TEXT[],
  presentation_samples TEXT[], -- URLs to sample presentations
  testimonials TEXT,

  -- Status
  status stakeholder_status DEFAULT 'active',
  is_preferred BOOLEAN DEFAULT false, -- Preferred/recommended speaker

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(speaker_name, '') || ' ' ||
      COALESCE(current_organization, '') || ' ' ||
      array_to_string(expertise_areas, ' ')
    )
  ) STORED
);

-- Indexes for speakers
CREATE INDEX idx_speakers_chapter ON speakers(chapter_id);
CREATE INDEX idx_speakers_status ON speakers(status);
CREATE INDEX idx_speakers_rating ON speakers(average_rating);
CREATE INDEX idx_speakers_preferred ON speakers(is_preferred);
CREATE INDEX idx_speakers_search ON speakers USING gin(search_vector);

-- ================================================
-- STAKEHOLDER CONTACTS TABLE (Shared)
-- ================================================
-- For storing multiple key contacts for any stakeholder type

CREATE TABLE stakeholder_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Stakeholder Reference (polymorphic)
  stakeholder_type TEXT NOT NULL, -- 'school', 'college', 'industry', etc.
  stakeholder_id UUID NOT NULL,

  -- Contact Details
  contact_name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,

  -- Preferences
  is_primary_contact BOOLEAN DEFAULT false,
  preferred_contact_method TEXT, -- Phone, Email, WhatsApp
  best_time_to_contact TEXT,
  notes TEXT,

  -- System fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contacts
CREATE INDEX idx_contacts_stakeholder ON stakeholder_contacts(stakeholder_type, stakeholder_id);
CREATE INDEX idx_contacts_primary ON stakeholder_contacts(is_primary_contact) WHERE is_primary_contact = true;

-- ================================================
-- STAKEHOLDER INTERACTIONS TABLE (Shared)
-- ================================================
-- For logging all interactions with stakeholders

CREATE TABLE stakeholder_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Stakeholder Reference (polymorphic)
  stakeholder_type TEXT NOT NULL,
  stakeholder_id UUID NOT NULL,

  -- Interaction Details
  interaction_type interaction_type NOT NULL,
  interaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Participants
  led_by_member_id UUID REFERENCES members(id),
  participants TEXT[], -- Array of member names/IDs

  -- Outcome
  outcome interaction_outcome NOT NULL,
  summary TEXT NOT NULL,
  notes TEXT,
  attachments TEXT[], -- URLs to uploaded files

  -- Follow-up
  requires_follow_up BOOLEAN DEFAULT false,
  follow_up_date DATE,
  follow_up_notes TEXT,
  follow_up_completed BOOLEAN DEFAULT false,

  -- Impact (for sessions/events)
  participants_count INTEGER,
  children_reached INTEGER,
  hours_spent DECIMAL(5, 2),

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for interactions
CREATE INDEX idx_interactions_chapter ON stakeholder_interactions(chapter_id);
CREATE INDEX idx_interactions_stakeholder ON stakeholder_interactions(stakeholder_type, stakeholder_id);
CREATE INDEX idx_interactions_date ON stakeholder_interactions(interaction_date DESC);
CREATE INDEX idx_interactions_follow_up ON stakeholder_interactions(follow_up_date) WHERE requires_follow_up = true AND follow_up_completed = false;
CREATE INDEX idx_interactions_led_by ON stakeholder_interactions(led_by_member_id);

-- ================================================
-- MoU TRACKING TABLE (Shared)
-- ================================================

CREATE TABLE stakeholder_mous (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Stakeholder Reference (polymorphic)
  stakeholder_type TEXT NOT NULL,
  stakeholder_id UUID NOT NULL,

  -- MoU Details
  mou_status mou_status NOT NULL DEFAULT 'none',
  mou_title TEXT,
  signed_date DATE,
  duration_months INTEGER, -- Duration in months
  expiry_date DATE,
  auto_renewal BOOLEAN DEFAULT false,
  renewal_notice_period INTEGER DEFAULT 90, -- Days before expiry to send notice

  -- Documents
  mou_document_url TEXT,
  signed_copy_url TEXT,

  -- Terms
  key_terms TEXT,
  deliverables TEXT[],
  our_commitments TEXT[],
  their_commitments TEXT[],

  -- Compliance
  compliance_checklist JSONB, -- [{item, completed, date}]
  compliance_percentage DECIMAL(5, 2) DEFAULT 0,

  -- Alerts
  expiry_alert_sent BOOLEAN DEFAULT false,
  expiry_alert_date DATE,

  -- System fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for MoUs
CREATE INDEX idx_mous_chapter ON stakeholder_mous(chapter_id);
CREATE INDEX idx_mous_stakeholder ON stakeholder_mous(stakeholder_type, stakeholder_id);
CREATE INDEX idx_mous_status ON stakeholder_mous(mou_status);
CREATE INDEX idx_mous_expiry ON stakeholder_mous(expiry_date) WHERE mou_status = 'signed';

-- ================================================
-- STAKEHOLDER DOCUMENTS TABLE (Shared)
-- ================================================

CREATE TABLE stakeholder_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Stakeholder Reference (polymorphic)
  stakeholder_type TEXT NOT NULL,
  stakeholder_id UUID NOT NULL,

  -- Document Details
  document_name TEXT NOT NULL,
  document_type TEXT, -- Proposal, Report, Photo, Certificate, etc.
  file_url TEXT NOT NULL,
  file_size INTEGER, -- In bytes
  mime_type TEXT,

  -- Metadata
  description TEXT,
  tags TEXT[],
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for documents
CREATE INDEX idx_documents_stakeholder ON stakeholder_documents(stakeholder_type, stakeholder_id);
CREATE INDEX idx_documents_type ON stakeholder_documents(document_type);

-- ================================================
-- RELATIONSHIP HEALTH SCORES TABLE
-- ================================================
-- Calculated and cached health scores for all stakeholders

CREATE TABLE relationship_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Stakeholder Reference (polymorphic)
  stakeholder_type TEXT NOT NULL,
  stakeholder_id UUID NOT NULL,

  -- Health Score Components (0-100 each)
  interaction_frequency_score DECIMAL(5, 2) DEFAULT 0, -- 40% weight
  responsiveness_score DECIMAL(5, 2) DEFAULT 0,        -- 20% weight
  collaboration_quality_score DECIMAL(5, 2) DEFAULT 0,  -- 20% weight
  mou_status_score DECIMAL(5, 2) DEFAULT 0,            -- 20% weight

  -- Overall Score
  overall_score DECIMAL(5, 2) DEFAULT 0, -- Weighted average
  health_tier health_tier DEFAULT 'at_risk',

  -- Contributing Metrics
  total_interactions INTEGER DEFAULT 0,
  last_interaction_date DATE,
  days_since_last_interaction INTEGER DEFAULT 999,
  positive_interactions_percentage DECIMAL(5, 2) DEFAULT 0,
  sessions_conducted INTEGER DEFAULT 0,
  children_reached INTEGER DEFAULT 0,

  -- Calculation
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_notes TEXT,

  -- System fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  CONSTRAINT unique_stakeholder_health UNIQUE (stakeholder_type, stakeholder_id)
);

-- Indexes for health scores
CREATE INDEX idx_health_chapter ON relationship_health_scores(chapter_id);
CREATE INDEX idx_health_stakeholder ON relationship_health_scores(stakeholder_type, stakeholder_id);
CREATE INDEX idx_health_score ON relationship_health_scores(overall_score);
CREATE INDEX idx_health_tier ON relationship_health_scores(health_tier);
CREATE INDEX idx_health_last_interaction ON relationship_health_scores(last_interaction_date);

-- ================================================
-- DATABASE FUNCTIONS
-- ================================================

-- Function to calculate relationship health score
CREATE OR REPLACE FUNCTION calculate_relationship_health_score(
  p_stakeholder_type TEXT,
  p_stakeholder_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  v_interaction_freq_score DECIMAL := 0;
  v_responsiveness_score DECIMAL := 0;
  v_collaboration_score DECIMAL := 0;
  v_mou_score DECIMAL := 0;
  v_overall_score DECIMAL := 0;
  v_total_interactions INTEGER := 0;
  v_last_interaction_date DATE;
  v_days_since_last INTEGER := 999;
  v_positive_percentage DECIMAL := 0;
  v_mou_status mou_status;
BEGIN
  -- Get interaction metrics
  SELECT
    COUNT(*),
    MAX(interaction_date),
    EXTRACT(DAY FROM (CURRENT_DATE - MAX(interaction_date))),
    ROUND((COUNT(*) FILTER (WHERE outcome = 'positive')::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2)
  INTO
    v_total_interactions,
    v_last_interaction_date,
    v_days_since_last,
    v_positive_percentage
  FROM stakeholder_interactions
  WHERE stakeholder_type = p_stakeholder_type
    AND stakeholder_id = p_stakeholder_id;

  -- Calculate interaction frequency score (40% weight)
  -- Score based on days since last interaction
  IF v_days_since_last <= 30 THEN
    v_interaction_freq_score := 100;
  ELSIF v_days_since_last <= 60 THEN
    v_interaction_freq_score := 80;
  ELSIF v_days_since_last <= 90 THEN
    v_interaction_freq_score := 60;
  ELSIF v_days_since_last <= 180 THEN
    v_interaction_freq_score := 40;
  ELSE
    v_interaction_freq_score := 20;
  END IF;

  -- Calculate responsiveness score (20% weight)
  -- Based on positive interaction percentage
  v_responsiveness_score := COALESCE(v_positive_percentage, 50);

  -- Calculate collaboration quality score (20% weight)
  -- Based on total meaningful interactions
  IF v_total_interactions >= 20 THEN
    v_collaboration_score := 100;
  ELSIF v_total_interactions >= 10 THEN
    v_collaboration_score := 80;
  ELSIF v_total_interactions >= 5 THEN
    v_collaboration_score := 60;
  ELSIF v_total_interactions >= 2 THEN
    v_collaboration_score := 40;
  ELSE
    v_collaboration_score := 20;
  END IF;

  -- Get MoU status and calculate score (20% weight)
  SELECT mou_status INTO v_mou_status
  FROM stakeholder_mous
  WHERE stakeholder_type = p_stakeholder_type
    AND stakeholder_id = p_stakeholder_id
  ORDER BY created_at DESC
  LIMIT 1;

  CASE v_mou_status
    WHEN 'signed' THEN v_mou_score := 100;
    WHEN 'in_discussion' THEN v_mou_score := 60;
    WHEN 'draft' THEN v_mou_score := 40;
    WHEN 'expired' THEN v_mou_score := 30;
    ELSE v_mou_score := 0;
  END CASE;

  -- Calculate weighted overall score
  v_overall_score := (
    (v_interaction_freq_score * 0.4) +
    (v_responsiveness_score * 0.2) +
    (v_collaboration_score * 0.2) +
    (v_mou_score * 0.2)
  );

  -- Insert or update health score record
  INSERT INTO relationship_health_scores (
    stakeholder_type,
    stakeholder_id,
    interaction_frequency_score,
    responsiveness_score,
    collaboration_quality_score,
    mou_status_score,
    overall_score,
    health_tier,
    total_interactions,
    last_interaction_date,
    days_since_last_interaction,
    positive_interactions_percentage,
    last_calculated_at
  ) VALUES (
    p_stakeholder_type,
    p_stakeholder_id,
    v_interaction_freq_score,
    v_responsiveness_score,
    v_collaboration_score,
    v_mou_score,
    v_overall_score,
    CASE
      WHEN v_overall_score >= 80 THEN 'healthy'::health_tier
      WHEN v_overall_score >= 60 THEN 'needs_attention'::health_tier
      ELSE 'at_risk'::health_tier
    END,
    v_total_interactions,
    v_last_interaction_date,
    COALESCE(v_days_since_last, 999),
    v_positive_percentage,
    NOW()
  )
  ON CONFLICT (stakeholder_type, stakeholder_id)
  DO UPDATE SET
    interaction_frequency_score = EXCLUDED.interaction_frequency_score,
    responsiveness_score = EXCLUDED.responsiveness_score,
    collaboration_quality_score = EXCLUDED.collaboration_quality_score,
    mou_status_score = EXCLUDED.mou_status_score,
    overall_score = EXCLUDED.overall_score,
    health_tier = EXCLUDED.health_tier,
    total_interactions = EXCLUDED.total_interactions,
    last_interaction_date = EXCLUDED.last_interaction_date,
    days_since_last_interaction = EXCLUDED.days_since_last_interaction,
    positive_interactions_percentage = EXCLUDED.positive_interactions_percentage,
    last_calculated_at = EXCLUDED.last_calculated_at,
    updated_at = NOW();

  RETURN v_overall_score;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- TRIGGERS
-- ================================================

-- Trigger to update health score after interaction
CREATE OR REPLACE FUNCTION trigger_update_health_after_interaction()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_relationship_health_score(NEW.stakeholder_type, NEW.stakeholder_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_health_after_interaction
  AFTER INSERT OR UPDATE ON stakeholder_interactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_health_after_interaction();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all stakeholder tables
CREATE TRIGGER set_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_colleges_updated_at
  BEFORE UPDATE ON colleges
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_industries_updated_at
  BEFORE UPDATE ON industries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_govt_updated_at
  BEFORE UPDATE ON government_stakeholders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_ngos_updated_at
  BEFORE UPDATE ON ngos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_speakers_updated_at
  BEFORE UPDATE ON speakers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_mous ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_health_scores ENABLE ROW LEVEL SECURITY;

-- Helper function to check chapter membership
CREATE OR REPLACE FUNCTION user_belongs_to_chapter(p_chapter_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND chapter_id = p_chapter_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for Schools
CREATE POLICY "Users can view schools in their chapter"
  ON schools FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert schools in their chapter"
  ON schools FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update schools in their chapter"
  ON schools FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete schools in their chapter"
  ON schools FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for Colleges (same pattern)
CREATE POLICY "Users can view colleges in their chapter"
  ON colleges FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert colleges in their chapter"
  ON colleges FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update colleges in their chapter"
  ON colleges FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete colleges in their chapter"
  ON colleges FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for Industries
CREATE POLICY "Users can view industries in their chapter"
  ON industries FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert industries in their chapter"
  ON industries FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update industries in their chapter"
  ON industries FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete industries in their chapter"
  ON industries FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for Government Stakeholders
CREATE POLICY "Users can view govt stakeholders in their chapter"
  ON government_stakeholders FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert govt stakeholders in their chapter"
  ON government_stakeholders FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update govt stakeholders in their chapter"
  ON government_stakeholders FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete govt stakeholders in their chapter"
  ON government_stakeholders FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for NGOs
CREATE POLICY "Users can view ngos in their chapter"
  ON ngos FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert ngos in their chapter"
  ON ngos FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update ngos in their chapter"
  ON ngos FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete ngos in their chapter"
  ON ngos FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for Vendors
CREATE POLICY "Users can view vendors in their chapter"
  ON vendors FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert vendors in their chapter"
  ON vendors FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update vendors in their chapter"
  ON vendors FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete vendors in their chapter"
  ON vendors FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for Speakers
CREATE POLICY "Users can view speakers in their chapter"
  ON speakers FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert speakers in their chapter"
  ON speakers FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update speakers in their chapter"
  ON speakers FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete speakers in their chapter"
  ON speakers FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for Shared Tables (polymorphic - no direct chapter_id)
CREATE POLICY "Users can view all stakeholder contacts"
  ON stakeholder_contacts FOR SELECT
  USING (true); -- Will be filtered in application layer

CREATE POLICY "Users can manage stakeholder contacts"
  ON stakeholder_contacts FOR ALL
  USING (true); -- Will be filtered in application layer

-- RLS Policies for Interactions
CREATE POLICY "Users can view interactions in their chapter"
  ON stakeholder_interactions FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert interactions in their chapter"
  ON stakeholder_interactions FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update interactions in their chapter"
  ON stakeholder_interactions FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete interactions in their chapter"
  ON stakeholder_interactions FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for MoUs
CREATE POLICY "Users can view mous in their chapter"
  ON stakeholder_mous FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can insert mous in their chapter"
  ON stakeholder_mous FOR INSERT
  WITH CHECK (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can update mous in their chapter"
  ON stakeholder_mous FOR UPDATE
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "Users can delete mous in their chapter"
  ON stakeholder_mous FOR DELETE
  USING (user_belongs_to_chapter(chapter_id));

-- RLS Policies for Documents
CREATE POLICY "Users can view all documents"
  ON stakeholder_documents FOR SELECT
  USING (true); -- Will be filtered in application layer

CREATE POLICY "Users can manage documents"
  ON stakeholder_documents FOR ALL
  USING (true); -- Will be filtered in application layer

-- RLS Policies for Health Scores
CREATE POLICY "Users can view health scores in their chapter"
  ON relationship_health_scores FOR SELECT
  USING (user_belongs_to_chapter(chapter_id));

CREATE POLICY "System can manage health scores"
  ON relationship_health_scores FOR ALL
  USING (true); -- Managed by triggers and functions

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE schools IS 'Schools database for Yi program delivery and engagement tracking';
COMMENT ON TABLE colleges IS 'Colleges database for Yuva and training programs';
COMMENT ON TABLE industries IS 'Industries database for CSR, sponsorships, and corporate engagement';
COMMENT ON TABLE government_stakeholders IS 'Government officials database for permissions and collaborations';
COMMENT ON TABLE ngos IS 'NGO partners database for joint projects and resource sharing';
COMMENT ON TABLE vendors IS 'Vendor database for event services and procurement';
COMMENT ON TABLE speakers IS 'Speakers and trainers database for expert engagement';
COMMENT ON TABLE stakeholder_interactions IS 'Interaction logging for all stakeholder types';
COMMENT ON TABLE stakeholder_mous IS 'MoU tracking and compliance management';
COMMENT ON TABLE relationship_health_scores IS 'Calculated relationship health scores for stakeholder engagement quality';

-- ================================================
-- END OF MIGRATION
-- ================================================
