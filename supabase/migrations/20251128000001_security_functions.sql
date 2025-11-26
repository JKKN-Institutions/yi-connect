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
CREATE OR REPLACE FUNCTION public.get_user_hierarchy_level(p_user_id UUID DEFAULT NULL)
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

-- Overload for RLS policies (no parameter = current user)
CREATE OR REPLACE FUNCTION public.get_user_hierarchy_level()
RETURNS INTEGER AS $$
BEGIN
  RETURN public.get_user_hierarchy_level(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_hierarchy_level(UUID) IS 'Returns highest hierarchy level for specified user';
COMMENT ON FUNCTION public.get_user_hierarchy_level() IS 'Returns highest hierarchy level for current authenticated user';

-- ============================================================================
-- FUNCTION: get_user_roles
-- Returns all roles for a user with permissions (for application-level checks)
-- Called by lib/auth.ts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id UUID)
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

COMMENT ON FUNCTION public.get_user_roles IS 'Returns all roles with permissions for a user';

-- ============================================================================
-- FUNCTION: is_vertical_chair
-- Checks if user is chair/co-chair for a specific vertical or any vertical
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_vertical_chair(
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

COMMENT ON FUNCTION public.is_vertical_chair IS 'Checks if user is active chair/co-chair for a vertical';

-- ============================================================================
-- FUNCTION: get_user_verticals
-- Returns all vertical IDs where user is chair/co-chair
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_verticals(p_user_id UUID DEFAULT NULL)
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

COMMENT ON FUNCTION public.get_user_verticals IS 'Returns array of vertical IDs where user is active chair';

-- ============================================================================
-- FUNCTION: has_active_mou
-- Checks if an industry has an active (signed and not expired) MoU
-- Used for opportunity posting validation (Rule 5)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_active_mou(p_industry_id UUID)
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

COMMENT ON FUNCTION public.has_active_mou IS 'Checks if industry has active MoU for opportunity posting';

-- ============================================================================
-- FUNCTION: get_coordinator_stakeholder_id
-- Gets the stakeholder_id for a coordinator user (for institution-scoped RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_coordinator_stakeholder_id(p_user_id UUID DEFAULT NULL)
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

COMMENT ON FUNCTION public.get_coordinator_stakeholder_id IS 'Returns stakeholder_id for coordinator (institution-scoped access)';

-- ============================================================================
-- FUNCTION: is_coordinator_for_stakeholder
-- Checks if user is an active coordinator for a specific stakeholder
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_coordinator_for_stakeholder(
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

COMMENT ON FUNCTION public.is_coordinator_for_stakeholder IS 'Checks if user is coordinator for specific stakeholder';

-- ============================================================================
-- FUNCTION: has_permission
-- Database-level permission check (called by application layer)
-- Checks role permissions array
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_permission(
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

COMMENT ON FUNCTION public.has_permission IS 'Checks if user has specific permission through their roles';

-- ============================================================================
-- FUNCTION: set_updated_at (alias for trigger_set_updated_at)
-- Some migrations use this name - create alias for compatibility
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_updated_at IS 'Trigger function to auto-update updated_at timestamp';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_user_hierarchy_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_hierarchy_level() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vertical_chair(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_verticals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_mou(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coordinator_stakeholder_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coordinator_for_stakeholder(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, UUID) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
