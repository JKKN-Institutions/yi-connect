-- ============================================================================
-- Add can_manage_role Function Migration
-- Created: 2026-02-10
-- Description: Adds the can_manage_role RPC function for role hierarchy validation
-- ============================================================================

-- ============================================================================
-- FUNCTION: can_manage_role
-- Checks if a manager (user) has sufficient permissions to manage a target role
-- Based on hierarchy levels: Manager must have HIGHER level than target role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_manage_role(
  manager_id UUID,
  target_role_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_manager_level INTEGER;
  v_target_role_level INTEGER;
BEGIN
  -- Validate inputs
  IF manager_id IS NULL OR target_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get manager's highest hierarchy level
  v_manager_level := public.get_user_hierarchy_level(manager_id);

  -- Get target role's hierarchy level
  SELECT hierarchy_level INTO v_target_role_level
  FROM roles
  WHERE id = target_role_id;

  -- If role not found, deny permission
  IF v_target_role_level IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Manager must have a HIGHER hierarchy level than the target role
  -- This prevents users from assigning roles equal to or higher than their own
  -- Examples:
  --   - Super Admin (level 7) can manage all roles (1-6)
  --   - National Admin (level 6) can manage levels 1-5
  --   - Executive (level 5) can manage levels 1-4
  --   - Regular members (levels 1-4) cannot manage any roles
  RETURN v_manager_level > v_target_role_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.can_manage_role IS 'Checks if manager can assign/remove a target role based on hierarchy levels';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.can_manage_role(UUID, UUID) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
