-- Close anon read leaks on scoring tables (Layer-3 QA sweep, 2026-06-03).
--
-- The public anon key (shipped in the browser bundle) could SELECT live
-- per-juror scores (yip.scores), computed results incl. ranks/awards
-- (yip.results), and the position-bonus config (yip.position_bonus_config) via
-- PostgREST. Those tables carried a table-level GRANT SELECT TO anon that
-- overrode RLS — the same pattern flagged in earlier audits.
--
-- The app reads all three SERVER-SIDE via the service-role client (/me, the
-- results dashboard, results computation), so revoking the anon grant closes
-- the leak with no functional impact: the public projector does not query
-- these tables, and the organizer control panel reads as `authenticated`.
-- Writes were already fully blocked for anon (verified — no rigging vector).
--
-- Applied to production directly via the Supabase Management API; captured here
-- for repo parity. Idempotent. Verify with the REAL anon key against PostgREST
-- (not the Management API, which bypasses RLS).

revoke select on yip.scores from anon;
revoke select on yip.results from anon;
revoke select on yip.position_bonus_config from anon;
