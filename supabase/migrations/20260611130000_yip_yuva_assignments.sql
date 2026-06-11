-- YIP YUVA → party / committee assignments (Change Request §5)
-- Admin sees which YUVA volunteer handles each party / committee. This is the
-- data foundation the student dashboard's "your YUVA contact" later builds on.
--
-- Model (kept deliberately simple, decided 2026-06-11):
--   * yip.volunteers already holds YUVA rows (is_yuva = true) but had NO link
--     to a party or committee — only their event + logistics info.
--   * There is no committees table; a committee is just its name (text),
--     sourced from event.committee_topics / participants.committee_name /
--     the default COMMITTEES constant.
--   * Each assignment row links ONE volunteer to EITHER one party (party_id)
--     OR one committee (committee_name). A volunteer may have several rows
--     (e.g. handle party A and committees X and Y), but never the same party
--     or the same committee twice in one event.
--
-- Additive only — no ALTER/DROP of existing columns or tables.
-- Applied to prod (bkmpbcoxbjyafieabxao) 2026-06-11 via Management API;
-- this file is the record.

CREATE TABLE IF NOT EXISTS yip.yuva_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  volunteer_id   uuid NOT NULL REFERENCES yip.volunteers(id) ON DELETE CASCADE,
  party_id       uuid REFERENCES yip.parties(id) ON DELETE CASCADE,
  committee_name text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- Exactly one of party_id / committee_name is set per row.
  CONSTRAINT yuva_assignment_target_one CHECK (
    (party_id IS NOT NULL AND committee_name IS NULL)
    OR
    (party_id IS NULL AND committee_name IS NOT NULL)
  )
);

-- No volunteer assigned to the same party twice in one event.
CREATE UNIQUE INDEX IF NOT EXISTS yuva_assignments_event_vol_party_key
  ON yip.yuva_assignments (event_id, volunteer_id, party_id)
  WHERE party_id IS NOT NULL;

-- No volunteer assigned to the same committee twice in one event.
CREATE UNIQUE INDEX IF NOT EXISTS yuva_assignments_event_vol_committee_key
  ON yip.yuva_assignments (event_id, volunteer_id, committee_name)
  WHERE committee_name IS NOT NULL;

-- Lookups: "who handles this party / committee" and "what does this YUVA cover".
CREATE INDEX IF NOT EXISTS yuva_assignments_event_idx
  ON yip.yuva_assignments (event_id);
CREATE INDEX IF NOT EXISTS yuva_assignments_volunteer_idx
  ON yip.yuva_assignments (volunteer_id);

-- Grants: same posture as other recent yip.* tables (yip.volunteers,
-- yip.vote_audit). This table joins to volunteer name/phone (credentials live
-- on the volunteer row), so it stays service-role only — every read/write goes
-- through the event-gated server actions in app/yip/actions/yuva-assignments.ts.
ALTER TABLE yip.yuva_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yip.yuva_assignments FROM anon, authenticated;
