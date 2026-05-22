-- =========================================================================
-- Phase E hotfix 3: user_roles policy no longer reads auth.users directly
-- =========================================================================
-- The previous hotfix (20260522130000) replaced the recursive subquery in
-- yc_user_roles_manage_executives with a JOIN against auth.users to check
-- national_admin membership. But authenticated role lacks SELECT on
-- auth.users (intentional Supabase default), surfacing as PG 42501
-- "permission denied for table users" on any page whose RLS chain
-- transitively walks into this policy (verticals, etc.).
--
-- Fix: use auth.jwt() to read the user's email directly from the JWT
-- claim instead of joining auth.users. auth.jwt() runs in a SECURITY
-- DEFINER context already and works without table grants.
-- =========================================================================

SET search_path TO yi_connect, public, extensions;

DROP POLICY IF EXISTS yc_user_roles_manage_executives ON yi_connect.user_roles;

CREATE POLICY yc_user_roles_manage_executives
ON yi_connect.user_roles
FOR ALL
TO authenticated
USING (
  COALESCE(yi_connect.get_user_hierarchy_level(auth.uid()), 0) >= 5
  OR EXISTS (
    SELECT 1
    FROM yi.national_admins na
    WHERE na.email = (auth.jwt() ->> 'email')
  )
);
