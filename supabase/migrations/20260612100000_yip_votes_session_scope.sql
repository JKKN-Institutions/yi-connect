-- YIP voting: scope votes to their vote_session.
--
-- WHY (live repro 2026-06-12): yip.votes had UNIQUE (agenda_item_id,
-- participant_id) and every cast/tally path filtered by agenda_item_id only,
-- while vote sessions (yip.vote_sessions) bind to the CURRENT agenda item.
-- Two elections on one agenda item therefore collide:
--
--   1. RUNOFF LOCKOUT: after a tie, openRunoff opens a fresh session on the
--      SAME agenda item. Every student who voted in round 1 hits the unique
--      constraint in the runoff -> "already_voted". The deciding electorate
--      degenerates to round-1 abstainers — the opposite of the Director
--      ruling (instant 60-second runoff among only the tied candidates).
--   2. TALLY CONTAMINATION: the runoff tally filtered by agenda_item_id +
--      vote_type, so round-1 ballots for the tied candidates were counted
--      again in the runoff result.
--
-- FIX: votes carry session_id; uniqueness and tallies become per-session.
-- NOTE: this migration is written but NOT yet applied. Apply it BEFORE
-- deploying the matching code change (the code filters on session_id).

-- 1. New column. ON DELETE SET NULL: deleting a session must never delete
--    ballots — they degrade to legacy (NULL-session) rows.
ALTER TABLE yip.votes
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES yip.vote_sessions(id) ON DELETE SET NULL;

-- 2. Backfill, best-effort: stamp each existing vote with the one session it
--    can only have belonged to — same agenda item + vote type, cast inside the
--    session's open window (5-minute grace after close for in-flight writes).
--    If MORE than one session could match a vote (e.g. an agenda item that
--    already hosted two same-type sessions), the vote stays NULL — correctness
--    over completeness. Readers keep a legacy NULL-session fallback for those.
UPDATE yip.votes v
SET session_id = m.only_session_id
FROM (
  SELECT
    v2.id AS vote_id,
    (array_agg(s.id))[1] AS only_session_id
  FROM yip.votes v2
  JOIN yip.vote_sessions s
    ON  s.agenda_item_id = v2.agenda_item_id
    AND s.vote_type      = v2.vote_type
    AND v2.cast_at IS NOT NULL
    AND v2.cast_at >= s.opened_at
    AND (s.closed_at IS NULL OR v2.cast_at <= s.closed_at + interval '5 minutes')
  WHERE v2.session_id IS NULL
  GROUP BY v2.id
  HAVING count(*) = 1
) m
WHERE v.id = m.vote_id
  AND v.session_id IS NULL;

-- 3. Replace per-agenda-item uniqueness with per-session uniqueness.
--    Partial index: legacy rows (NULL session_id) are exempt, and
--    participant_id is left out of the NOT NULL net in case manual floor
--    entries ever carry a NULL participant.
ALTER TABLE yip.votes
  DROP CONSTRAINT IF EXISTS votes_agenda_item_id_participant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS votes_session_participant_key
  ON yip.votes (session_id, participant_id)
  WHERE session_id IS NOT NULL AND participant_id IS NOT NULL;

-- 4. Session-scope the secret-ballot read policy. The old policy keyed on
--    agenda_item_id, so the moment ANY session on an agenda item was revealed
--    (round 1), the LIVE ballots of a still-open runoff on the same agenda
--    item became readable (voter + value, mid-vote) — recreating the leak the
--    policy was built to close (20260607043000). A ballot is now readable only
--    when ITS OWN session is revealed; legacy NULL-session rows keep the old
--    agenda-item reading so historical revealed results stay visible.
DROP POLICY IF EXISTS "Votes readable only when revealed" ON yip.votes;
CREATE POLICY "Votes readable only when revealed" ON yip.votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM yip.vote_sessions vs
      WHERE vs.status = 'revealed'
        AND (
          (votes.session_id IS NOT NULL AND vs.id = votes.session_id)
          OR
          (votes.session_id IS NULL AND vs.agenda_item_id = votes.agenda_item_id)
        )
    )
  );

COMMENT ON COLUMN yip.votes.session_id IS
  'The vote_session this ballot was cast in. NULL only for pre-migration rows the backfill could not unambiguously attribute. One vote per (session, participant) — see votes_session_participant_key.';
