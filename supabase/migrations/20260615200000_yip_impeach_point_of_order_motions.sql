-- YIP: two new parliamentary motion types — Point of Order and Impeach Speaker.
--
-- #5 point_of_order  — a no-vote, Speaker-rules motion (like breach_of_privilege).
--                      Appears automatically in the student raise-a-motion picker.
-- #1 impeach_speaker — a VOTED motion. The House votes Aye/Nay/Abstain (the same
--                      aye/nay/abstain machinery as a No-Confidence motion) and,
--                      if it passes, the sitting Speaker + Deputy Speaker are
--                      vacated to MP and a fresh Speaker election is opened.
--
-- ADDITIVE only — two new enum values + impeach_speaker added to the vote_type
-- CHECK constraints on vote_sessions and votes. No existing row uses the new
-- values, so every change is safe. No drops, no data backfill.
--
-- NOTE: motion_type is the public.motion_type ENUM (the yip.motions.motion_type
-- column uses it). Postgres ADD VALUE is committed-once and cannot be used in
-- the same transaction it is added in — run these as standalone statements.

-- ── New motion types (public.motion_type enum) ──────────────────────────────
ALTER TYPE public.motion_type ADD VALUE IF NOT EXISTS 'point_of_order';
ALTER TYPE public.motion_type ADD VALUE IF NOT EXISTS 'impeach_speaker';

-- ── impeach_speaker is a House floor vote — extend the vote_type CHECKs ──────
-- A ballot's vote_type mirrors its session's, so both tables get the new value.
-- (point_of_order is a no-vote motion and needs no vote_type change.)
ALTER TABLE yip.vote_sessions DROP CONSTRAINT IF EXISTS vote_sessions_vote_type_check;
ALTER TABLE yip.vote_sessions ADD CONSTRAINT vote_sessions_vote_type_check
  CHECK (vote_type = ANY (ARRAY['speaker_election','bill_vote','party_leader','no_confidence','impeach_speaker']));

ALTER TABLE yip.votes DROP CONSTRAINT IF EXISTS votes_vote_type_check;
ALTER TABLE yip.votes ADD CONSTRAINT votes_vote_type_check
  CHECK (vote_type = ANY (ARRAY['speaker_election','bill_vote','party_leader','no_confidence','impeach_speaker']));
