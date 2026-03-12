-- =====================================================
-- FIX: User Roles RLS Policy for INSERT operations
-- =====================================================
-- Issue: The FOR ALL policy only had USING clause but no WITH CHECK
-- This caused INSERT operations to fail because PostgreSQL RLS
-- requires WITH CHECK for INSERT operations
--
-- Solution: Replace single FOR ALL policy with separate policies
-- for each operation type following Supabase best practices:
-- - SELECT: USING only
-- - INSERT: WITH CHECK only
-- - UPDATE: Both USING and WITH CHECK
-- - DELETE: USING only
-- =====================================================

-- Drop the broken ALL policy
DROP POLICY IF EXISTS "User roles are manageable by Executive Members and above" ON public.user_roles;

-- INSERT: Requires WITH CHECK (no USING)
CREATE POLICY "User roles insertable by Executive Members and above"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.get_user_hierarchy_level(auth.uid())) >= 5);

-- UPDATE: Requires both USING and WITH CHECK
CREATE POLICY "User roles updatable by Executive Members and above"
ON public.user_roles
FOR UPDATE
TO authenticated
USING ((SELECT public.get_user_hierarchy_level(auth.uid())) >= 5)
WITH CHECK ((SELECT public.get_user_hierarchy_level(auth.uid())) >= 5);

-- DELETE: Requires USING only (no WITH CHECK)
CREATE POLICY "User roles deletable by Executive Members and above"
ON public.user_roles
FOR DELETE
TO authenticated
USING ((SELECT public.get_user_hierarchy_level(auth.uid())) >= 5);
