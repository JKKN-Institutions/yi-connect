-- YIP Committee Report step (director correction + interview, 2026-06-23).
--
-- A committee is a group of students assigned ONE topic. Before drafting its
-- Bill, the committee writes a Committee Report (background, current challenges,
-- findings, recommendations, proposed solutions) — mirroring a real
-- Parliamentary Committee Report. The Bill stays LOCKED until the Report is
-- submitted (gate enforced in app/yip/actions/bills.ts).
--
-- One report per committee per event (UNIQUE(event_id, committee_name)), keyed
-- by committee_name (= the ministry/committee join key, same as bills /
-- bill_documents / committee_scores). Participants are MINORS → fail-closed:
--   * RLS enabled with NO policies + zero anon/authenticated grants
--   * the gated server actions in app/yip/actions/committee-reports.ts
--     (service role bypasses RLS) are the ONLY access path — same posture as
--     20260612230000_yip_bill_documents.sql.
--
-- APPLIED to live 2026-06-23 via the Management API; committed for the record.

CREATE TABLE IF NOT EXISTS yip.committee_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  committee_name     text NOT NULL,
  background         text,
  current_challenges text,
  findings           text,
  recommendations    text,
  proposed_solutions text,
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted')),
  is_mock            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, committee_name)
);

-- Student report screen + the bill-lock gate both read per (event, committee).
CREATE INDEX IF NOT EXISTS idx_committee_reports_event_committee
  ON yip.committee_reports (event_id, committee_name);

-- ─── Lockdown: service-role only ────────────────────────────────
ALTER TABLE yip.committee_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON yip.committee_reports FROM anon, authenticated;

-- No RLS policies are created → with RLS enabled and no policy, anon and
-- authenticated can do nothing even if a stray table grant ever appears.
