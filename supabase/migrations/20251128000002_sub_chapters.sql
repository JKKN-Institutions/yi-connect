-- ============================================================================
-- Part 3: Sub-Chapters (Yuva/Thalir Chapters linked to Schools/Colleges)
-- Created: 2025-11-28
-- Description: Tables for Yuva/Thalir chapter management (student chapters)
-- ============================================================================

-- ============================================================================
-- TABLE: sub_chapters
-- Yuva/Thalir chapters linked to schools/colleges
-- These are student-led chapters within educational institutions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sub_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,

  -- Link to stakeholder (school or college)
  stakeholder_type TEXT NOT NULL CHECK (stakeholder_type IN ('school', 'college')),
  stakeholder_id UUID NOT NULL,

  -- Chapter details
  name TEXT NOT NULL,
  chapter_type TEXT NOT NULL CHECK (chapter_type IN ('thalir', 'yuva')),
  slug TEXT,

  -- Contact information
  contact_email TEXT,
  contact_phone TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'dormant', 'graduated')),
  established_date DATE,
  graduation_date DATE, -- When the chapter becomes inactive due to graduation

  -- Metrics (auto-updated via triggers)
  member_count INTEGER DEFAULT 0,
  active_member_count INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  total_impact INTEGER DEFAULT 0, -- Total students impacted

  -- Location (inherited from stakeholder but can be customized)
  city TEXT,
  district TEXT,

  -- Administration
  created_by UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(chapter_id, stakeholder_type, stakeholder_id),
  UNIQUE(chapter_id, slug)
);

-- Indexes
CREATE INDEX idx_sub_chapters_chapter ON sub_chapters(chapter_id);
CREATE INDEX idx_sub_chapters_stakeholder ON sub_chapters(stakeholder_type, stakeholder_id);
CREATE INDEX idx_sub_chapters_type ON sub_chapters(chapter_type);
CREATE INDEX idx_sub_chapters_status ON sub_chapters(status) WHERE status = 'active';
CREATE INDEX idx_sub_chapters_city ON sub_chapters(city);

COMMENT ON TABLE sub_chapters IS 'Yuva/Thalir student chapters linked to schools/colleges';
COMMENT ON COLUMN sub_chapters.chapter_type IS 'thalir = school students, yuva = college students';
COMMENT ON COLUMN sub_chapters.graduation_date IS 'Date when chapter members graduate and chapter becomes dormant';

-- ============================================================================
-- TABLE: sub_chapter_members
-- Members of student chapters (not Yi Erode members)
-- These are students who participate in chapter activities
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sub_chapter_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_chapter_id UUID NOT NULL REFERENCES public.sub_chapters(id) ON DELETE CASCADE,

  -- Student details
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Academic info
  class_year TEXT, -- e.g., "10th", "12th", "2nd Year"
  department TEXT, -- For colleges
  roll_number TEXT,
  expected_graduation DATE,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  left_date DATE,
  leave_reason TEXT,

  -- Participation metrics
  events_attended INTEGER DEFAULT 0,
  volunteer_hours DECIMAL(8,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(sub_chapter_id, email) -- Unique email per sub-chapter
);

-- Indexes
CREATE INDEX idx_sub_chapter_members_chapter ON sub_chapter_members(sub_chapter_id);
CREATE INDEX idx_sub_chapter_members_status ON sub_chapter_members(status) WHERE status = 'active';
CREATE INDEX idx_sub_chapter_members_name ON sub_chapter_members USING gin (full_name gin_trgm_ops);

COMMENT ON TABLE sub_chapter_members IS 'Student members of Yuva/Thalir chapters';
COMMENT ON COLUMN sub_chapter_members.class_year IS 'Current class/year of study';

-- ============================================================================
-- TABLE: sub_chapter_leads
-- Chapter lead assignments (student leads or Yi member mentors)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sub_chapter_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_chapter_id UUID NOT NULL REFERENCES public.sub_chapters(id) ON DELETE CASCADE,

  -- Lead can be a Yi member OR a sub-chapter member (student)
  member_id UUID REFERENCES public.members(id), -- Yi Erode member
  sub_chapter_member_id UUID REFERENCES public.sub_chapter_members(id), -- Student member

  -- Role
  role TEXT NOT NULL CHECK (role IN ('lead', 'co_lead', 'mentor', 'coordinator')),
  title TEXT, -- e.g., "Chapter President", "Secretary"

  -- Status
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,

  -- Appointment
  appointed_by UUID REFERENCES public.members(id),
  appointment_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints: Must have either member_id OR sub_chapter_member_id
  CONSTRAINT lead_must_have_reference CHECK (
    (member_id IS NOT NULL AND sub_chapter_member_id IS NULL) OR
    (member_id IS NULL AND sub_chapter_member_id IS NOT NULL)
  ),
  -- Unique active lead per sub-chapter per role type
  CONSTRAINT unique_active_lead UNIQUE (sub_chapter_id, role, is_active)
    -- Note: This prevents duplicate active leads of same role
);

