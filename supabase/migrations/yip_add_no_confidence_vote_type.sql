-- YIP: make a No-Confidence motion a real House floor vote.
--
-- Today the Speaker eyeballs a show of hands and types the tally. This lets the
-- whole House vote on the motion from their phones (reusing the bill-vote
-- aye/nay/abstain machinery), and the result is COUNTED from yip.votes — no
-- hand-entered numbers.
--
-- Adds 'no_confidence' to the vote_type CHECK on BOTH vote_sessions and votes
-- (a ballot's vote_type mirrors its session's). Additive only — no existing row
-- uses the new value, so the constraint swap is safe.

ALTER TABLE yip.vote_sessions DROP CONSTRAINT IF EXISTS vote_sessions_vote_type_check;
ALTER TABLE yip.vote_sessions ADD CONSTRAINT vote_sessions_vote_type_check
  CHECK (vote_type = ANY (ARRAY['speaker_election','bill_vote','party_leader','no_confidence']));

ALTER TABLE yip.votes DROP CONSTRAINT IF EXISTS votes_vote_type_check;
ALTER TABLE yip.votes ADD CONSTRAINT votes_vote_type_check
  CHECK (vote_type = ANY (ARRAY['speaker_election','bill_vote','party_leader','no_confidence']));
