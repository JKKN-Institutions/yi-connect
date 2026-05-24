-- =========================================================================
-- Close member/profile anon-read leak via SECURITY DEFINER RPC
-- Followup to PR #221 (20260524230000_fix_anon_read_leaks.sql)
-- =========================================================================
--
-- 🚨 HUMAN REVIEW OF SECURITY DEFINER FUNCTION REQUIRED. Do NOT auto-merge.
--    Owner-bypassing-RLS semantics: the function below runs as its OWNER
--    (postgres) and therefore SEES every row in profiles + members. The
--    WHERE clause on rsvp_token IS the access control. If a future edit
--    relaxes that WHERE clause, the entire leak re-opens.
--
-- =========================================================================
-- Background
-- =========================================================================
--
-- PR #221 replaced two USING-true anon policies on yi_connect.profiles and
-- yi_connect.members with chapter-scoped variants:
--
--   anon_view_profiles_for_rsvp_scoped (anon, SELECT)
--   anon_view_members_for_rsvp_scoped  (anon, SELECT)
--
-- Both predicates scope to "active chapters with any rsvp_token event".
-- Production audit shows 57 of ~70 chapters match — only ~13 chapters
-- (~19%) are actually excluded. Not meaningfully narrower than the
-- original USING-true.
--
-- =========================================================================
-- Fix
-- =========================================================================
--
-- (1) Drop both anon SELECT policies entirely. Anon loses ALL direct read
--     access to yi_connect.profiles and yi_connect.members.
--
-- (2) Expose a single SECURITY DEFINER function that returns only the
--     5 columns the public RSVP page needs (id, full_name, avatar_url,
--     company, designation), gated by a specific rsvp_token. Callers
--     must already possess the token; the function's WHERE clause acts
--     as the access control.
--
-- (3) Grant EXECUTE on the function to anon + authenticated.
--
-- The join between members and profiles uses `m.id = p.id` because
-- members.id IS the FK to profiles.id (see migration
-- 20260522000004_yi_connect_members_hub.sql line 65:
-- `id UUID PRIMARY KEY REFERENCES yi_connect.profiles(id) ON DELETE CASCADE`).
--
-- =========================================================================

BEGIN;

SET search_path TO yi_connect, public, extensions;

-- =========================================================================
-- (1) Drop the over-broad scoped policies from PR #221
-- =========================================================================

DROP POLICY IF EXISTS anon_view_profiles_for_rsvp_scoped ON yi_connect.profiles;
DROP POLICY IF EXISTS anon_view_members_for_rsvp_scoped ON yi_connect.members;

-- =========================================================================
-- (2) SECURITY DEFINER RPC — token-gated member list for the RSVP page
-- =========================================================================
--
-- The function bypasses RLS (runs as owner) but its WHERE clause limits
-- rows to (a) events with the supplied rsvp_token AND (b) status in
-- published/ongoing/completed. Anon callers can only invoke this if they
-- already possess a valid rsvp_token — the same access control that
-- protects the existing anon_view_events_by_token policy.
--
-- Returned columns are the minimum needed by app/(public)/rsvp/[token]/page.tsx
-- to render the attending / not-yet member lists. Phone, email, chapter_id,
-- and other PII are intentionally NOT returned.

CREATE OR REPLACE FUNCTION yi_connect.get_rsvp_event_members(p_rsvp_token text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  company text,
  designation text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = yi_connect, public
STABLE
AS $$
  SELECT
    m.id,
    p.full_name,
    p.avatar_url,
    m.company,
    m.designation
  FROM yi_connect.events e
  JOIN yi_connect.members m
    ON m.chapter_id = e.chapter_id
   AND m.is_active = true
  JOIN yi_connect.profiles p
    ON p.id = m.id
  WHERE e.rsvp_token = p_rsvp_token
    AND e.status IN ('published', 'ongoing', 'completed')
  ORDER BY m.created_at ASC
$$;

COMMENT ON FUNCTION yi_connect.get_rsvp_event_members(text) IS
  'Token-gated member list for the public RSVP page. SECURITY DEFINER '
  '— runs as owner, bypasses RLS on profiles and members. Access control '
  'is the WHERE clause: caller must supply a valid rsvp_token matching '
  'an active event. Returns only id, full_name, avatar_url, company, '
  'designation. Created 2026-05-24 as followup to PR #221 to close the '
  'over-broad anon_view_*_for_rsvp_scoped policies (57/70 chapters '
  'matched, ~19% reduction was not meaningful). Replaces direct anon '
  'SELECT on profiles + members entirely.';

REVOKE ALL ON FUNCTION yi_connect.get_rsvp_event_members(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION yi_connect.get_rsvp_event_members(text) TO anon, authenticated, service_role;

-- =========================================================================
-- Reload PostgREST schema cache so the new function is callable via RPC.
-- =========================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