-- Indexes
CREATE INDEX idx_sub_chapter_leads_chapter ON sub_chapter_leads(sub_chapter_id);
CREATE INDEX idx_sub_chapter_leads_member ON sub_chapter_leads(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX idx_sub_chapter_leads_student ON sub_chapter_leads(sub_chapter_member_id) WHERE sub_chapter_member_id IS NOT NULL;
CREATE INDEX idx_sub_chapter_leads_active ON sub_chapter_leads(is_active) WHERE is_active = true;

COMMENT ON TABLE sub_chapter_leads IS 'Lead assignments for student chapters (Yi mentors or student leads)';
COMMENT ON COLUMN sub_chapter_leads.member_id IS 'Yi Erode member acting as mentor';
COMMENT ON COLUMN sub_chapter_leads.sub_chapter_member_id IS 'Student member acting as lead';

-- ============================================================================
-- TABLE: sub_chapter_events
-- Events organized by or for sub-chapters
-- Links to main events table or standalone chapter events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sub_chapter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_chapter_id UUID NOT NULL REFERENCES public.sub_chapters(id) ON DELETE CASCADE,

  -- Can be linked to main event or standalone
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,

  -- Event details (if standalone)
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue TEXT,

  -- Type
  event_type TEXT CHECK (event_type IN (
    'meeting', 'workshop', 'competition', 'community_service',
    'awareness_campaign', 'celebration', 'sports', 'cultural', 'other'
  )),

  -- Participation
  expected_attendance INTEGER,
  actual_attendance INTEGER,
  external_participants INTEGER DEFAULT 0,

  -- Outcomes
  impact_description TEXT,
  photos_url TEXT[],
  report_url TEXT,

  -- Status
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'completed', 'cancelled')),

  -- Tracking
  created_by UUID REFERENCES public.sub_chapter_members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sub_chapter_events_chapter ON sub_chapter_events(sub_chapter_id);
