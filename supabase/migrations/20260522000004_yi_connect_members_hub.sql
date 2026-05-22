-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Member Intelligence Hub lifted to yi_connect.*
-- Phase A Batch 2
--
-- Lifts public.* member-related tables, enums, indexes, RLS, triggers,
-- and functions into yi_connect.* with these transformations:
--   - All yi-connect tables → yi_connect schema
--   - chapters FKs → yi.chapters (shared canonical chapter list)
--   - ENUMs → yi_connect.* schema (avoid global namespace collision)
--   - Functions → yi_connect.* schema
--   - Triggers reference yi_connect.update_updated_at_column()
--
-- Source: 20251109000002_member_intelligence_hub.sql (792 lines)
-- ═══════════════════════════════════════════════════════════════════════

--
-- Member Intelligence Hub Module
-- Centralized member database with skills, certifications, and engagement tracking
--

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE yi_connect.proficiency_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE yi_connect.availability_status AS ENUM ('available', 'busy', 'unavailable');
CREATE TYPE yi_connect.skill_category AS ENUM (
  'technical',
  'business',
  'creative',
  'leadership',
  'communication',
  'other'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Skills Master Table
CREATE TABLE IF NOT EXISTS yi_connect.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category yi_connect.skill_category NOT NULL DEFAULT 'other',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Certifications Master Table
CREATE TABLE IF NOT EXISTS yi_connect.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  description TEXT,
  validity_period_months INTEGER, -- NULL means no expiry
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members Table (extends profiles with chapter-specific data)
CREATE TABLE IF NOT EXISTS yi_connect.members (
  id UUID PRIMARY KEY REFERENCES yi_connect.profiles(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES yi.chapters(id),
  membership_number TEXT UNIQUE,
  member_since DATE NOT NULL DEFAULT CURRENT_DATE,
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'inactive', 'suspended', 'alumni')),

  -- Professional Information
  company TEXT,
  designation TEXT,
  industry TEXT,
  years_of_experience INTEGER,
  linkedin_url TEXT,

  -- Personal Information
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  pincode TEXT,

  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,

  -- Preferences
  interests TEXT[], -- Array of interests
  preferred_event_types TEXT[], -- Array of event types
  communication_preferences JSONB DEFAULT '{"email": true, "sms": true, "whatsapp": true}'::jsonb,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Member Skills Junction Table
CREATE TABLE IF NOT EXISTS yi_connect.member_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES yi_connect.skills(id) ON DELETE CASCADE,
  proficiency yi_connect.proficiency_level NOT NULL DEFAULT 'beginner',
  years_of_experience INTEGER DEFAULT 0,
  is_willing_to_mentor BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(member_id, skill_id)
);

-- Member Certifications Junction Table
CREATE TABLE IF NOT EXISTS yi_connect.member_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES yi_connect.certifications(id) ON DELETE CASCADE,
  certificate_number TEXT,
  issued_date DATE NOT NULL,
  expiry_date DATE,
  document_url TEXT, -- Link to certificate document in storage
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Member Availability Calendar
CREATE TABLE IF NOT EXISTS yi_connect.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status yi_connect.availability_status NOT NULL DEFAULT 'available',
  time_slots JSONB, -- {"morning": "available", "afternoon": "busy", "evening": "available"}
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(member_id, date)
);

-- Engagement Metrics (auto-calculated)
CREATE TABLE IF NOT EXISTS yi_connect.engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,

  -- Participation Metrics
  total_events_attended INTEGER DEFAULT 0,
  events_attended_last_3_months INTEGER DEFAULT 0,
  events_attended_last_6_months INTEGER DEFAULT 0,
  events_organized INTEGER DEFAULT 0,
  volunteer_hours DECIMAL(10, 2) DEFAULT 0,

  -- Contribution Metrics
  total_contributions INTEGER DEFAULT 0, -- presentations, blog posts, etc.
  feedback_given INTEGER DEFAULT 0,
  referrals_made INTEGER DEFAULT 0,

  -- Engagement Score (0-100)
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),

  -- Activity Tracking
  last_event_date DATE,
  last_activity_date TIMESTAMPTZ,

  -- Metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(member_id)
);

