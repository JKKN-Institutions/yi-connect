-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: case-insensitive organiser email matching
--
-- Bug: yifi_check_organiser lowercased only the INPUT email
-- (lower(trim(p_email))) but compared it to the raw stored column
-- (r.email = v_normalized). Any organiser whose email was stored with an
-- uppercase letter — e.g. 'Vikranth@avenuesads.com' (host_chair) — silently
-- failed the match and was DENIED admin access for every login.
--
-- Two-part fix:
--   1. Normalise existing stored emails to lower(trim()).
--   2. Patch the function to compare lower(trim(r.email)) so future rows
--      with mixed-case emails can never reintroduce the bug.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Normalise existing data (only touches rows that need it).
UPDATE yifi.organiser_roles
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- 2. Root-cause fix: case-insensitive comparison on the stored column.
CREATE OR REPLACE FUNCTION public.yifi_check_organiser(p_email text, p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_normalized text := lower(trim(p_email));
  v_super_admin boolean;
  v_result json;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM yi_directory.role_assignments ra
    JOIN yi_directory.people p ON p.id = ra.person_id
    WHERE lower(trim(p.email)) = v_normalized
      AND ra.role = 'super_admin'
      AND ra.is_active = true
  ) INTO v_super_admin;

  SELECT json_agg(json_build_object(
    'role', r.role,
    'permissions', r.permissions,
    'chapter_id', r.chapter_id
  )) INTO v_result
  FROM yifi.organiser_roles r
  WHERE lower(trim(r.email)) = v_normalized
    AND r.edition_id = p_edition_id
    AND r.is_active = true;

  IF v_super_admin THEN
    RETURN COALESCE(v_result, '[]'::json)::jsonb || '[{"role":"super_admin","permissions":["*"],"chapter_id":null}]'::jsonb;
  END IF;

  RETURN v_result;
END;
$function$;
