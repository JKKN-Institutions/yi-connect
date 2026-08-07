-- ═══════════════════════════════════════════════════════════════════
-- YIP Score Revisions — integrity trail for edited SUBMITTED jury scores
-- ───────────────────────────────────────────────────────────────────
-- Sessions whose lock_on_submit is false (Zero Hour, Question Hour) let a
-- juror re-open and edit a score they have already SUBMITTED. Until now that
-- edit overwrote yip.scores in place — the prior submitted version was gone,
-- leaving no way to answer "what did this juror originally give?" in a
-- result dispute.
--
-- Every time submitScore (app/yip/actions/scoring.ts) is about to overwrite
-- a row whose status is 'submitted', it first copies the row's prior values
-- here. Rows are append-only snapshots keyed by score_id; replaced_at orders
-- the history. Logging is best-effort in the action (a trail failure never
-- blocks the score write), and this table is never sent to the browser.
--
-- Deliberately NO foreign keys: the trail must survive deletion of the score
-- it describes (yip.reset_event_for_go_live wipes yip.scores — the integrity
-- record stays).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists yip.score_revisions (
  id                  uuid primary key default gen_random_uuid(),
  score_id            uuid not null,
  event_id            uuid not null,
  jury_assignment_id  uuid,
  participant_id      uuid,
  agenda_item_id      uuid,
  occurrence          int,
  criteria_scores     jsonb,
  total_score         numeric,
  comments            text,
  prior_status        text,
  replaced_at         timestamptz default now()
);

-- History reads are always "all prior versions of one score, in order".
create index if not exists yip_score_revisions_score_replaced
  on yip.score_revisions (score_id, replaced_at);

-- RLS: enable with NO anon/authenticated policies — deny-all by default.
-- Only the service-role client (submitScore's snapshot insert, any future
-- admin review read) touches this table; jurors and participants can never
-- read or rewrite the trail.
alter table yip.score_revisions enable row level security;
