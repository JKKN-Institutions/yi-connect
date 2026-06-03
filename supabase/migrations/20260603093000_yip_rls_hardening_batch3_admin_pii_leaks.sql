-- ═══════════════════════════════════════════════════════════════════════
-- Close 16 LIVE anon data-exposure holes in the `yip.*` schema.
-- THREE-LAYER-SWEEP-2026-06-03 (super-admin admin-area QA)
--
-- Already APPLIED to prod (project bkmpbcoxbjyafieabxao) on 2026-06-03 via
-- the Supabase Management API query endpoint, then VERIFIED closed with the
-- real anon key over PostgREST (each table → HTTP 401 "permission denied").
-- This file captures that change for the repo's schema history. (The earlier
-- batches 20260601070000 / 073000 / 090000 used the same REVOKE-from-anon
-- pattern; supabase db push --linked has been rejecting on this project, so
-- DDL is applied via the Management API and recorded here.)
--
-- ───────────────────────────────────────────────────────────────────────
-- WHAT WAS OPEN
-- ───────────────────────────────────────────────────────────────────────
-- A three-layer sweep (UI + API + Layer-3 RLS) as the super-admin found that
-- the prior anon-leak remediation (PR #262 / #300, which closed scores,
-- results, participants, admin_audit_log, scoring_settings, session_parameters,
-- position_bonus_config) did NOT cover a further set of yip.* tables. With the
-- real public anon key over PostgREST (Accept-Profile: yip) an UNAUTHENTICATED
-- caller could SELECT — and on several, INSERT/UPDATE/DELETE — these tables:
--
--   organizers            anon: SELECT + INSERT/UPDATE/DELETE   (organizer PII)
--   jury_assignments      anon: SELECT                          (reveals juror identities)
--   score_audit           anon: SELECT                          (score-change integrity trail)
--   registrations         anon: SELECT + INSERT/UPDATE/DELETE   (student PII when populated)
--   fees                  anon: SELECT + INSERT/UPDATE/DELETE   (payment data when populated)
--   feedback              anon: SELECT + INSERT/UPDATE/DELETE   (feedback when populated)
--   brand_checks          anon: SELECT + INSERT/UPDATE/DELETE   (branding compliance)
--   rubrics               anon: SELECT + INSERT/UPDATE/DELETE   (scoring rubrics)
--   checklist_template    anon: SELECT + INSERT/UPDATE/DELETE   (org checklist template)
--   scoring_flags_config  anon: SELECT (RLS was also DISABLED)  (scoring config)
--   volunteers            anon: SELECT + INSERT/UPDATE/DELETE   (volunteer PII)
--   invitations           anon: SELECT + INSERT/UPDATE/DELETE   (invitation emails / PII)
--   checklist             anon: SELECT + INSERT/UPDATE/DELETE   (per-event org checklist)
--   promotions            anon: SELECT + INSERT/UPDATE/DELETE   (who advanced)
--   contestants           anon: SELECT + INSERT/UPDATE/DELETE   (student/contestant data)
--   participations        anon: SELECT + INSERT/UPDATE/DELETE   (student×event records)
--
-- Same bug class as the prior yip / yi-future batches: a leftover table-level
-- GRANT to anon overrides RLS intent, so anon reaches the REST surface.
--
-- ───────────────────────────────────────────────────────────────────────
-- SAFETY FINDING (read-only investigation, 2026-06-03)
-- ───────────────────────────────────────────────────────────────────────
-- Every read/write of these 16 tables in the entire YIP app runs via
-- createServiceClient() (service-role, bypasses RLS) inside "use server"
-- actions under app/yip/actions/* and lib/yip/* — NOT via the browser/anon
-- client. Confirmed by grepping every `.from("<table>")` reference: all land
-- in server actions (volunteers.ts, branding.ts, checklist.ts, pipeline.ts,
-- people.ts, participations.ts, scoring*.ts, admin-*.ts, post-session-report.ts,
-- mock-data.ts, etc.). The only browser/anon-client surfaces in YIP are the
-- live projector (app/yip/event/[id]/display/projector-display.tsx), the
-- participant vote/bill pages (app/yip/me/*), the jury scoring client, and the
-- realtime hooks (use-realtime-event / use-vote-session / use-live-banner) —
-- and they read ONLY the realtime-published tables (see PRESERVED below), with
-- all initial page data server-rendered via service-role. None of the 16
-- tables above is in the realtime publication, so revoking anon does not
-- affect live sync. service_role bypasses RLS and keeps its grant, so app
-- behaviour is unchanged.
--
-- PRESERVED ON PURPOSE — anon read is REQUIRED for the live event:
--   The supabase_realtime publication for schema yip contains exactly:
--     agenda, agenda_speakers, bills, events, questions, vote_sessions, votes
--   These MUST keep anon read or the projector / student / jury live sync
--   breaks. They are deliberately NOT revoked here.
--   Also left readable (low-sensitivity public parliament / reference content,
--   may be read on projector load): parties, motions, media, topics,
--   event_topics, constituencies. Revisit in a post-event hardening pass once
--   each projector read path is confirmed server-rendered.
--
-- NOTE ON `authenticated`: this migration revokes anon ONLY. The public
-- (unauthenticated) exposure is the real leak and is what is closed here.
-- `authenticated` (a logged-in Supabase organizer) retains its grant under the
-- platform's "yip.* read-only for authenticated" model; tightening that to
-- service-role-only is a separate, lower-risk follow-up.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

REVOKE ALL ON yip.organizers           FROM anon;
REVOKE ALL ON yip.jury_assignments     FROM anon;
REVOKE ALL ON yip.score_audit          FROM anon;
REVOKE ALL ON yip.registrations        FROM anon;
REVOKE ALL ON yip.fees                 FROM anon;
REVOKE ALL ON yip.feedback             FROM anon;
REVOKE ALL ON yip.brand_checks         FROM anon;
REVOKE ALL ON yip.rubrics              FROM anon;
REVOKE ALL ON yip.checklist_template   FROM anon;
REVOKE ALL ON yip.scoring_flags_config FROM anon;
REVOKE ALL ON yip.volunteers           FROM anon;
REVOKE ALL ON yip.invitations          FROM anon;
REVOKE ALL ON yip.checklist            FROM anon;
REVOKE ALL ON yip.promotions           FROM anon;
REVOKE ALL ON yip.contestants          FROM anon;
REVOKE ALL ON yip.participations       FROM anon;

-- scoring_flags_config additionally had RLS disabled — enable it so that even
-- if a future grant re-appears, there is no permissive policy letting anon in.
ALTER TABLE yip.scoring_flags_config ENABLE ROW LEVEL SECURITY;

-- Force PostgREST to reload its schema cache so the revoked grants take effect
-- on the REST surface immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;
