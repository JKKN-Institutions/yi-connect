-- Siloed-visibility primitive — Decision 3 (2026-05-31 interview).
--
-- A reusable RLS helper: does the CURRENT auth user hold a role whose scope
-- covers (p_app, p_chapter, p_zone)? This is the SQL embodiment of can()'s
-- READ-scope logic, for use in RLS policies on relationship tables so each app's
-- data is SILOED by default — a YIP admin cannot see another app's (or a minor's
-- Thalir) data merely because the underlying yi_directory identity is shared.
--
-- Usage in a policy on a relationship table that carries its owning scope:
--   CREATE POLICY siloed_read ON some.table FOR SELECT TO authenticated
--     USING ( yi_directory.current_user_can_see('yip', owning_chapter, owning_zone) );
--
-- Additive + idempotent. This migration only creates the primitive; attaching it
-- to a specific table (and adding that table's owning chapter/zone columns) is a
-- per-table follow-up — see docs/siloed-visibility-note.md.

CREATE OR REPLACE FUNCTION yi_directory.current_user_can_see(
  p_app text,
  p_chapter text DEFAULT NULL,
  p_zone text DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = yi_directory, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM yi_directory.people pe
    JOIN yi_directory.role_assignments ra ON ra.person_id = pe.id
    WHERE pe.user_id = auth.uid()
      AND ra.is_active
      AND (
        ra.role = 'super_admin'                                     -- cross-app root
        OR (
          ra.app = p_app AND (
            ra.role IN ('national', 'platform_admin')               -- per-app global
            OR (p_chapter IS NOT NULL AND ra.yi_chapter = p_chapter) -- chapter scope
            OR (p_zone   IS NOT NULL AND ra.yi_zone    = p_zone)     -- zone scope
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION yi_directory.current_user_can_see(text, text, text) IS
  'Decision-3 siloed-visibility primitive: true if the current auth user holds an active role whose scope covers (app, chapter, zone). Use in RLS policies on relationship tables. Mirrors can() read-scope; super_admin is cross-app root.';
