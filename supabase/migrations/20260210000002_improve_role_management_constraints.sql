-- ============================================================================
-- Improve Role Management Constraints Migration
-- Created: 2026-02-10
-- Description: Adds database constraints and triggers to improve role management
--              security, data integrity, and race condition prevention
-- ============================================================================

-- ============================================================================
-- 1. ADD UNIQUE CONSTRAINT FOR DUPLICATE PREVENTION
-- Prevents duplicate role assignments and eliminates race conditions
-- ============================================================================
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_unique_user_role'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_unique_user_role
    UNIQUE (user_id, role_id);

    RAISE NOTICE 'Added UNIQUE constraint: user_roles_unique_user_role';
  ELSE
    RAISE NOTICE 'UNIQUE constraint already exists: user_roles_unique_user_role';
  END IF;
END $$;

-- ============================================================================
-- 2. ADD SELF-DEMOTION PREVENTION TRIGGER
-- Prevents users from removing their own Super Admin role
-- Provides database-level protection in addition to application-level checks
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_self_demotion()
RETURNS TRIGGER AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  -- Only check if the user is removing their own role
  IF OLD.user_id = auth.uid() THEN
    -- Get the role name being removed
    SELECT name INTO v_role_name
    FROM roles
    WHERE id = OLD.role_id;

    -- Prevent removing own Super Admin role
    IF v_role_name = 'Super Admin' THEN
      RAISE EXCEPTION 'Cannot remove your own Super Admin role. This is a security protection.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS check_self_demotion ON user_roles;

CREATE TRIGGER check_self_demotion
BEFORE DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION prevent_self_demotion();

COMMENT ON FUNCTION prevent_self_demotion IS 'Prevents users from removing their own Super Admin role at database level';
COMMENT ON TRIGGER check_self_demotion ON user_roles IS 'Enforces self-demotion prevention rule';

-- ============================================================================
-- 3. ENSURE SUPER ADMIN ROLE EXISTS
-- Seeds Super Admin role if it doesn't exist
-- Hierarchy level 7 is reserved for system super administrators
-- ============================================================================
INSERT INTO roles (
  name,
  description,
  hierarchy_level,
  permissions,
  created_at
)
VALUES (
  'Super Admin',
  'System super administrator with unrestricted access to all features and settings',
  7,
  ARRAY[
    'ALL',
    'manage_system',
    'manage_roles',
    'manage_users',
    'manage_chapters',
    'manage_settings',
    'view_audit_logs',
    'manage_integrations'
  ],
  NOW()
)
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  permissions = EXCLUDED.permissions;

-- ============================================================================
-- 4. ADD INDEX FOR PERFORMANCE
-- Improves query performance for role lookups
-- ============================================================================
DO $$
BEGIN
  -- Index on user_roles for faster lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_roles_user_id'
  ) THEN
    CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
    RAISE NOTICE 'Created index: idx_user_roles_user_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_roles_role_id'
  ) THEN
    CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
    RAISE NOTICE 'Created index: idx_user_roles_role_id';
  END IF;
END $$;

-- ============================================================================
-- 5. GRANT NECESSARY PERMISSIONS
-- Ensure functions can be executed by authenticated users
-- ============================================================================
GRANT EXECUTE ON FUNCTION prevent_self_demotion() TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration was successful:
--
-- 1. Check UNIQUE constraint:
--    SELECT conname, contype FROM pg_constraint WHERE conname = 'user_roles_unique_user_role';
--
-- 2. Check trigger:
--    SELECT tgname FROM pg_trigger WHERE tgname = 'check_self_demotion';
--
-- 3. Check Super Admin role:
--    SELECT * FROM roles WHERE name = 'Super Admin';
--
-- 4. Test duplicate prevention:
--    -- Should fail with unique violation error
--    INSERT INTO user_roles (user_id, role_id) VALUES ('same-id', 'same-role');
--    INSERT INTO user_roles (user_id, role_id) VALUES ('same-id', 'same-role');
--
-- 5. Test self-demotion prevention (as Super Admin):
--    -- Should fail with trigger error
--    DELETE FROM user_roles
--    WHERE user_id = auth.uid()
--    AND role_id = (SELECT id FROM roles WHERE name = 'Super Admin');
-- ============================================================================

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
