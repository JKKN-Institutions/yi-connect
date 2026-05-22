-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Ops infrastructure (Batch 9, final revised)
-- 3 of 7 ops migrations:
--   - security_functions
--   - sub_chapters
--   - institution_scoped_rls
--
-- SKIPPED:
--   - session_bookings (needs trainer_profiles)
--   - business_rules_enforcement (needs trainer_profiles)
--   - reports_system (has multiple members.full_name bugs in source;
--     needs source-level fix or careful column re-mapping to profiles)
--   - cron_setup (needs pg_cron extension)
-- ═══════════════════════════════════════════════════════════════════════

SET search_path TO yi_connect, public, extensions;
DROP FUNCTION IF EXISTS yi_connect.get_user_hierarchy_level(UUID) CASCADE;
DROP FUNCTION IF EXISTS yi_connect.get_user_hierarchy_level() CASCADE;


-- ── 20251128000001_security_functions.sql ─────────────────────────────────
-- ============================================================================
-- Part 3 Security Functions Migration
-- Created: 2025-11-28
-- Description: Core security functions for access control and permissions
-- ============================================================================

-- ============================================================================
-- FUNCTION: get_user_hierarchy_level
-- Returns the highest hierarchy level for the authenticated or specified user
-- Used by RLS policies throughout the application
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.get_user_hierarchy_level(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID;
  v_level INTEGER;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(MAX(r.hierarchy_level), 0)
  INTO v_level
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = v_user_id;

  RETURN v_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- (no-arg overload removed; calls to get_user_hierarchy_level() resolve to the DEFAULT-NULL variant)

COMMENT ON FUNCTION yi_connect.get_user_hierarchy_level(UUID) IS 'Returns highest hierarchy level for specified user';

-- ============================================================================
-- FUNCTION: get_user_roles
-- Returns all roles for a user with permissions (for application-level checks)
-- Called by lib/auth.ts
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.get_user_roles(p_user_id UUID)
RETURNS TABLE(
  role_id UUID,
  role_name TEXT,
  hierarchy_level INTEGER,
  permissions TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.name, r.hierarchy_level, r.permissions
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.get_user_roles IS 'Returns all roles with permissions for a user';

-- ============================================================================
-- FUNCTION: is_vertical_chair
-- Checks if user is chair/co-chair for a specific vertical or any vertical
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.is_vertical_chair(
  p_user_id UUID DEFAULT NULL,
  p_vertical_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_vertical_id IS NOT NULL THEN
    -- Check for specific vertical
    RETURN EXISTS (
      SELECT 1 FROM vertical_chairs vc
      WHERE vc.member_id = v_user_id
      AND vc.vertical_id = p_vertical_id
      AND vc.is_active = TRUE
    );
  ELSE
    -- Check if user is chair of any vertical
    RETURN EXISTS (
      SELECT 1 FROM vertical_chairs vc
      WHERE vc.member_id = v_user_id
      AND vc.is_active = TRUE
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.is_vertical_chair IS 'Checks if user is active chair/co-chair for a vertical';

-- ============================================================================
-- FUNCTION: get_user_verticals
-- Returns all vertical IDs where user is chair/co-chair
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.get_user_verticals(p_user_id UUID DEFAULT NULL)
RETURNS UUID[] AS $$
DECLARE
  v_user_id UUID;
  v_verticals UUID[];
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  SELECT COALESCE(ARRAY_AGG(vc.vertical_id), ARRAY[]::UUID[])
  INTO v_verticals
  FROM vertical_chairs vc
  WHERE vc.member_id = v_user_id
  AND vc.is_active = TRUE;

  RETURN v_verticals;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.get_user_verticals IS 'Returns array of vertical IDs where user is active chair';

-- ============================================================================
-- FUNCTION: has_active_mou
-- Checks if an industry has an active (signed and not expired) MoU
-- Used for opportunity posting validation (Rule 5)
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.has_active_mou(p_industry_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM stakeholder_mous
    WHERE stakeholder_type = 'industry'
    AND stakeholder_id = p_industry_id
    AND mou_status = 'signed'
    AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.has_active_mou IS 'Checks if industry has active MoU for opportunity posting';

-- ============================================================================
-- FUNCTION: get_coordinator_stakeholder_id
-- Gets the stakeholder_id for a coordinator user (for institution-scoped RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.get_coordinator_stakeholder_id(p_user_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_stakeholder_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get stakeholder_id from stakeholder_coordinators
  SELECT stakeholder_id INTO v_stakeholder_id
  FROM stakeholder_coordinators
  WHERE user_id = v_user_id
  AND status = 'active'
  LIMIT 1;

  RETURN v_stakeholder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.get_coordinator_stakeholder_id IS 'Returns stakeholder_id for coordinator (institution-scoped access)';

-- ============================================================================
-- FUNCTION: is_coordinator_for_stakeholder
-- Checks if user is an active coordinator for a specific stakeholder
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.is_coordinator_for_stakeholder(
  p_stakeholder_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM stakeholder_coordinators
    WHERE user_id = v_user_id
    AND stakeholder_id = p_stakeholder_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.is_coordinator_for_stakeholder IS 'Checks if user is coordinator for specific stakeholder';

-- ============================================================================
-- FUNCTION: has_permission
-- Database-level permission check (called by application layer)
-- Checks role permissions array
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.has_permission(
  p_permission TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if any of user's roles has the permission
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
    AND p_permission = ANY(r.permissions)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.has_permission IS 'Checks if user has specific permission through their roles';

-- ============================================================================
-- FUNCTION: set_updated_at (alias for trigger_set_updated_at)
-- Some migrations use this name - create alias for compatibility
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION yi_connect.set_updated_at IS 'Trigger function to auto-update updated_at timestamp';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION yi_connect.get_user_hierarchy_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.get_user_roles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.is_vertical_chair(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.get_user_verticals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.has_active_mou(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.get_coordinator_stakeholder_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.is_coordinator_for_stakeholder(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.has_permission(TEXT, UUID) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- ── 20251128000002_sub_chapters.sql ─────────────────────────────────
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
CREATE TABLE IF NOT EXISTS yi_connect.sub_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,

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
  created_by UUID REFERENCES yi_connect.members(id),
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
CREATE TABLE IF NOT EXISTS yi_connect.sub_chapter_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_chapter_id UUID NOT NULL REFERENCES yi_connect.sub_chapters(id) ON DELETE CASCADE,

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
CREATE TABLE IF NOT EXISTS yi_connect.sub_chapter_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_chapter_id UUID NOT NULL REFERENCES yi_connect.sub_chapters(id) ON DELETE CASCADE,

  -- Lead can be a Yi member OR a sub-chapter member (student)
  member_id UUID REFERENCES yi_connect.members(id), -- Yi Erode member
  sub_chapter_member_id UUID REFERENCES yi_connect.sub_chapter_members(id), -- Student member

  -- Role
  role TEXT NOT NULL CHECK (role IN ('lead', 'co_lead', 'mentor', 'coordinator')),
  title TEXT, -- e.g., "Chapter President", "Secretary"

  -- Status
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,

  -- Appointment
  appointed_by UUID REFERENCES yi_connect.members(id),
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
CREATE TABLE IF NOT EXISTS yi_connect.sub_chapter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_chapter_id UUID NOT NULL REFERENCES yi_connect.sub_chapters(id) ON DELETE CASCADE,

  -- Can be linked to main event or standalone
  event_id UUID REFERENCES yi_connect.events(id) ON DELETE SET NULL,

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
  created_by UUID REFERENCES yi_connect.sub_chapter_members(id),
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
CREATE OR REPLACE FUNCTION yi_connect.is_sub_chapter_lead(
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

COMMENT ON FUNCTION yi_connect.is_sub_chapter_lead IS 'Checks if user is active lead for a sub-chapter';

-- Grant execute
GRANT EXECUTE ON FUNCTION yi_connect.is_sub_chapter_lead(UUID, UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: get_user_sub_chapters
-- Returns all sub-chapter IDs where user is active lead/mentor
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.get_user_sub_chapters(p_user_id UUID DEFAULT NULL)
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

COMMENT ON FUNCTION yi_connect.get_user_sub_chapters IS 'Returns array of sub-chapter IDs where user is active lead';

-- Grant execute
GRANT EXECUTE ON FUNCTION yi_connect.get_user_sub_chapters(UUID) TO authenticated;

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
FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER set_sub_chapter_members_updated_at
BEFORE UPDATE ON sub_chapter_members
FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER set_sub_chapter_leads_updated_at
BEFORE UPDATE ON sub_chapter_leads
FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER set_sub_chapter_events_updated_at
BEFORE UPDATE ON sub_chapter_events
FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

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
  LEFT JOIN yi_connect.profiles m ON scl.member_id = m.id
  WHERE scl.sub_chapter_id = sc.id
  AND scl.role = 'lead'
  AND scl.is_active = true
  LIMIT 1
) scl_lead ON true;

COMMENT ON VIEW sub_chapter_summary IS 'Summary view for sub-chapter health dashboard with activity scores';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- ── 20251128000004_institution_scoped_rls.sql ─────────────────────────────────
-- ============================================================================
-- Part 3: Institution-Scoped RLS Policies & Skill-Will Assessments
-- Created: 2025-11-28
-- Description: Enhanced RLS policies for privacy (Rule 6), MoU validation (Rule 5),
--              and Skill-Will Assessment system
-- ============================================================================

-- ============================================================================
-- TABLE: skill_will_assessments
-- Stores the 5-question AI-adaptive assessment for members
-- Privacy Rule 6: Members cannot see other members' assessments
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.skill_will_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,

  -- Assessment status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  version INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '90 days'),

  -- Question 1: Energy Focus (Base Question)
  q1_energy_focus TEXT CHECK (q1_energy_focus IN (
    'teaching_mentoring', 'organizing_events', 'corporate_partnerships',
    'fieldwork', 'creative_work'
  )),
  q1_ai_suggestion TEXT,
  q1_ai_reason TEXT,

  -- Question 2: Age Group Preference (Adaptive)
  q2_age_group TEXT CHECK (q2_age_group IN (
    'children_5_12', 'teenagers_15_22', 'adults_25_plus', 'all_ages'
  )),
  q2_ai_suggestion TEXT,
  q2_ai_reason TEXT,
  q2_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- Question 3: Skill Level
  q3_skill_level TEXT CHECK (q3_skill_level IN (
    'none', 'beginner', 'intermediate', 'expert'
  )),
  q3_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- Question 4: Time Commitment
  q4_time_commitment TEXT CHECK (q4_time_commitment IN (
    'under_2_hours', 'hours_5_10', 'hours_10_15', 'hours_15_plus'
  )),
  q4_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- Question 5: Travel Willingness
  q5_travel_willingness TEXT CHECK (q5_travel_willingness IN (
    'city_only', 'district', 'neighboring', 'all_state'
  )),
  q5_adaptive_options JSONB DEFAULT '[]'::jsonb,

  -- AI Analysis
  ai_helper_suggestions JSONB DEFAULT '{}'::jsonb,
  -- Structure: {"q1": {"suggestion": "...", "reason": "...", "confidence": 0.85}, ...}

  ai_scoring_result JSONB,
  ai_classification_confidence DECIMAL(3,2),
  profile_bonus_score DECIMAL(4,2) DEFAULT 0,

  -- Scores (0-1 scale)
  skill_score DECIMAL(4,2) CHECK (skill_score >= 0 AND skill_score <= 1),
  will_score DECIMAL(4,2) CHECK (will_score >= 0 AND will_score <= 1),

  -- Category (calculated from skill/will scores)
  category TEXT CHECK (category IN ('star', 'enthusiast', 'cynic', 'dead_wood')),

  -- Vertical Recommendation
  recommended_vertical_id UUID REFERENCES yi_connect.verticals(id),
  recommended_match_pct INTEGER CHECK (recommended_match_pct >= 0 AND recommended_match_pct <= 100),
  alternative_verticals JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"vertical_name": "...", "match_pct": 75, "reason": "..."}, ...]

  -- Final Assignment (may differ from recommendation)
  assigned_vertical_id UUID REFERENCES yi_connect.verticals(id),
  assigned_by UUID REFERENCES yi_connect.members(id),
  assigned_at TIMESTAMPTZ,
  assignment_notes TEXT,

  -- Mentor Assignment
  mentor_id UUID REFERENCES yi_connect.members(id),
  mentor_assigned_at TIMESTAMPTZ,
  mentor_notes TEXT,

  -- Development Roadmap
  roadmap JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"month": 1, "title": "...", "tasks": [], "completed": false}, ...]

  -- Member Response
  recommendation_accepted BOOLEAN,
  change_requested BOOLEAN DEFAULT false,
  change_request_reason TEXT,
  change_reviewed_by UUID REFERENCES yi_connect.members(id),
  change_reviewed_at TIMESTAMPTZ,
  change_decision TEXT CHECK (change_decision IN ('approved', 'denied')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_skill_will_assessments_member ON skill_will_assessments(member_id)
  WHERE status IN ('pending', 'in_progress'); -- Only one active assessment per member
CREATE INDEX idx_skill_will_assessments_chapter ON skill_will_assessments(chapter_id);
CREATE INDEX idx_skill_will_assessments_status ON skill_will_assessments(status);
CREATE INDEX idx_skill_will_assessments_category ON skill_will_assessments(category)
  WHERE status = 'completed';
CREATE INDEX idx_skill_will_assessments_mentor ON skill_will_assessments(mentor_id)
  WHERE mentor_id IS NOT NULL;

COMMENT ON TABLE skill_will_assessments IS 'AI-adaptive Skill-Will assessment for member vertical matching';
COMMENT ON COLUMN skill_will_assessments.category IS 'star=high skill+high will, enthusiast=low skill+high will, cynic=high skill+low will, dead_wood=low skill+low will';

-- Enable RLS
ALTER TABLE skill_will_assessments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS: skill_will_assessments (Privacy Rule 6)
-- Members can ONLY see their own assessments
-- ============================================================================

-- Members can view ONLY their own assessment
CREATE POLICY "assessments_select_own" ON skill_will_assessments
  FOR SELECT USING (
    member_id = auth.uid()
  );

-- Chair+ and assigned mentors can view assessments
CREATE POLICY "assessments_select_admin" ON skill_will_assessments
  FOR SELECT USING (
    get_user_hierarchy_level() >= 3  -- Co-Chair+
    OR mentor_id = auth.uid()         -- Assigned mentor
  );

-- Members can create/update their own assessment
CREATE POLICY "assessments_insert_own" ON skill_will_assessments
  FOR INSERT WITH CHECK (
    member_id = auth.uid()
    AND user_belongs_to_chapter(chapter_id)
  );

CREATE POLICY "assessments_update_own" ON skill_will_assessments
  FOR UPDATE USING (
    member_id = auth.uid()
    AND status IN ('pending', 'in_progress')
  );

-- Chair+ can update any assessment (for assignment)
CREATE POLICY "assessments_update_admin" ON skill_will_assessments
  FOR UPDATE USING (
    get_user_hierarchy_level() >= 3
  );

-- ============================================================================
-- FUNCTION: Auto-close opportunities when MoU expires (Rule 5)
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_close_expired_mou_opportunities()
RETURNS TRIGGER AS $$
BEGIN
  -- When MoU status changes to expired or expiry_date passes
  IF NEW.mou_status = 'expired' OR (NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE) THEN
    UPDATE industry_opportunities
    SET
      status = 'closed',
      closed_at = now(),
      close_reason = 'MoU expired'
    WHERE
      industry_id = NEW.stakeholder_id
      AND status IN ('draft', 'published', 'accepting_applications')
      AND NEW.stakeholder_type = 'industry';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_auto_close_mou_opportunities ON stakeholder_mous;
CREATE TRIGGER trigger_auto_close_mou_opportunities
  AFTER UPDATE ON stakeholder_mous
  FOR EACH ROW
  WHEN (OLD.mou_status IS DISTINCT FROM NEW.mou_status OR OLD.expiry_date IS DISTINCT FROM NEW.expiry_date)
  EXECUTE FUNCTION auto_close_expired_mou_opportunities();

COMMENT ON FUNCTION auto_close_expired_mou_opportunities IS 'Rule 5: Auto-close opportunities when MoU expires';

-- ============================================================================
-- FUNCTION: Validate MoU before opportunity creation (Rule 5)
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_mou_for_opportunity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate when publishing (status changes to published or accepting_applications)
  IF NEW.status IN ('published', 'accepting_applications') THEN
    IF NOT has_active_mou(NEW.industry_id) THEN
      RAISE EXCEPTION 'Cannot publish opportunity: Industry does not have an active MoU. Please ensure MoU is signed and not expired.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_validate_mou_opportunity ON industry_opportunities;
CREATE TRIGGER trigger_validate_mou_opportunity
  BEFORE INSERT OR UPDATE OF status ON industry_opportunities
  FOR EACH ROW
  WHEN (NEW.status IN ('published', 'accepting_applications'))
  EXECUTE FUNCTION validate_mou_for_opportunity();

COMMENT ON FUNCTION validate_mou_for_opportunity IS 'Rule 5: Validate active MoU before publishing opportunity';

-- ============================================================================
-- Enhanced RLS: opportunity_applications (Privacy Rule 6)
-- Add admin override policies
-- ============================================================================

-- Drop existing admin policy if any and recreate
DROP POLICY IF EXISTS "Admins can view all applications" ON opportunity_applications;

CREATE POLICY "Admins can view all applications" ON opportunity_applications
  FOR SELECT USING (
    get_user_hierarchy_level() >= 4  -- Chair+
    OR is_vertical_chair()           -- Industry Chair
  );

-- ============================================================================
-- Enhanced RLS: industry_opportunities (MoU Check)
-- Add MoU validation in policies
-- ============================================================================

-- Update the insert/update policy to check MoU
DROP POLICY IF EXISTS "Industry coordinators can manage their opportunities" ON industry_opportunities;

CREATE POLICY "Industry coordinators can create opportunities with active MoU" ON industry_opportunities
  FOR INSERT WITH CHECK (
    -- Creator must have active MoU
    (has_active_mou(industry_id) OR status = 'draft')
    AND (
      created_by = auth.uid()
      OR get_user_hierarchy_level() >= 4
    )
  );

CREATE POLICY "Industry coordinators can update their opportunities" ON industry_opportunities
  FOR UPDATE USING (
    created_by = auth.uid()
    OR get_user_hierarchy_level() >= 4
    OR is_vertical_chair()
  )
  WITH CHECK (
    -- MoU check when publishing
    (status NOT IN ('published', 'accepting_applications') OR has_active_mou(industry_id))
  );

CREATE POLICY "Only Chair+ can delete opportunities" ON industry_opportunities
  FOR DELETE USING (
    get_user_hierarchy_level() >= 4
  );

-- ============================================================================
-- VIEW: member_assessment_summary
-- For Chair dashboard - anonymized view of assessment completion
-- ============================================================================
CREATE VIEW member_assessment_summary AS
SELECT
  swa.chapter_id,
  swa.category,
  COUNT(*) AS member_count,
  AVG(swa.skill_score) AS avg_skill_score,
  AVG(swa.will_score) AS avg_will_score
FROM skill_will_assessments swa
WHERE swa.status = 'completed'
GROUP BY swa.chapter_id, swa.category;

COMMENT ON VIEW member_assessment_summary IS 'Anonymized summary of assessment results by category';

-- ============================================================================
-- VIEW: vertical_assessment_recommendations
-- For Chair - shows recommended vertical assignments
-- ============================================================================
CREATE VIEW vertical_assessment_recommendations AS
SELECT
  swa.id AS assessment_id,
  swa.member_id,
  m.full_name AS member_name,
  swa.category,
  swa.skill_score,
  swa.will_score,
  v.name AS recommended_vertical,
  swa.recommended_match_pct,
  swa.alternative_verticals,
  swa.recommendation_accepted,
  swa.change_requested,
  swa.assigned_vertical_id IS NOT NULL AS is_assigned,
  swa.completed_at
FROM skill_will_assessments swa
JOIN yi_connect.profiles m ON swa.member_id = m.id
LEFT JOIN verticals v ON swa.recommended_vertical_id = v.id
WHERE swa.status = 'completed'
ORDER BY swa.completed_at DESC;

COMMENT ON VIEW vertical_assessment_recommendations IS 'Assessment recommendations for Chair review';

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE TRIGGER set_skill_will_assessments_updated_at
BEFORE UPDATE ON skill_will_assessments
FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT ALL ON skill_will_assessments TO authenticated;
GRANT SELECT ON member_assessment_summary TO authenticated;
GRANT SELECT ON vertical_assessment_recommendations TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
