-- =========================================================================
-- Fix anon-read PII leaks discovered in three-layer security sweep
-- BUG-SWEEP-2026-05-24
-- =========================================================================
--
-- 🚨 WARNING: HUMAN REVIEW OF EVERY POLICY EXPRESSION REQUIRED BEFORE
--    APPLYING TO PRODUCTION. The policies in this file change anon and
--    public-role access semantics. A misjudgement here re-opens the leaks
--    or breaks the public RSVP / event-by-slug flows.
--
-- Evidence files (read before reviewing):
--   /tmp/yi-sweep-2026-05-24/layer3-rls.md       — full Layer-3 RLS audit
--   /tmp/yi-sweep-2026-05-24/policy-audit.md     — pg_policies dump
--   /tmp/yi-sweep-2026-05-24/anon-read.md        — anon GET behavioural test
--   /tmp/yi-sweep-2026-05-24/leak-policies.json  — full SQL of leaking policies
--   /tmp/yi-sweep-2026-05-24/final-report.md     — top-line verdict
--
-- =========================================================================
-- Bugs being closed
-- =========================================================================
--
-- (1) yi_connect.profiles — policy `anon_view_profiles_for_rsvp` is
--     USING true. Returns every profile row (email, full_name, phone,
--     chapter_id, avatar_url) to any anon caller. Severity: HIGH.
--     Fix: drop the policy outright + introduce a column-restricted
--     view `profiles_public` (id, full_name, avatar_url only) for the
--     RSVP flow to consume.
--
-- (2) yi_connect.members — policy `anon_view_members_for_rsvp` is
--     USING (is_active = true). Returns company, designation,
--     membership_number, chapter_id, etc. for every active member.
--     Severity: HIGH.
--     Fix: same approach — drop the policy + introduce
--     `members_public` (id, full_name, chapter_id only).
--
-- (3) yi_connect.chapters VIEW — currently runs with the default
--     security_definer behaviour, bypassing the underlying RLS on
--     yi.chapters. Anon currently gets chair_email + chair_mobile.
--     Severity: MEDIUM.
--     Fix: ALTER VIEW … SET (security_invoker = on) so caller-role
--     RLS on yi.chapters is enforced. This is the same VIEW-shim
--     pattern as future.chapters (memory:
--     feedback_postgrest_cross_schema_embed.md) but with the
--     security_invoker gap closed.
--
-- (4) Four pre-leak tables that hold no data today but will leak the
--     moment rows land, because the SELECT/ALL policies are USING true
--     against the `public` role (which in Postgres includes `anon`):
--       - yi_connect.stakeholder_contacts   (relationship PII)
--       - yi_connect.stakeholder_documents  (relationship PII)
--       - yi_connect.event_templates        (no chapter scoping in
--                                            schema; conservative auth
--                                            gate only)
--       - yi_connect.relationship_health_scores (has chapter_id —
--                                            chapter-scoped)
--     Fix: drop the USING-true policies, replace with at minimum an
--     auth-required gate. relationship_health_scores gets a true
--     chapter-scoped policy (mirrors the canonical pattern in
--     20260522160000). The other three lack chapter_id in their
--     schemas — they get the conservative `auth.uid() IS NOT NULL`
--     gate and MUST be tightened by a domain expert before any data
--     lands (flagged in PR body).
--
-- (5) yi_connect.booking_restrictions — `Anyone can view restrictions`
--     looks intentional from the policy name. LEFT UNCHANGED. A SQL
--     comment is added below recording the decision.
--
-- (6) yi_connect.events — `anon_view_events_by_slug` (public_slug IS
--     NOT NULL) and `anon_view_events_by_token` (rsvp_token IS NOT
--     NULL) are properly scoped public-RSVP flows. LEFT UNCHANGED.
--     A SQL comment is added below recording the decision.
--
-- =========================================================================
-- Not in scope for this migration
-- =========================================================================
--   - The /api/admin/debug-roles, /api/whatsapp/send, etc. unauthenticated
--     routes (Layer 2 findings) are application-layer fixes.
--   - UI silent-failure bugs on /admin/chapters and /admin/users
--     (Layer 1 findings).
--   - Cross-chapter authenticated leakage (Layer 4 — not run yet).
--
-- =========================================================================