-- Leadership Readiness Assessment (auto-calculated)
CREATE TABLE IF NOT EXISTS yi_connect.leadership_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,

  -- Score Components (each 0-100)
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  tenure_score INTEGER DEFAULT 0 CHECK (tenure_score >= 0 AND tenure_score <= 100),
  skills_score INTEGER DEFAULT 0 CHECK (skills_score >= 0 AND skills_score <= 100),
  leadership_experience_score INTEGER DEFAULT 0 CHECK (leadership_experience_score >= 0 AND leadership_experience_score <= 100),
  training_score INTEGER DEFAULT 0 CHECK (training_score >= 0 AND training_score <= 100),

  -- Overall Readiness Score (weighted average)
  readiness_score INTEGER DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100),

  -- Readiness Level
  readiness_level TEXT CHECK (readiness_level IN ('not_ready', 'developing', 'ready', 'highly_ready')),

  -- Recommendations
  strengths TEXT[],
  areas_for_development TEXT[],
  recommended_roles TEXT[],
  recommended_training TEXT[],

  -- Metadata
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_assessment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(member_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Members indexes
CREATE INDEX idx_members_chapter ON yi_connect.members(chapter_id);
CREATE INDEX idx_members_status ON yi_connect.members(membership_status) WHERE is_active = true;
CREATE INDEX idx_members_company ON yi_connect.members(company);
CREATE INDEX idx_members_city ON yi_connect.members(city);

-- Member Skills indexes
CREATE INDEX idx_member_skills_member ON yi_connect.member_skills(member_id);
CREATE INDEX idx_member_skills_skill ON yi_connect.member_skills(skill_id);
CREATE INDEX idx_member_skills_proficiency ON yi_connect.member_skills(proficiency);
CREATE INDEX idx_member_skills_mentor ON yi_connect.member_skills(is_willing_to_mentor) WHERE is_willing_to_mentor = true;

-- Member Certifications indexes
CREATE INDEX idx_member_certifications_member ON yi_connect.member_certifications(member_id);
CREATE INDEX idx_member_certifications_expiry ON yi_connect.member_certifications(expiry_date) WHERE expiry_date IS NOT NULL;

-- Availability indexes
CREATE INDEX idx_availability_member ON yi_connect.availability(member_id);
CREATE INDEX idx_availability_date ON yi_connect.availability(date);
CREATE INDEX idx_availability_status ON yi_connect.availability(status, date);

-- Engagement Metrics indexes
CREATE INDEX idx_engagement_score ON yi_connect.engagement_metrics(engagement_score DESC);
CREATE INDEX idx_last_activity ON yi_connect.engagement_metrics(last_activity_date DESC);

-- Leadership Assessment indexes
CREATE INDEX idx_readiness_score ON yi_connect.leadership_assessments(readiness_score DESC);
CREATE INDEX idx_readiness_level ON yi_connect.leadership_assessments(readiness_level);

-- Skills indexes
CREATE INDEX idx_skills_category ON yi_connect.skills(category) WHERE is_active = true;
CREATE INDEX idx_skills_name ON yi_connect.skills(name) WHERE is_active = true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE yi_connect.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.member_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.member_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.leadership_assessments ENABLE ROW LEVEL SECURITY;

-- Skills Policies (Read-only for all authenticated users, write for admins)
CREATE POLICY "Skills are viewable by all authenticated users"
  ON yi_connect.skills FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Skills are manageable by admins"
  ON yi_connect.skills FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 4 -- Chair and above
    )
  );

-- Certifications Policies (Read-only for all, write for admins)
CREATE POLICY "Certifications are viewable by all authenticated users"
  ON yi_connect.certifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Certifications are manageable by admins"
  ON yi_connect.certifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 4 -- Chair and above
    )
  );

-- Members Policies
CREATE POLICY "Members can view members in their chapter"
  ON yi_connect.members FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid()
    )
  );

