-- Director ruling 2026-06-25: some sessions (e.g. Party Leader Selections,
-- Speaker Candidates' Speeches) should remain JURY-SCOREABLE for feedback /
-- leadership judgement, but must NOT count toward the /90 academic total.
-- `is_scoreable` controls jury visibility; this new flag controls inclusion in
-- the results aggregation, decoupling the two. results.ts (computeResults)
-- drops scores on agenda rows where exclude_from_final = true.
alter table yip.agenda
  add column if not exists exclude_from_final boolean not null default false;

comment on column yip.agenda.exclude_from_final is
  'When true, this session stays jury-scoreable (is_scoreable) but its scores are excluded from the /90 academic final. Leadership-only sessions set this true.';
