-- ═══════════════════════════════════════════════════════════════════════
-- YIP — scope participant/volunteer access_code (+ minor PII) reads away from
-- the broad `authenticated` role.  PREPARE ONLY — DO NOT APPLY until reviewed.
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠️  DO NOT APPLY THIS MIGRATION AS PART OF A ROUTINE `db push`.
--     `supabase db push --linked` has been rejecting on this project, and the
--     prior YIP RLS batches (20260601070000 / 073000 / 090000 / 20260603093000)
--     were all applied to PROD via the Supabase Management API query endpoint
--     and then recorded here as schema history.  Apply THIS file the same way —
--     by a human, via the Management API, AFTER sign-off — not automatically.
--
-- ───────────────────────────────────────────────────────────────────────
-- THE EXPOSURE BEING CLOSED
-- ───────────────────────────────────────────────────────────────────────
-- This is the Tier-2 follow-up explicitly deferred at the bottom of
-- 20260601070000_yip_rls_hardening_anon_writes_and_pii.sql ("Row-scope the
-- USING(true) SELECT policies ... currently any logged-in user can read all
-- participants' ... data across all events") and again in
-- 20260603093000_..._batch3 ("`authenticated` retains its grant ... tightening
-- that to service-role-only is a separate, lower-risk follow-up").
--
-- The anon (public, browser) key is ALREADY fully blocked from these columns
-- (batch1 column-scoped anon's grant; batch3 revoked anon on volunteers). This
-- migration closes the remaining hole: the `authenticated` role.
--
-- "authenticated" = ANY logged-in Supabase user (any Yi member with an org
-- login), not necessarily an organiser of the event in question. Today, both
-- of these tables have:
--     • RLS ENABLED, but the only SELECT policy is `USING (true)` (role public)
--       → every authenticated user passes the row filter for EVERY event; and
--     • a TABLE-LEVEL `GRANT SELECT ... TO authenticated` covering ALL columns,
--       INCLUDING the login credential `access_code` and minor PII.
--
-- Net effect of the two together: a logged-in organiser for chapter X can,
-- straight off the PostgREST REST surface (Accept-Profile: yip), do
--     GET /participants?select=full_name,access_code&event_id=eq.<chapter-Y-event>
-- and read chapter Y's students' / volunteers' 6-char LOGIN CODES — letting them
-- log in as any student/volunteer of an event they do not manage — plus email /
-- phone / parent_phone (minor PII).  RLS does not stop it because the policy is
-- `USING (true)`; the only thing standing between the column and the caller is
-- the column-level GRANT, so the GRANT is what we tighten here.
--
-- WHY A COLUMN-LEVEL REVOKE (not a row-scoped RLS policy):
--   RLS `USING` clauses are ROW-level — they cannot hide a single column while
--   still returning the row's safe columns (full_name, school_name, …) that the
--   projector / rosters legitimately read. To "show the row but hide the code"
--   you tighten the COLUMN grant, exactly as batch1 already did for `anon`.
--   Replicating the real ownership rule (getYipEventAccess: yi_directory role
--   assignments + yi.chapters.chair_email fallback + zone regional-admin +
--   super-admin, with email normalisation) inside a SQL policy would fork a
--   large, security-critical auth function into Postgres and risk drift — the
--   precise "a clumsy change breaks legitimate reads" failure we must avoid.
--   So we route ALL sensitive-column reads through `service_role`, which already
--   bypasses RLS/grants AND is already wrapped by getYipEventAccess() ownership
--   checks in the server actions. "Scoped to events you manage" is thereby
--   enforced by the existing, single-source-of-truth app gate.
--
-- WHY THIS IS SAFE FOR THE APP (verified against origin/master, 2026-06-09):
--   • The ONLY query that reads `WHERE access_code = …` (the access-code login,
--     app/yip/actions/auth.ts validateAccessCode) uses createServiceClient()
--     (service_role) → bypasses this revoke → login is UNAFFECTED.
--   • Volunteers roster read (app/yip/actions/volunteers.ts listVolunteers) is
--     already createServiceClient() AND already gated by getYipEventAccess
--     (.canManage) → UNAFFECTED, and was never event-scoped at the DB layer
--     before, so this revoke removes the raw-REST bypass with zero app cost.
--   • Participants control-panel read (getParticipantsByRole, positions.ts) uses
--     the authenticated client but selects only id, full_name, party_side,
--     parliament_role — NO sensitive columns → UNAFFECTED.
--   • The projector / student / jury live surfaces never read these columns.
--   • The ONE authenticated-role path that DID read access_code — the
--     participants dashboard page (app/yip/dashboard/events/[id]/participants/
--     page.tsx, a Server Component doing `createClient().from("participants")
--     .select("*")`) — is migrated in the SAME PR to a gated service-role action
--     (getEventParticipants), mirroring listVolunteers. That code change MUST
--     ship together with this migration. With it, no authenticated-role read of
--     access_code remains, so this revoke breaks no real read path.
--
-- REVERSIBILITY: the exact rollback is at the bottom of this file (commented).
-- It restores the prior table-wide `GRANT SELECT ... TO authenticated`.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── yip.participants ─────────────────────────────────────────────────────────
-- A table-level SELECT grant overrides any column-level REVOKE, so we must drop
-- the table-wide grant first, then grant back ONLY the safe (non-credential,
-- non-PII) columns. This mirrors batch1's treatment of `anon` exactly; the safe
-- column list below is the SAME list batch1 granted back to anon, so authenticated
-- ends up with the same column visibility as anon for this table.
REVOKE SELECT ON yip.participants FROM authenticated;
GRANT SELECT (
  id, event_id, full_name, school_name, class, section, city, home_state,
  party_side, parliament_role, ministry, constituency_name, constituency_state,
  committee_name, checked_in, checked_in_at, qualified_for_next,
  created_at, updated_at, school_id, party_id, party_number, committee_number,
  serial_no, person_id, is_mock, yi_institution_id
) ON yip.participants TO authenticated;
-- Withheld from authenticated (now service_role-only): access_code, email,
-- phone, parent_phone.

-- ── yip.volunteers ───────────────────────────────────────────────────────────
-- Same pattern. Safe columns = everything EXCEPT access_code, email, phone.
-- (volunteers has no parent_phone.)
REVOKE SELECT ON yip.volunteers FROM authenticated;
GRANT SELECT (
  id, event_id, full_name, station, shift, tshirt_size, is_yuva,
  arrived, arrived_at, notes, is_mock, created_at, updated_at
) ON yip.volunteers TO authenticated;
-- Withheld from authenticated (now service_role-only): access_code, email, phone.

-- NOTE (out of scope for THIS migration — flagged for a follow-up review):
--   yip.volunteers ALSO grants INSERT/UPDATE/DELETE to `authenticated`, and its
--   "Volunteers manageable by organizer" policy is `USING (auth.uid() IS NOT
--   NULL)` — i.e. ANY logged-in user can write volunteer rows for ANY event
--   directly via REST, bypassing the getYipEventAccess gate in the server
--   actions. That is a separate (write-side) finding; this PR is intentionally
--   limited to the access_code READ exposure. Do NOT widen this migration to
--   cover it without its own review.

-- Force PostgREST to reload its schema cache so the revoked grants take effect
-- on the REST surface immediately (same as batch3).
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- POST-APPLY VERIFICATION (run with the REAL anon AND a real authenticated
-- session token over PostgREST, Accept-Profile: yip — NOT the Management API,
-- which runs as a superuser and gives a false GREEN):
--   authenticated GET participants?select=access_code .. 401/permission denied ✅
--   authenticated GET participants?select=email,phone ... 401/permission denied ✅
--   authenticated GET participants?select=full_name ..... rows (roster safe)    ✅
--   authenticated GET volunteers?select=access_code ..... 401/permission denied ✅
--   service_role  GET participants?select=access_code ... rows (app login OK)   ✅
--   App smoke: access-code login (student + volunteer) ... succeeds             ✅
--   App smoke: participants dashboard page renders codes . succeeds (via svc)   ✅
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (if this needs to be reverted — run as a human via Management API):
--
--   BEGIN;
--   REVOKE SELECT ON yip.participants FROM authenticated;
--   GRANT  SELECT ON yip.participants TO   authenticated;   -- restores ALL columns
--   REVOKE SELECT ON yip.volunteers   FROM authenticated;
--   GRANT  SELECT ON yip.volunteers   TO   authenticated;   -- restores ALL columns
--   NOTIFY pgrst, 'reload schema';
--   COMMIT;
--
-- (And revert the participants/page.tsx + getEventParticipants change in the
--  accompanying PR, so the page goes back to reading access_code itself.)
-- ═══════════════════════════════════════════════════════════════════════
