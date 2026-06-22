-- ═══════════════════════════════════════════════════════════════════════
-- Committee evaluation → MULTI-JUDGE (2026-06-23 Director interview).
--
-- Committees were scored ONCE per committee (one row per event+committee).
-- New model: judges log in and score; several judges each score a committee
-- /60 and the results engine AVERAGES them — exactly like individual student
-- scoring. So committee_scores becomes one row per (event, committee, judge).
--
-- Decisions locked in the interview:
--  • Judges log in and score; organisers may also enter on a judge's behalf.
--  • Several judges per committee, averaged (average whoever submitted).
--  • Each judge is assigned to ALL or SELECT committees (new
--    jury_committee_assignments, mirroring jury_session_assignments).
--  • Existing committee scores CLEARED and re-scored fresh (0 rows in prod
--    at migration time — no data lost).
--  • Add a Committee Chair/Lead per committee (new committee_meta).
--
-- Already APPLIED to prod (project bkmpbcoxbjyafieabxao) via the Management API
-- on 2026-06-23; this file records it. New yip.* tables get anon/authenticated
-- REVOKED on creation (the recurring Layer-3 grant leak) — app uses the
-- service-role client gated by getYipEventAccess.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Committee scores become per-judge. Clear old single-row data first.
DELETE FROM yip.committee_scores;
ALTER TABLE yip.committee_scores
  ADD COLUMN IF NOT EXISTS jury_assignment_id uuid
    REFERENCES yip.jury_assignments(id) ON DELETE CASCADE;
ALTER TABLE yip.committee_scores
  DROP CONSTRAINT IF EXISTS committee_scores_event_id_committee_name_key;
ALTER TABLE yip.committee_scores ALTER COLUMN jury_assignment_id SET NOT NULL;
ALTER TABLE yip.committee_scores
  ADD CONSTRAINT committee_scores_event_committee_juror_key
  UNIQUE (event_id, committee_name, jury_assignment_id);

-- 2. Which judge scores which committee (all or select).
CREATE TABLE IF NOT EXISTS yip.jury_committee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  jury_assignment_id uuid NOT NULL REFERENCES yip.jury_assignments(id) ON DELETE CASCADE,
  committee_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, jury_assignment_id, committee_name)
);
ALTER TABLE yip.jury_committee_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yip.jury_committee_assignments FROM anon, authenticated;
GRANT ALL ON yip.jury_committee_assignments TO service_role;

-- 3. Committee Chair/Lead — one per committee, informational.
CREATE TABLE IF NOT EXISTS yip.committee_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  committee_name text NOT NULL,
  chair_lead text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, committee_name)
);
ALTER TABLE yip.committee_meta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yip.committee_meta FROM anon, authenticated;
GRANT ALL ON yip.committee_meta TO service_role;

NOTIFY pgrst, 'reload schema';
