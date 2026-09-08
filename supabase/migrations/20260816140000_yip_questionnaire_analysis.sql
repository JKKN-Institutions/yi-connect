-- Selection questionnaire — the two AI reads an organiser asked for.
--
-- 1. THE PER-CANDIDATE READ (this migration's one column).
--
--    A short organiser-facing note on what a candidate actually argued, written
--    by the SAME out-of-band routine pass that marks the paper (see
--    app/yip/api/questionnaire-scoring/route.ts), not through a second queue.
--    The routine already holds that paper's answers when it scores them, so a
--    separate claim would re-read the same rows, bill a second time, and open a
--    window where the note and the marks describe different answers.
--
--    ORGANISER-ONLY. It is never returned to a participant surface — the
--    student's questionnaire card carries no scoring field at all, by design.
--    These are minors and the ranking only advises: nothing in this codebase
--    may promote, assign or drop anybody on the strength of it.
--
-- 2. THE QUESTION-BANK REVIEW needs no schema at all — it is an ordinary
--    yip.ai_drafts row (kind = 'questionnaire_question_review', subject_id
--    NULL, one per event covering every post's questions). ai_drafts.kind is
--    already `text`, so there is no enum to extend.

alter table yip.questionnaire_attempts
  add column if not exists analysis_note text;

comment on column yip.questionnaire_attempts.analysis_note is
  'Organiser-only AI read of this paper, written by the scoring routine alongside the marks. Advisory. Never shown to the student.';
