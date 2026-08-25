-- =====================================================================
-- YIQ — a team's online score becomes an AVERAGE, not a sum.
--
-- Director ruling, 2026-08-25 (AskUserQuestion interview):
--   "A team registers 3 students, only 2 sit. Is the sum fair?"
--   -> AVERAGE the ones who sat, with a FLOOR OF 2: fewer than two
--      members sat and the team is OUT.
--
-- WHY: under the sum, one ill student ended a strong team's run — a
-- 2-member team scoring 88 and 90 lost to a 3-member team averaging 83.
-- Under a plain average a school could instead enter three students,
-- sit only its strongest, and win on one score; the floor of 2 closes
-- that without punishing bad luck.
--
-- The column `online_total_score` now holds an AVERAGE. Rather than
-- rename it (deployed code still reads the old name, and a rename
-- between migration and deploy is an outage), a correctly-named column
-- is ADDED and both are written for this cycle. Drop the old one once
-- nothing reads it.
-- =====================================================================

alter table yiq.teams
  add column if not exists online_score numeric(10,2),
  -- How many members actually sat. Already stored as
  -- online_members_attempted; kept alongside the score because an
  -- average without its denominator is unreadable on a results page.
  add column if not exists online_eliminated_reason text;

comment on column yiq.teams.online_total_score is
  'DEPRECATED NAME: holds the team AVERAGE since 2026-08-25, not a total. Read online_score instead.';
comment on column yiq.teams.online_score is
  'Team average across the members who sat. NULL until standings are computed. See online_members_attempted for the denominator.';
comment on column yiq.teams.online_eliminated_reason is
  'Set when a team is out for a structural reason rather than rank — currently only insufficient_members (fewer than 2 sat).';

-- Backfill: no chapter has published standings yet, so there is nothing
-- to convert. Assert that, rather than assume it — if a chapter HAS
-- published, a human must decide whether to recompute.
do $do$
declare published integer;
begin
  select count(*) into published
  from yiq.chapter_events where results_published_at is not null;
  if published > 0 then
    raise exception
      'YIQ: % chapter(s) already published standings under the SUM model. Recompute them deliberately before applying this.', published;
  end if;
  raise notice 'YIQ average-scoring migration: no published standings to convert.';
end;
$do$;
