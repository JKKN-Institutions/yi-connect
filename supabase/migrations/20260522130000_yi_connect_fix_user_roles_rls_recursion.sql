-- =========================================================================
-- Phase E hotfix 2: fix yi_connect.user_roles RLS infinite recursion
-- =========================================================================
-- The yc_user_roles_manage_executives policy (polcmd = '*') self-queries
-- yi_connect.user_roles inside its USING clause. Even though a permissive
-- SELECT-only policy with `USING (true)` also applies, Postgres may
-- evaluate the `*` policy on SELECT in some plans, triggering recursion.
--
-- Symptom: PG 42P17 surfaces on every page that runs a query whose RLS
-- chain transitively touches user_roles via subquery (knowledge_documents,
-- knowledge_categories, wiki_pages, best_practices, events, etc.).
--
-- Fix: replace the recursive subquery with the existing SECURITY DEFINER
-- helper `yi_connect.get_user_hierarchy_level(auth.uid())`, which runs
-- with definer privileges and DOES NOT re-enter RLS.
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
    JOIN auth.users u ON u.email::text = na.email
    WHERE u.id = auth.uid()
  )
);
