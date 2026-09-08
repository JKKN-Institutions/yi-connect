-- A paper handed in as a FILE must never be auto-scored as blank.
--
-- Why: the external scoring routine is sent `position, question_text,
-- answer_text` and nothing else (lib/yip/questionnaire-scoring.ts). It cannot
-- see uploaded files and cannot read a photograph of handwriting. So a
-- candidate who uploads their report and types nothing would be marked as
-- having written nothing — and a near-zero mark, once written, looks exactly
-- like a real judgement of their work.
--
-- `failed` is deliberately NOT reused for this. It reads as a technical error
-- and it is re-queueable, so an organiser would send the paper straight back to
-- the scorer and it would be skipped again — a loop with no exit.
--
-- `needs_human` is a resting state, not an error: the paper is complete, it is
-- simply waiting for a person to open the pages and enter marks.

ALTER TABLE yip.questionnaire_attempts
  DROP CONSTRAINT IF EXISTS questionnaire_attempts_scoring_status_check;

ALTER TABLE yip.questionnaire_attempts
  ADD CONSTRAINT questionnaire_attempts_scoring_status_check
  CHECK (scoring_status = ANY (ARRAY[
    'pending'::text,
    'scoring'::text,
    'scored'::text,
    'failed'::text,
    'needs_human'::text
  ]));

COMMENT ON COLUMN yip.questionnaire_attempts.scoring_status IS
  'pending → scoring → scored | failed | needs_human. needs_human means the paper was handed in as a file the automatic scorer cannot read; a person must open it and enter marks. It is NOT an error and must not be re-queued to the scorer.';
