-- YIP #4: cumulative within-session averaging (repeat speakers / turns).
--
-- DISRUPTIVE live cutover — DO NOT apply to prod before the event window closes
-- (build + verify on a clone first). Until applied, the app keeps the current
-- one-score-per-(juror,participant,session) last-wins behaviour.
--
-- WHAT CHANGES
-- Today a juror has at most ONE score per (jury_assignment_id, participant_id,
-- agenda_item_id) — re-scoring is last-wins (the unique key forces it). For a
-- delegate who speaks multiple times in a session, only the final score counted.
--
-- This adds an `occurrence` column so a juror can record multiple TURNS for the
-- same delegate in the same session, each its own editable row. The unique key
-- moves to include occurrence. Aggregation (computeResults) then averages a
-- juror's turns into one per-juror-per-session mark, THEN averages across jurors
-- (two-level) — so every juror still counts equally regardless of turn count.
--
-- BACKWARD-COMPATIBLE DATA: every existing row defaults to occurrence = 1, so the
-- new unique key (…, occurrence) is satisfied with no collisions and results are
-- unchanged until a second turn is actually recorded.

alter table yip.scores
  add column if not exists occurrence integer not null default 1;

-- Move the uniqueness from (juror, participant, session) to include the turn.
alter table yip.scores
  drop constraint if exists scores_jaid_pid_aid_key;

alter table yip.scores
  add constraint scores_jaid_pid_aid_occ_key
  unique (jury_assignment_id, participant_id, agenda_item_id, occurrence);
