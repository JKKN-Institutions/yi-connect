-- ═══════════════════════════════════════════════════════════════════════
-- BUG-SWEEP-2026-05-24: Drop chair_email/chair_mobile from yi_connect.chapters
--
-- BACKGROUND
-- ──────────
-- The yi_connect.chapters compatibility VIEW (PR #221, migration
-- 20260522000023) currently exposes chair_email + chair_mobile from
-- yi.chapters. The underlying yi.chapters table has a permissive policy
-- `pub_read_chapters` USING (is_active = true) granted to the public role,
-- which includes anon. Even with security_invoker = on (set in migration
-- 20260524230000), anon callers can still read chair_email + chair_mobile
-- for every active chapter because the underlying policy permits it.
--
-- Verified production leak (2026-05-24) via:
--   curl ".../rest/v1/chapters?select=name,chair_email,chair_mobile&limit=2"
--        -H "apikey:<ANON>" -H "Accept-Profile:yi_connect"
--   → [{name, chair_email: "real@email", chair_mobile: "9876..."}, ...]
--
-- FIX
-- ───
-- Recreate the view WITHOUT chair_email and chair_mobile columns. All
-- legitimate consumers of these fields already read from yi.chapters
-- directly via `.schema('yi').from('chapters')` with service-role clients
-- (verified in app/yi-future/api/csv/[scope]/route.tsx,
-- app/yi-future/national/admin/page.tsx, app/actions/chapters.ts). The
-- public/admission/registration flows that hit the view do not need
-- chair contact info.
--
-- The view keeps security_invoker = on so future column additions remain
-- caller-role-RLS-aware.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW yi_connect.chapters
WITH (security_invoker = on)
AS
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
  -- chair_email DROPPED 2026-05-24 (BUG-SWEEP) — read from yi.chapters
  -- directly in service-role admin contexts.
  -- chair_mobile DROPPED 2026-05-24 (BUG-SWEEP) — read from yi.chapters
  -- directly in service-role admin contexts.
  yi_chapter_id,
  programme_duration_days,
  finale_region,
  is_finale_host,
  created_at,
  -- Compatibility: yi-connect used member_count and updated_at; not on
  -- yi.chapters, so we surface NULL/created_at for read-time compatibility.
  -- Writes should go through yi.chapters directly via .schema('yi').
  NULL::INTEGER AS member_count,
  NULL::DATE AS established_date,
  created_at AS updated_at
FROM yi.chapters;

COMMENT ON VIEW yi_connect.chapters IS
  'BUG-SWEEP-2026-05-24: chair_email/chair_mobile dropped; read from '
  'yi.chapters directly in authenticated admin contexts. View keeps '
  'security_invoker = on so caller-role RLS on yi.chapters is enforced. '
  'Read-only compatibility wrapper that exposes the legacy yi-connect '
  'column shape (computed `location`, maps city/state). Writes still '
  'need .schema(''yi'').from(''chapters'') directly.';

-- Re-grant read access matching the prior contract (anon kept because
-- the leak being closed is at the column level, not the row level —
-- anon still legitimately reads name/region/logo for active chapters
-- on public chapter-listing pages).
GRANT SELECT ON yi_connect.chapters TO authenticated, anon, service_role;

-- Tell PostgREST to reload the schema cache so the dropped columns
-- disappear from the REST surface immediately.
NOTIFY pgrst, 'reload schema';