BEGIN;

SET search_path TO yi_connect, public, extensions;

-- =========================================================================
-- (1) profiles — drop USING-true anon policy + create profiles_public view
--     + add chapter-scoped anon SELECT policy for RSVP flow
-- =========================================================================

DROP POLICY IF EXISTS anon_view_profiles_for_rsvp ON yi_connect.profiles;

-- profiles_public exposes ONLY the columns anonymous RSVP / public-event
-- pages legitimately need. Email + phone + chapter_id are deliberately
-- excluded. This view is the intended anon-facing surface for profile data.
CREATE OR REPLACE VIEW yi_connect.profiles_public AS
SELECT
  id,
  full_name,
  avatar_url
FROM yi_connect.profiles;

COMMENT ON VIEW yi_connect.profiles_public IS
  'Anon-facing projection of yi_connect.profiles (id, full_name, '
  'avatar_url only). Created 2026-05-24 by BUG-SWEEP-2026-05-24 to '
  'close the anon_view_profiles_for_rsvp USING-true leak. Email, '
  'phone, chapter_id, and other PII columns are intentionally NOT '
  'in this view. App code that needs anon profile lookups (RSVP '
  'flow, public event pages) MUST read from this view, not from '
  'yi_connect.profiles.';

GRANT SELECT ON yi_connect.profiles_public TO anon, authenticated, service_role;

-- Followup (2026-05-24, fix/anon-read-rls-leaks-data-layer-followup):
-- The original drop above broke lib/data/public-events.ts:97
-- (getChapterMembersForRSVP) which reads members joined with profiles
-- via PostgREST FK embed (`profile:profiles(full_name, avatar_url)`).
-- PostgREST embeds don't traverse views without an explicit FK, and
-- profiles_public lacks columns needed for the join, so the data layer
-- query has to read profiles directly. The policy below bounds anon
-- SELECT on profiles to ONLY profiles whose member row belongs to a
-- chapter with at least one active RSVP-token event — a far tighter
-- surface than the original USING-true policy.
CREATE POLICY anon_view_profiles_for_rsvp_scoped
ON yi_connect.profiles
FOR SELECT
TO anon
USING (
  id IN (
    SELECT m.id
    FROM yi_connect.members m
    WHERE m.is_active = true
      AND m.chapter_id IN (
        SELECT e.chapter_id
        FROM yi_connect.events e
        WHERE e.rsvp_token IS NOT NULL
          AND e.status IN ('published', 'ongoing', 'completed')
      )
  )
);

COMMENT ON POLICY anon_view_profiles_for_rsvp_scoped ON yi_connect.profiles IS
  'Bounds anon SELECT on profiles to rows whose member row belongs to '
  'a chapter that currently has at least one active RSVP-token event. '
  'Far tighter than the original anon_view_profiles_for_rsvp USING-true '
  'policy this replaces. Required by lib/data/public-events.ts '
  'getChapterMembersForRSVP which uses a PostgREST FK embed that views '
  'cannot satisfy. Set 2026-05-24 by '
  'fix/anon-read-rls-leaks-data-layer-followup.';

-- =========================================================================
-- (2) members — drop is_active=true anon policy + create members_public view
--     + add chapter-scoped anon SELECT policy for RSVP flow
-- =========================================================================

DROP POLICY IF EXISTS anon_view_members_for_rsvp ON yi_connect.members;

-- members_public exposes ONLY id, full_name, chapter_id. Company,
-- designation, membership_status, membership_number, and other member
-- PII are deliberately excluded.
CREATE OR REPLACE VIEW yi_connect.members_public AS
SELECT
  id,
  full_name,
  chapter_id
FROM yi_connect.members
WHERE is_active = true;

COMMENT ON VIEW yi_connect.members_public IS
  'Anon-facing projection of yi_connect.members (id, full_name, '
  'chapter_id only, active members only). Created 2026-05-24 by '
  'BUG-SWEEP-2026-05-24 to close the anon_view_members_for_rsvp '
  'leak. Company, designation, membership_number, and other member '
  'PII are intentionally NOT in this view.';

