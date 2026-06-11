-- Add 'party_leader' to the vote_type CHECK on yip.vote_sessions and yip.votes
-- so each party can elect its own leader through the same voting pipeline used
-- for Speaker elections and bill votes. Applied to the live DB on 2026-06-11.

ALTER TABLE yip.vote_sessions DROP CONSTRAINT IF EXISTS vote_sessions_vote_type_check;
ALTER TABLE yip.vote_sessions
  ADD CONSTRAINT vote_sessions_vote_type_check
  CHECK (vote_type = ANY (ARRAY['speaker_election'::text, 'bill_vote'::text, 'party_leader'::text]));

ALTER TABLE yip.votes DROP CONSTRAINT IF EXISTS votes_vote_type_check;
ALTER TABLE yip.votes
  ADD CONSTRAINT votes_vote_type_check
  CHECK (vote_type = ANY (ARRAY['speaker_election'::text, 'bill_vote'::text, 'party_leader'::text]));
