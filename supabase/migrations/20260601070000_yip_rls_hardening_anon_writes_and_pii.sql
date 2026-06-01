-- YIP security remediation — Layer-3 (RLS / table grants) sweep, 2026-06-01.
--
-- Applied to PROD via the Supabase Management API on 2026-06-01 and verified
-- (see verification block at the bottom). This file captures that state so it
-- is reproducible and survives `db reset` / future migrations — i.e. so the
-- prod grant state is NOT undocumented drift.
--
-- Threat model: "anon" is the Supabase anon key that ships in the browser to
-- every unauthenticated visitor of the public projector display and the
-- access-code (student) pages. "authenticated" is any logged-in Supabase user
-- (any Yi member, not necessarily a YIP organiser).
--
-- Findings closed here:
--   1. anon/authenticated could INSERT/UPDATE/DELETE the live-event tables
--      (yip.scores, results, motions, votes, ...) — i.e. rig a live session
--      directly against PostgREST, bypassing the gated server actions.
--   2. anon could SELECT yip.participants.access_code — the 6-char login code,
--      which would let anyone log in as any student — plus phone/email/
--      parent_phone (minor PII).
--   3. yip.admin_audit_log was readable by anon + authenticated.
--
-- Why this is safe for the app: all WRITES go through "use server" server
-- actions that use createServiceClient() (service_role), which is unaffected by
-- these revokes. anon only needs SELECT for (a) the public projector display
-- [selects id, full_name, school_name] and (b) the student "already voted?" /
-- bill checks [select id / parliament_role, party_side] — all non-sensitive
-- columns. Vote casting is service_role (app/yip/actions/voting.ts).

-- ── 1. Revoke anon + authenticated WRITE on live-event tables ────────────────
--    (writes are performed by service_role server actions only)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  yip.scores,
  yip.results,
  yip.motions,
  yip.votes,
  yip.participants,
  yip.parties,
  yip.jury_assignments,
  yip.agenda
  FROM anon, authenticated;

-- ── 2. Restrict anon SELECT on participants to non-sensitive columns ─────────
--    A table-level SELECT grant overrides a column-level REVOKE in Postgres,
--    so we drop the table-wide grant and grant back only the safe columns.
--    Excluded (anon can no longer read): access_code, phone, email, parent_phone.
REVOKE SELECT ON yip.participants FROM anon;
GRANT SELECT (
  id, event_id, full_name, school_name, class, section, city, home_state,
  party_side, parliament_role, ministry, constituency_name, constituency_state,
  committee_name, checked_in, checked_in_at, qualified_for_next,
  created_at, updated_at, school_id, party_id, party_number, committee_number,
  serial_no, person_id, is_mock, yi_institution_id
) ON yip.participants TO anon;

-- ── 3. Lock down the admin audit log (service_role only) ─────────────────────
ALTER TABLE yip.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON yip.admin_audit_log FROM anon, authenticated;

-- ── Verification performed 2026-06-01 (anon key) ─────────────────────────────
--   anon INSERT/DELETE scores ............... 42501 permission denied   ✅
--   anon read participants.access_code ...... 42501 permission denied   ✅
--   anon read participants.phone/email ...... 42501 permission denied   ✅
--   anon read admin_audit_log ............... 42501 permission denied   ✅
--   anon read id,full_name,school_name ...... rows returned (display)   ✅
--   anon read parliament_role,party_side .... rows returned (bill)      ✅
--   anon SELECT votes (already-voted check) . 200                       ✅
--   anon INSERT votes ....................... 42501 permission denied   ✅
--   service_role full access (incl PII) ..... rows returned (app OK)    ✅
--
-- Follow-up (Tier-2, lower severity — NOT in this migration):
--   * Row-scope the USING(true) SELECT policies so authenticated users only
--     read their own chapter's rows (currently any logged-in user can read all
--     participants' safe columns + cast-time data across all events).
--   * Review authenticated column-PII on participants (organiser roster reads
--     should stay on service_role server actions).
--   * Review topics / event_topics / registrations authenticated-write grants.