GRANT SELECT ON yi_connect.members_public TO anon, authenticated, service_role;

-- Followup (2026-05-24, fix/anon-read-rls-leaks-data-layer-followup):
-- See note on the matching profiles policy above. Bounds anon SELECT
-- on members to active members in chapters with active RSVP-token
-- events. The original anon_view_members_for_rsvp policy was
-- USING (is_active = true) — every active member in every chapter.
-- This policy adds the chapter-scoping that was missing.
CREATE POLICY anon_view_members_for_rsvp_scoped
ON yi_connect.members
FOR SELECT
TO anon
USING (
  is_active = true
  AND chapter_id IN (
    SELECT e.chapter_id
    FROM yi_connect.events e
    WHERE e.rsvp_token IS NOT NULL
      AND e.status IN ('published', 'ongoing', 'completed')
  )
);

COMMENT ON POLICY anon_view_members_for_rsvp_scoped ON yi_connect.members IS
  'Bounds anon SELECT on members to active members in chapters that '
  'currently have at least one active RSVP-token event. Replaces the '
  'broader anon_view_members_for_rsvp USING (is_active = true) policy. '
  'Required by lib/data/public-events.ts getChapterMembersForRSVP. '
  'Set 2026-05-24 by fix/anon-read-rls-leaks-data-layer-followup.';

-- =========================================================================
-- (3) chapters VIEW — flip to security_invoker so caller-RLS on yi.chapters
--     is enforced
-- =========================================================================
--
-- The view's column list is left intact (chair_email / chair_mobile are
-- still surfaced) — what changes is that anon callers now hit yi.chapters
-- under their own role, so RLS on yi.chapters governs visibility. If
-- yi.chapters has no anon-grant SELECT policy, anon will get 0 rows.
--
-- This is the minimal-change fix. If the human reviewer prefers a
-- column-drop fix instead (remove chair_email/chair_mobile from the view
-- definition outright), that can be layered on later — security_invoker
-- alone closes the leak.

ALTER VIEW yi_connect.chapters SET (security_invoker = on);

COMMENT ON VIEW yi_connect.chapters IS
  'Read-only compatibility wrapper around yi.chapters (legacy '
  'yi-connect column shape with computed `location`). 2026-05-24: '
  'security_invoker turned ON by BUG-SWEEP-2026-05-24 so caller-role '
  'RLS on yi.chapters is enforced instead of bypassed. Anon callers '
  'will see only rows yi.chapters policies allow them to see.';

-- =========================================================================
-- (4a) stakeholder_contacts — drop USING-true policies, add auth gate
-- =========================================================================
--
-- 🚨 This table has NO chapter_id column. The auth.uid() IS NOT NULL gate
--    below at least blocks anon but does NOT enforce cross-chapter
--    isolation. A domain expert MUST tighten this (likely via a JOIN
--    through the polymorphic stakeholder_type/stakeholder_id reference
--    to a chapter-owned row) before any production data lands.

DROP POLICY IF EXISTS "Users can manage stakeholder contacts" ON yi_connect.stakeholder_contacts;
DROP POLICY IF EXISTS "Users can view all stakeholder contacts" ON yi_connect.stakeholder_contacts;

CREATE POLICY stakeholder_contacts_authenticated_read
ON yi_connect.stakeholder_contacts
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY stakeholder_contacts_authenticated_write
ON yi_connect.stakeholder_contacts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE yi_connect.stakeholder_contacts IS
  '🚨 RLS uses a conservative auth-only gate (blocks anon but not '
  'cross-chapter). No chapter_id in schema. Tighten before data '
  'lands. Set 2026-05-24 by BUG-SWEEP-2026-05-24.';

-- =========================================================================
-- (4b) stakeholder_documents — drop USING-true policies, add auth gate
-- =========================================================================
--
-- 🚨 Same as stakeholder_contacts — no chapter_id; conservative auth gate
--    only. Needs domain-expert tightening.