CREATE POLICY "Members can update their own profile"
  ON yi_connect.members FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage all members in their chapter"
  ON yi_connect.members FOR ALL
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM yi_connect.members m
      WHERE m.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  );

-- Member Skills Policies
CREATE POLICY "Members can view skills of members in their chapter"
  ON yi_connect.member_skills FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM yi_connect.members
      WHERE chapter_id IN (
        SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can manage their own skills"
  ON yi_connect.member_skills FOR ALL
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Admins can manage member skills"
  ON yi_connect.member_skills FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3
    )
  );

-- Member Certifications Policies
CREATE POLICY "Members can view certifications of members in their chapter"
  ON yi_connect.member_certifications FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM yi_connect.members
      WHERE chapter_id IN (
        SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can manage their own certifications"
  ON yi_connect.member_certifications FOR ALL
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Admins can manage member certifications"
  ON yi_connect.member_certifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3
    )
  );

-- Availability Policies
CREATE POLICY "Members can view availability of members in their chapter"
  ON yi_connect.availability FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM yi_connect.members
      WHERE chapter_id IN (
        SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can manage their own availability"
  ON yi_connect.availability FOR ALL
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- Engagement Metrics Policies (Read-only, auto-calculated)
CREATE POLICY "Members can view engagement metrics in their chapter"
  ON yi_connect.engagement_metrics FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM yi_connect.members
      WHERE chapter_id IN (
        SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid()
      )
    )
  );

