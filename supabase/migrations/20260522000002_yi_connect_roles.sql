-- ═══════════════════════════════════════════════════════════════════════
-- Migration: yi_connect.roles (Phase A Step 2 — first table lift)
--
-- Lifts public.roles (yi-connect's RBAC roles table) into yi_connect.*
-- with one architectural improvement: the admin RLS policy now uses
-- the shared yi.national_admins allow-list (from YiFuture migration
-- 131) instead of self-referencing yi_connect.user_roles. This avoids
-- the chicken-and-egg bootstrap problem and aligns with the unified
-- identity layer.
--
-- This is the FIRST table lifted from yi-connect into the shared DB.
-- It has zero FK dependencies. Subsequent tables depend on it.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yi_connect.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  hierarchy_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE yi_connect.roles IS
  'RBAC roles for yi-connect (Chapter Member, Executive, Chapter Chair, '
  'National Admin, etc.). hierarchy_level drives permission gating: '
  '1=Member, 5=Executive, 6=National Admin.';

-- Enable RLS
ALTER TABLE yi_connect.roles ENABLE ROW LEVEL SECURITY;

-- Read policy: any authenticated user can read role definitions
CREATE POLICY "roles_read_authenticated"
  ON yi_connect.roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Write policy: only emails in yi.national_admins can manage roles.
-- This replaces the self-referencing policy in the original yi-connect
-- schema with the shared cross-app identity layer.
CREATE POLICY "roles_manage_national_admins"
  ON yi_connect.roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- service_role bypasses RLS automatically (Supabase default), so no
-- explicit policy needed for it.

NOTIFY pgrst, 'reload schema';
