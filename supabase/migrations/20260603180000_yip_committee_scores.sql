-- ═══════════════════════════════════════════════════════════════════════
-- Committee-once scoring table (Yi 2026 Workbook "Committee Evaluation" /60).
-- Phase 3 of the 2026-06-03 Director scoring-model decisions.
--
-- A committee is scored ONCE on 6 dimensions × 10 = /60 (Bill Draft Quality,
-- Policy Relevance, Innovation, Feasibility, Team Collaboration, Presentation &
-- Defence). The results engine derives the two committee-level points from this
-- (5 drafting dims → Committee Discussions committee-level /5; Presentation &
-- Defence → Bill Presentation committee-level /5) and applies them to EVERY
-- member of the committee — replacing each member's per-individual
-- committee_level criterion. When no row exists for a committee (legacy events
-- e.g. Mizoram), the engine leaves the juror's own committee_level untouched,
-- so existing results are unaffected (no method gate needed).
--
-- Already APPLIED to prod (project bkmpbcoxbjyafieabxao) via the Management API
-- on 2026-06-03; this file records it. anon access REVOKED on creation (new
-- yip.* tables otherwise inherit an anon grant — the recurring Layer-3 leak).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yip.committee_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  committee_name text NOT NULL,
  bill_draft_quality smallint NOT NULL DEFAULT 0 CHECK (bill_draft_quality BETWEEN 0 AND 10),
  policy_relevance smallint NOT NULL DEFAULT 0 CHECK (policy_relevance BETWEEN 0 AND 10),
  innovation smallint NOT NULL DEFAULT 0 CHECK (innovation BETWEEN 0 AND 10),
  feasibility smallint NOT NULL DEFAULT 0 CHECK (feasibility BETWEEN 0 AND 10),
  team_collaboration smallint NOT NULL DEFAULT 0 CHECK (team_collaboration BETWEEN 0 AND 10),
  presentation_defence smallint NOT NULL DEFAULT 0 CHECK (presentation_defence BETWEEN 0 AND 10),
  judge_notes text,
  scored_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, committee_name)
);

ALTER TABLE yip.committee_scores ENABLE ROW LEVEL SECURITY;

-- Close the anon REST surface (app reads/writes via the service-role client in
-- app/yip/actions/committee-scores.ts, gated by getYipEventAccess).
REVOKE ALL ON yip.committee_scores FROM anon;

NOTIFY pgrst, 'reload schema';
