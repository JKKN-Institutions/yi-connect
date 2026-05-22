-- ═══════════════════════════════════════════════════════════════════════
-- Migration: yi_connect.chapters compatibility VIEW
--
-- yi-connect's original public.chapters table had columns:
--   id, name, location, region, established_date, member_count
--
-- The shared yi.chapters (authored by YiFuture) uses:
--   id, name, city, state, region, ... (no `location`)
--
-- This view wraps yi.chapters and exposes the legacy column shape that
-- yi-connect's app code expects, with `location` computed as
-- `city, state`. App code can now use `.from('chapters')` (which
-- resolves to yi_connect.chapters via default schema) without any
-- cross-schema `.schema('yi')` qualification.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yi_connect.chapters AS
SELECT
  id,
  name,
  -- Legacy yi-connect compatibility: location = "City, State"
  CASE
    WHEN city IS NOT NULL AND state IS NOT NULL THEN city || ', ' || state
    WHEN city IS NOT NULL THEN city
    WHEN state IS NOT NULL THEN state
    ELSE NULL
  END AS location,
  city,
  state,
  region,
  logo_url,
  is_active,
  chair_name,
  chair_email,
  chair_mobile,
  yi_chapter_id,
  programme_duration_days,
  finale_region,
  is_finale_host,
  created_at,
  -- Compatibility: yi-connect used member_count and updated_at; not on
  -- yi.chapters, so we surface NULL/now() for read-time compatibility.
  -- Writes should go through yi.chapters directly via .schema('yi').
  NULL::INTEGER AS member_count,
  NULL::DATE AS established_date,
  created_at AS updated_at
FROM yi.chapters;

COMMENT ON VIEW yi_connect.chapters IS
  'Read-only compatibility wrapper around yi.chapters that exposes the '
  'column shape yi-connect''s app code expects (adds computed `location`, '
  'maps city/state). Writes still need .schema(''yi'').from(''chapters'') '
  'directly. Authored 2026-05-22 during Phase B code rewire.';

-- Grant read access matching yi.chapters policies
GRANT SELECT ON yi_connect.chapters TO authenticated, anon, service_role;
