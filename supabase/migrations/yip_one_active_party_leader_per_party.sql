-- Parallel party-leader elections: one ACTIVE election per party at a time.
--
-- Party-leader elections run concurrently (one per party). The app guard in
-- openVote() prevents opening a second election for the SAME party, but that
-- check is read-then-insert (TOCTOU) — a double-click or two organisers could
-- race past it and create two open sessions for one party, splitting that
-- party's ballots and crowning the wrong leader.
--
-- This partial unique index enforces the invariant at the database layer:
-- at most one open/closed party_leader session per (event, party). A revealed
-- session is excluded, so re-electing a party (a fresh session after reveal)
-- still works. openVote() catches the resulting 23505 and returns the friendly
-- "already has an active election" error. Idempotent.

CREATE UNIQUE INDEX IF NOT EXISTS yip_one_active_party_leader_per_party
  ON yip.vote_sessions (event_id, ((config->>'partyId')))
  WHERE vote_type = 'party_leader' AND status IN ('open', 'closed');
