-- YIP Growth Feedback Loop — per-session, self-referential coaching notes.
--
-- Adds the session-level discriminator to yip.ai_drafts and reworks the
-- participant-level unique index into TWO partial uniques so that:
--   • participant_story keeps ONE row per (event, participant)        [agenda_item_id NULL]
--   • session_feedback gets ONE row per (event, participant, session) [agenda_item_id NOT NULL]
-- The event-level null-subject index (round_narrative) is untouched.
--
-- Fully additive + idempotent. Safe to re-run. No data backfill needed:
-- existing participant_story / round_narrative rows already have agenda_item_id
-- defaulting to NULL, which the new participant-level index requires.

-- 1. The session this draft is about (NULL for every non-session kind).
ALTER TABLE yip.ai_drafts
  ADD COLUMN IF NOT EXISTS agenda_item_id uuid NULL
  REFERENCES yip.agenda(id) ON DELETE CASCADE;

-- 2. Drop the old participant-level unique (it ignored agenda_item_id, so it
--    would wrongly collapse all of a participant's session_feedback rows into
--    one). Replaced by the two partial indexes below.
DROP INDEX IF EXISTS yip.ai_drafts_event_kind_subject_uniq;

-- 3a. Participant-level kinds (participant_story): one row per (event, kind,
--     participant), only when there is NO session attached.
CREATE UNIQUE INDEX IF NOT EXISTS ai_drafts_event_kind_subject_nosession_uniq
  ON yip.ai_drafts (event_id, kind, subject_id)
  WHERE subject_id IS NOT NULL AND agenda_item_id IS NULL;

-- 3b. Session-level kind (session_feedback): one row per (event, kind,
--     participant, session).
CREATE UNIQUE INDEX IF NOT EXISTS ai_drafts_event_kind_subject_session_uniq
  ON yip.ai_drafts (event_id, kind, subject_id, agenda_item_id)
  WHERE agenda_item_id IS NOT NULL;

-- 4. Helpful lookup for the participant growth-card reader + the self-running
--    detector (find a participant's session_feedback rows fast).
CREATE INDEX IF NOT EXISTS ai_drafts_kind_subject_idx
  ON yip.ai_drafts (event_id, kind, subject_id);
