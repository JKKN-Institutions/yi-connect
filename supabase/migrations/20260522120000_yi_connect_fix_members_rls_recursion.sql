-- =========================================================================
-- Phase E hotfix: fix yi_connect.members RLS infinite recursion
-- =========================================================================
-- The 3 existing policies on yi_connect.members all self-query the
-- same table to look up the requesting user's chapter:
--
--   chapter_id IN (SELECT m.chapter_id FROM yi_connect.members m
--                  WHERE m.id = auth.uid())
--
-- That subquery triggers the same RLS policy → infinite recursion →
-- Postgres error 42P17 on EVERY query against members.
--
-- Effect was hidden until today because the previous code path bypassed
-- RLS by other means; once Phase D/E ports lit up code paths that did
-- hit the user-session client, every dashboard + connections query
-- threw.
--
-- Fix: replace self-referential subqueries with a lookup against
-- yi_connect.profiles (which has chapter_id and a non-recursive RLS).
-- =========================================================================

SET search_path TO yi_connect, public, extensions;

-- ---- SELECT policy ----
DROP POLICY IF EXISTS "Members can view members in their chapter" ON yi_connect.members;
CREATE POLICY "Members can view members in their chapter"
ON yi_connect.members
FOR SELECT
TO authenticated
USING (
  chapter_id IN (
    SELECT p.chapter_id
    FROM yi_connect.profiles p
    WHERE p.id = auth.uid()
  )
);

-- ---- DELETE policy ----
DROP POLICY IF EXISTS "Admins can delete members in their chapter" ON yi_connect.members;
CREATE POLICY "Admins can delete members in their chapter"
ON yi_connect.members
FOR DELETE
TO authenticated
USING (
  chapter_id IN (
    SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3
  )
);

-- ---- UPDATE policy (the one named "update and delete" — UPDATE only here) ----
DROP POLICY IF EXISTS "Admins can update and delete members in their chapter" ON yi_connect.members;
CREATE POLICY "Admins can update members in their chapter"
ON yi_connect.members
FOR UPDATE
TO authenticated
USING (
  chapter_id IN (
    SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3
  )
);