CREATE INDEX idx_sub_chapter_events_event ON sub_chapter_events(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_sub_chapter_events_date ON sub_chapter_events(event_date);
CREATE INDEX idx_sub_chapter_events_status ON sub_chapter_events(status);

COMMENT ON TABLE sub_chapter_events IS 'Events organized by student chapters';

-- ============================================================================
-- FUNCTION: is_sub_chapter_lead
-- Checks if user is lead for a specific sub-chapter or any sub-chapter
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_sub_chapter_lead(
  p_user_id UUID DEFAULT NULL,
  p_sub_chapter_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_sub_chapter_id IS NOT NULL THEN
    -- Check for specific sub-chapter
    RETURN EXISTS (
      SELECT 1 FROM sub_chapter_leads scl
      WHERE scl.member_id = v_user_id
      AND scl.sub_chapter_id = p_sub_chapter_id
      AND scl.is_active = TRUE
    );
  ELSE
    -- Check if user is lead of any sub-chapter
    RETURN EXISTS (
      SELECT 1 FROM sub_chapter_leads scl
      WHERE scl.member_id = v_user_id
      AND scl.is_active = TRUE
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_sub_chapter_lead IS 'Checks if user is active lead for a sub-chapter';

-- Grant execute
GRANT EXECUTE ON FUNCTION public.is_sub_chapter_lead(UUID, UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: get_user_sub_chapters
-- Returns all sub-chapter IDs where user is active lead/mentor
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_sub_chapters(p_user_id UUID DEFAULT NULL)
RETURNS UUID[] AS $$
DECLARE
  v_user_id UUID;
  v_sub_chapters UUID[];
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  SELECT COALESCE(ARRAY_AGG(scl.sub_chapter_id), ARRAY[]::UUID[])
  INTO v_sub_chapters
  FROM sub_chapter_leads scl
  WHERE scl.member_id = v_user_id
  AND scl.is_active = TRUE;

  RETURN v_sub_chapters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_sub_chapters IS 'Returns array of sub-chapter IDs where user is active lead';

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_user_sub_chapters(UUID) TO authenticated;

-- ============================================================================
-- TRIGGERS: Auto-update member counts
-- ============================================================================

-- Function to update sub_chapter member counts
CREATE OR REPLACE FUNCTION update_sub_chapter_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sub_chapters
    SET member_count = member_count + 1,
        active_member_count = CASE WHEN NEW.status = 'active' THEN active_member_count + 1 ELSE active_member_count END,
        updated_at = now()
    WHERE id = NEW.sub_chapter_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sub_chapters
    SET member_count = GREATEST(0, member_count - 1),
        active_member_count = CASE WHEN OLD.status = 'active' THEN GREATEST(0, active_member_count - 1) ELSE active_member_count END,
        updated_at = now()
    WHERE id = OLD.sub_chapter_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle status change
    IF OLD.status != NEW.status THEN
      IF OLD.status = 'active' AND NEW.status != 'active' THEN
        UPDATE sub_chapters
        SET active_member_count = GREATEST(0, active_member_count - 1),
            updated_at = now()
        WHERE id = NEW.sub_chapter_id;
      ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
        UPDATE sub_chapters
        SET active_member_count = active_member_count + 1,
            updated_at = now()
        WHERE id = NEW.sub_chapter_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sub_chapter_member_count
AFTER INSERT OR UPDATE OR DELETE ON sub_chapter_members
FOR EACH ROW
EXECUTE FUNCTION update_sub_chapter_member_count();

-- Function to update sub_chapter event counts
CREATE OR REPLACE FUNCTION update_sub_chapter_event_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sub_chapters
    SET events_count = events_count + 1,
        total_impact = total_impact + COALESCE(NEW.actual_attendance, 0),
        updated_at = now()
    WHERE id = NEW.sub_chapter_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sub_chapters
    SET events_count = GREATEST(0, events_count - 1),
        total_impact = GREATEST(0, total_impact - COALESCE(OLD.actual_attendance, 0)),
        updated_at = now()
    WHERE id = OLD.sub_chapter_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update impact if attendance changed
    IF COALESCE(OLD.actual_attendance, 0) != COALESCE(NEW.actual_attendance, 0) THEN
      UPDATE sub_chapters
      SET total_impact = GREATEST(0, total_impact - COALESCE(OLD.actual_attendance, 0) + COALESCE(NEW.actual_attendance, 0)),
          updated_at = now()
      WHERE id = NEW.sub_chapter_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sub_chapter_event_count
AFTER INSERT OR UPDATE OR DELETE ON sub_chapter_events
FOR EACH ROW
EXECUTE FUNCTION update_sub_chapter_event_count();

-- Updated_at triggers
CREATE TRIGGER set_sub_chapters_updated_at
BEFORE UPDATE ON sub_chapters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_sub_chapter_members_updated_at
BEFORE UPDATE ON sub_chapter_members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_sub_chapter_leads_updated_at
BEFORE UPDATE ON sub_chapter_leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_sub_chapter_events_updated_at
BEFORE UPDATE ON sub_chapter_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE sub_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_chapter_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_chapter_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_chapter_events ENABLE ROW LEVEL SECURITY;

-- Sub-chapters: Read by chapter members, manage by leads/chairs
CREATE POLICY "sub_chapters_select_policy" ON sub_chapters
  FOR SELECT USING (
    user_belongs_to_chapter(chapter_id)
  );

CREATE POLICY "sub_chapters_insert_policy" ON sub_chapters
  FOR INSERT WITH CHECK (
    user_belongs_to_chapter(chapter_id)
    AND (
      get_user_hierarchy_level() >= 3  -- Co-Chair+
      OR is_vertical_chair()            -- Any vertical chair
    )
  );

CREATE POLICY "sub_chapters_update_policy" ON sub_chapters
  FOR UPDATE USING (
    user_belongs_to_chapter(chapter_id)
    AND (
      get_user_hierarchy_level() >= 3
      OR is_vertical_chair()
      OR is_sub_chapter_lead(auth.uid(), id)
    )
  );

CREATE POLICY "sub_chapters_delete_policy" ON sub_chapters
  FOR DELETE USING (
    get_user_hierarchy_level() >= 4  -- Chair+ only
  );

-- Sub-chapter members: Read by chapter members, manage by leads
CREATE POLICY "sub_chapter_members_select_policy" ON sub_chapter_members
  FOR SELECT USING (
    sub_chapter_id IN (
      SELECT id FROM sub_chapters WHERE user_belongs_to_chapter(chapter_id)
    )
  );

CREATE POLICY "sub_chapter_members_insert_policy" ON sub_chapter_members
  FOR INSERT WITH CHECK (
    sub_chapter_id IN (
      SELECT id FROM sub_chapters WHERE user_belongs_to_chapter(chapter_id)
    )
    AND (
      get_user_hierarchy_level() >= 3
      OR is_sub_chapter_lead(auth.uid(), sub_chapter_id)
    )
  );

CREATE POLICY "sub_chapter_members_update_policy" ON sub_chapter_members
  FOR UPDATE USING (
    sub_chapter_id IN (
      SELECT id FROM sub_chapters WHERE user_belongs_to_chapter(chapter_id)
    )
    AND (
      get_user_hierarchy_level() >= 3
      OR is_sub_chapter_lead(auth.uid(), sub_chapter_id)
    )
  );

-- Archive only (Rule 4: Chapter leads cannot delete, only archive)
CREATE POLICY "sub_chapter_members_delete_policy" ON sub_chapter_members
  FOR DELETE USING (
    get_user_hierarchy_level() >= 5  -- Executive Member+ only
  );

-- Sub-chapter leads: Read by chapter members, manage by chairs
CREATE POLICY "sub_chapter_leads_select_policy" ON sub_chapter_leads
  FOR SELECT USING (
    sub_chapter_id IN (
      SELECT id FROM sub_chapters WHERE user_belongs_to_chapter(chapter_id)
    )
  );

CREATE POLICY "sub_chapter_leads_insert_policy" ON sub_chapter_leads
  FOR INSERT WITH CHECK (
    get_user_hierarchy_level() >= 3  -- Co-Chair+
    OR is_vertical_chair()
  );

CREATE POLICY "sub_chapter_leads_update_policy" ON sub_chapter_leads
  FOR UPDATE USING (
    get_user_hierarchy_level() >= 3
    OR is_vertical_chair()
  );

-- Sub-chapter events: Read by all chapter members, manage by leads
CREATE POLICY "sub_chapter_events_select_policy" ON sub_chapter_events
  FOR SELECT USING (
    sub_chapter_id IN (
      SELECT id FROM sub_chapters WHERE user_belongs_to_chapter(chapter_id)
    )
  );

CREATE POLICY "sub_chapter_events_insert_policy" ON sub_chapter_events
  FOR INSERT WITH CHECK (
    sub_chapter_id IN (
      SELECT id FROM sub_chapters WHERE user_belongs_to_chapter(chapter_id)
    )
    AND (
      get_user_hierarchy_level() >= 2  -- EC+
      OR is_sub_chapter_lead(auth.uid(), sub_chapter_id)
    )
  );

CREATE POLICY "sub_chapter_events_update_policy" ON sub_chapter_events
  FOR UPDATE USING (
    sub_chapter_id IN (
      SELECT id FROM sub_chapters WHERE user_belongs_to_chapter(chapter_id)
    )
    AND (
      get_user_hierarchy_level() >= 2
      OR is_sub_chapter_lead(auth.uid(), sub_chapter_id)
    )
  );

-- ============================================================================
-- VIEW: sub_chapter_summary
-- Summary view for chapter health dashboards
-- ============================================================================
CREATE VIEW sub_chapter_summary AS
SELECT
  sc.id,
  sc.chapter_id,
  sc.name,
  sc.chapter_type,
  sc.status,
  sc.member_count,
  sc.active_member_count,
  sc.events_count,
  sc.total_impact,
  sc.established_date,
  sc.city,
  -- Lead info
  scl_lead.full_name AS lead_name,
  scl_lead.member_id AS lead_member_id,
  -- Stakeholder info
  sc.stakeholder_type,
  sc.stakeholder_id,
  CASE
    WHEN sc.stakeholder_type = 'school' THEN (SELECT school_name FROM schools WHERE id = sc.stakeholder_id)
    WHEN sc.stakeholder_type = 'college' THEN (SELECT college_name FROM colleges WHERE id = sc.stakeholder_id)
  END AS stakeholder_name,
  -- Recent activity
  (
    SELECT MAX(event_date) FROM sub_chapter_events
    WHERE sub_chapter_id = sc.id AND status = 'completed'
  ) AS last_event_date,
  -- Calculate activity score (simplified version of Part3 formula)
  (
    LEAST(40, (
      SELECT COUNT(*) FROM sub_chapter_events
      WHERE sub_chapter_id = sc.id
      AND event_date >= CURRENT_DATE - INTERVAL '90 days'
      AND status = 'completed'
    ) * 10)  -- Events this quarter: 40 pts max
    +
    LEAST(30, CASE WHEN sc.member_count > 0 THEN (sc.active_member_count::DECIMAL / sc.member_count * 30) ELSE 0 END)  -- Participation: 30 pts max
    +
    LEAST(20, CASE WHEN sc.events_count > 0 THEN (sc.total_impact::DECIMAL / sc.events_count / 50 * 20) ELSE 0 END)  -- Impact: 20 pts max
    +
    CASE WHEN scl_lead.member_id IS NOT NULL THEN 10 ELSE 0 END  -- Has lead: 10 pts
  )::INTEGER AS activity_score
FROM sub_chapters sc
LEFT JOIN LATERAL (
  SELECT m.full_name, scl.member_id
  FROM sub_chapter_leads scl
  LEFT JOIN members m ON scl.member_id = m.id
  WHERE scl.sub_chapter_id = sc.id
  AND scl.role = 'lead'
  AND scl.is_active = true
  LIMIT 1
) scl_lead ON true;

COMMENT ON VIEW sub_chapter_summary IS 'Summary view for sub-chapter health dashboard with activity scores';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
