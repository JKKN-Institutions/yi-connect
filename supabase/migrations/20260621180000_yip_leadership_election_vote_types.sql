-- Leadership in-app elections: extend the vote_type CHECK constraints to allow
-- the new election types. ADDITIVE only — no existing row uses the new values,
-- so every change is safe. No drops of data, no backfill.
--
-- Single-winner bench elections (bench-scoped by party_side):
--   prime_minister, deputy_prime_minister, leader_of_opposition
-- Multi-seat per-party elections (party-scoped by party_id, top-k win):
--   cabinet_minister, shadow_minister
--
-- A ballot's vote_type mirrors its session's, so both yip.vote_sessions and
-- yip.votes get the new values.

ALTER TABLE yip.vote_sessions DROP CONSTRAINT IF EXISTS vote_sessions_vote_type_check;
ALTER TABLE yip.vote_sessions ADD CONSTRAINT vote_sessions_vote_type_check
  CHECK (vote_type = ANY (ARRAY[
    'speaker_election','bill_vote','party_leader','no_confidence','impeach_speaker',
    'prime_minister','deputy_prime_minister','leader_of_opposition',
    'cabinet_minister','shadow_minister'
  ]));

ALTER TABLE yip.votes DROP CONSTRAINT IF EXISTS votes_vote_type_check;
ALTER TABLE yip.votes ADD CONSTRAINT votes_vote_type_check
  CHECK (vote_type = ANY (ARRAY[
    'speaker_election','bill_vote','party_leader','no_confidence','impeach_speaker',
    'prime_minister','deputy_prime_minister','leader_of_opposition',
    'cabinet_minister','shadow_minister'
  ]));