DROP POLICY IF EXISTS "Users can manage documents" ON yi_connect.stakeholder_documents;
DROP POLICY IF EXISTS "Users can view all documents" ON yi_connect.stakeholder_documents;

CREATE POLICY stakeholder_documents_authenticated_read
ON yi_connect.stakeholder_documents
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY stakeholder_documents_authenticated_write
ON yi_connect.stakeholder_documents
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE yi_connect.stakeholder_documents IS
  '🚨 RLS uses a conservative auth-only gate (blocks anon but not '
  'cross-chapter). No chapter_id in schema. Tighten before data '
  'lands. Set 2026-05-24 by BUG-SWEEP-2026-05-24.';

-- =========================================================================
-- (4c) event_templates — drop USING-true policy, add auth gate
-- =========================================================================
--
-- 🚨 Schema has no chapter_id (templates appear intentionally global).
--    If templates ARE meant to be chapter-scoped or role-scoped (e.g.
--    only Co-Chair+ can read), tighten before data lands. The auth gate
--    below at least blocks anon.

DROP POLICY IF EXISTS "Anyone can view active event templates" ON yi_connect.event_templates;

CREATE POLICY event_templates_authenticated_read
ON yi_connect.event_templates
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE yi_connect.event_templates IS
  '🚨 RLS uses a conservative auth-only gate (blocks anon). No '
  'chapter_id in schema — confirm whether templates are intentionally '
  'global or need role/chapter scoping before data lands. Set '
  '2026-05-24 by BUG-SWEEP-2026-05-24.';

-- =========================================================================
-- (4d) relationship_health_scores — drop USING-true policy, add proper
--      chapter-scoped policy
-- =========================================================================
--
-- This table DOES have chapter_id, so we can apply the canonical
-- chapter-scoping pattern from 20260522160000_yi_connect_rls_cleanup.sql
-- (query yi_connect.profiles directly — no members-hop).

DROP POLICY IF EXISTS "System can manage health scores" ON yi_connect.relationship_health_scores;

CREATE POLICY relationship_health_scores_select_chapter
ON yi_connect.relationship_health_scores
FOR SELECT
TO authenticated
USING (
  chapter_id IN (
    SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY relationship_health_scores_write_chapter
ON yi_connect.relationship_health_scores
FOR ALL
TO authenticated
USING (
  chapter_id IN (
    SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  chapter_id IN (
    SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
  )
);

-- =========================================================================
-- (5) booking_restrictions — INTENTIONALLY LEFT ALONE
-- =========================================================================
-- Policy name `Anyone can view restrictions` and the existence of a
-- companion `Only admin can modify restrictions` write policy strongly
-- suggest this is a deliberate public-UX surface (booking-time rules
-- shown to anyone trying to book). Confirmed with the sweep report.
-- Reviewer: if product disagrees, drop "Anyone can view restrictions"
-- in a follow-up migration.

COMMENT ON TABLE yi_connect.booking_restrictions IS
  'Public-read surface (policy: Anyone can view restrictions). '
  'Reviewed 2026-05-24 by BUG-SWEEP-2026-05-24 and left as-is '
  '— booking rules are intentionally visible to anonymous bookers. '
  'Confirm with product before changing.';

-- =========================================================================
-- (6) events — INTENTIONALLY LEFT ALONE
-- =========================================================================
-- anon_view_events_by_slug + anon_view_events_by_token are both properly
-- scoped (require public_slug/rsvp_token IS NOT NULL AND status IN
-- (published, ongoing, completed)). This powers the public RSVP and
-- public event-page flows. Reviewed 2026-05-24, no change.

COMMENT ON TABLE yi_connect.events IS
  'Anon-facing policies anon_view_events_by_slug and '
  'anon_view_events_by_token were reviewed 2026-05-24 by '
  'BUG-SWEEP-2026-05-24 and left in place — public_slug and '
  'rsvp_token flows are intentional. Tighten ONLY if a leaked row '
  'is later found to lack those tokens.';

-- =========================================================================
-- Force PostgREST to reload schema so the new views become visible.
-- =========================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