-- Leadership Assessments Policies (Read-only for members, write for admins)
CREATE POLICY "Members can view leadership assessments in their chapter"
  ON yi_connect.leadership_assessments FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM yi_connect.members
      WHERE chapter_id IN (
        SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage leadership assessments"
  ON yi_connect.leadership_assessments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 4 -- Chair and above
    )
  );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON yi_connect.skills
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_certifications_updated_at BEFORE UPDATE ON yi_connect.certifications
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON yi_connect.members
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_member_skills_updated_at BEFORE UPDATE ON yi_connect.member_skills
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_member_certifications_updated_at BEFORE UPDATE ON yi_connect.member_certifications
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON yi_connect.availability
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_engagement_metrics_updated_at BEFORE UPDATE ON yi_connect.engagement_metrics
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_leadership_assessments_updated_at BEFORE UPDATE ON yi_connect.leadership_assessments
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function: Calculate Engagement Score
-- Calculates member engagement score based on participation metrics
CREATE OR REPLACE FUNCTION yi_connect.calculate_engagement_score(p_member_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_events_3m INTEGER;
  v_events_6m INTEGER;
  v_events_total INTEGER;
  v_volunteer_hours DECIMAL;
  v_contributions INTEGER;
  v_days_since_last_event INTEGER;
BEGIN
  -- Get metrics
  SELECT
    events_attended_last_3_months,
    events_attended_last_6_months,
    total_events_attended,
    volunteer_hours,
    total_contributions,
    COALESCE(CURRENT_DATE - last_event_date, 999)
  INTO
    v_events_3m, v_events_6m, v_events_total, v_volunteer_hours, v_contributions, v_days_since_last_event
  FROM yi_connect.engagement_metrics
  WHERE member_id = p_member_id;

  -- Calculate score components (max 100)
  -- Recent activity (3 months) - 40 points
  v_score := v_score + LEAST(v_events_3m * 8, 40);

  -- Medium-term activity (6 months) - 20 points
  v_score := v_score + LEAST(v_events_6m * 3, 20);

  -- Volunteer hours - 20 points (1 point per 2 hours, max 20)
  v_score := v_score + LEAST(v_volunteer_hours / 2, 20);

  -- Contributions - 10 points
  v_score := v_score + LEAST(v_contributions * 2, 10);

  -- Recency bonus/penalty - 10 points
  IF v_days_since_last_event <= 30 THEN
    v_score := v_score + 10;
  ELSIF v_days_since_last_event <= 60 THEN
    v_score := v_score + 5;
  ELSIF v_days_since_last_event >= 180 THEN
    v_score := v_score - 10;
  END IF;

  -- Ensure score is between 0 and 100
  v_score := GREATEST(0, LEAST(100, v_score));

  -- Update engagement metrics
  UPDATE yi_connect.engagement_metrics
  SET
    engagement_score = v_score,
    calculated_at = now(),
    updated_at = now()
  WHERE member_id = p_member_id;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate Leadership Readiness Score
-- Calculates leadership readiness based on multiple factors
CREATE OR REPLACE FUNCTION yi_connect.calculate_leadership_readiness(p_member_id UUID)
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
BEGIN
  -- Get engagement score
  SELECT engagement_score INTO v_engagement
  FROM yi_connect.engagement_metrics
  WHERE member_id = p_member_id;
  v_engagement := COALESCE(v_engagement, 0);

  -- Calculate tenure score (0-100 based on years)
  SELECT member_since INTO v_member_since
  FROM yi_connect.members
  WHERE id = p_member_id;

  v_tenure := LEAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_member_since)) * 20, 100);

  -- Calculate skills score based on count and proficiency
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE proficiency IN ('advanced', 'expert'))
  INTO v_skills_count, v_advanced_skills
  FROM yi_connect.member_skills
  WHERE member_id = p_member_id;

  v_skills := LEAST((v_skills_count * 5) + (v_advanced_skills * 10), 100);

  -- Leadership experience score (placeholder - will be enhanced with actual data)
  v_leadership_exp := 50; -- TODO: Calculate from actual leadership roles

  -- Training score (placeholder - will be enhanced with actual training data)
  v_training := 50; -- TODO: Calculate from actual training completions

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
  INSERT INTO yi_connect.leadership_assessments (
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

-- Function: Get Skill Gaps
-- Analyzes chapter-wide skill gaps
CREATE OR REPLACE FUNCTION yi_connect.get_skill_gaps(p_chapter_id UUID)
RETURNS TABLE (
  skill_id UUID,
  skill_name TEXT,
  skill_category yi_connect.skill_category,
  total_members_with_skill BIGINT,
  beginner_count BIGINT,
  intermediate_count BIGINT,
  advanced_count BIGINT,
  expert_count BIGINT,
  avg_proficiency NUMERIC,
  mentors_available BIGINT,
  gap_severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.category,
    COUNT(DISTINCT ms.member_id) as total_members,
    COUNT(*) FILTER (WHERE ms.proficiency = 'beginner') as beginner,
    COUNT(*) FILTER (WHERE ms.proficiency = 'intermediate') as intermediate,
    COUNT(*) FILTER (WHERE ms.proficiency = 'advanced') as advanced,
    COUNT(*) FILTER (WHERE ms.proficiency = 'expert') as expert,
    AVG(
      CASE ms.proficiency
        WHEN 'beginner' THEN 1
        WHEN 'intermediate' THEN 2
        WHEN 'advanced' THEN 3
        WHEN 'expert' THEN 4
      END
    )::NUMERIC(3,2) as avg_prof,
    COUNT(*) FILTER (WHERE ms.is_willing_to_mentor = true) as mentors,
    CASE
      WHEN COUNT(DISTINCT ms.member_id) = 0 THEN 'critical'
      WHEN COUNT(DISTINCT ms.member_id) < 3 THEN 'high'
      WHEN COUNT(DISTINCT ms.member_id) < 5 THEN 'medium'
      ELSE 'low'
    END as gap_severity
  FROM yi_connect.skills s
  LEFT JOIN yi_connect.member_skills ms ON s.id = ms.skill_id
  LEFT JOIN yi_connect.members m ON ms.member_id = m.id
  WHERE s.is_active = true
    AND (m.chapter_id = p_chapter_id OR m.chapter_id IS NULL)
  GROUP BY s.id, s.name, s.category
  ORDER BY gap_severity DESC, s.category, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Trigger: Auto-create engagement metrics for new members
CREATE OR REPLACE FUNCTION yi_connect.init_member_engagement()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO yi_connect.engagement_metrics (member_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_created
  AFTER INSERT ON yi_connect.members
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.init_member_engagement();

-- Trigger: Auto-create leadership assessment for new members
CREATE OR REPLACE FUNCTION yi_connect.init_leadership_assessment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO yi_connect.leadership_assessments (
    member_id,
    readiness_level,
    next_assessment_date
  )
  VALUES (
    NEW.id,
    'not_ready',
    CURRENT_DATE + INTERVAL '3 months'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_created_assessment
  AFTER INSERT ON yi_connect.members
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.init_leadership_assessment();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert common skills
INSERT INTO yi_connect.skills (name, category, description) VALUES
  -- Technical Skills
  ('Web Development', 'technical', 'Frontend and backend web development'),
  ('Mobile App Development', 'technical', 'iOS and Android app development'),
  ('Data Analytics', 'technical', 'Data analysis and visualization'),
  ('Machine Learning', 'technical', 'AI and ML model development'),
  ('Cloud Computing', 'technical', 'AWS, Azure, GCP expertise'),
  ('DevOps', 'technical', 'CI/CD, containerization, automation'),
  ('Cybersecurity', 'technical', 'Information security and ethical hacking'),
  ('Database Management', 'technical', 'SQL, NoSQL database administration'),

  -- Business Skills
  ('Project Management', 'business', 'Agile, Scrum, project planning'),
  ('Business Strategy', 'business', 'Strategic planning and execution'),
  ('Financial Management', 'business', 'Budgeting, forecasting, financial analysis'),
  ('Marketing', 'business', 'Digital marketing and brand management'),
  ('Sales', 'business', 'Sales strategy and customer acquisition'),
  ('Operations Management', 'business', 'Process optimization and operations'),
  ('Product Management', 'business', 'Product strategy and roadmap'),
  ('Entrepreneurship', 'business', 'Startup and business development'),

  -- Creative Skills
  ('Graphic Design', 'creative', 'Visual design and branding'),
  ('UI/UX Design', 'creative', 'User interface and experience design'),
  ('Content Writing', 'creative', 'Copywriting and content creation'),
  ('Photography', 'creative', 'Professional photography'),
  ('Video Production', 'creative', 'Video editing and production'),
  ('Event Planning', 'creative', 'Event coordination and management'),

  -- Leadership Skills
  ('Team Leadership', 'leadership', 'Leading and motivating teams'),
  ('Public Speaking', 'leadership', 'Presentations and speeches'),
  ('Mentoring', 'leadership', 'Coaching and mentoring others'),
  ('Conflict Resolution', 'leadership', 'Mediation and problem-solving'),
  ('Strategic Thinking', 'leadership', 'Long-term vision and planning'),
  ('Decision Making', 'leadership', 'Critical thinking and decisions'),

  -- Communication Skills
  ('Written Communication', 'communication', 'Professional writing'),
  ('Verbal Communication', 'communication', 'Effective speaking'),
  ('Presentation Skills', 'communication', 'Slide decks and delivery'),
  ('Networking', 'communication', 'Building professional relationships'),
  ('Negotiation', 'communication', 'Deal-making and agreements')
ON CONFLICT (name) DO NOTHING;

-- Insert common certifications
INSERT INTO yi_connect.certifications (name, issuing_organization, validity_period_months) VALUES
  ('PMP', 'Project Management Institute', 36),
  ('Certified Scrum Master', 'Scrum Alliance', 24),
  ('AWS Certified Solutions Architect', 'Amazon Web Services', 36),
  ('Google Cloud Professional', 'Google Cloud', 24),
  ('Certified Ethical Hacker', 'EC-Council', 36),
  ('Six Sigma Black Belt', 'ASQ', NULL),
  ('CFA', 'CFA Institute', NULL),
  ('Digital Marketing Certification', 'Google', NULL),
  ('Lean Six Sigma', 'IASSC', NULL),
  ('ITIL Foundation', 'Axelos', NULL)
ON CONFLICT DO NOTHING;
