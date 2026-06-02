-- Global per-session scoring configuration (BUG-385 follow-up).
--
-- Super-admin defines, ONCE and centrally, the scoring parameters + weight for
-- each session TYPE. Keyed by agenda_type, so a config (e.g. 'question_hour')
-- applies to every event's matching agenda items across ALL chapters — same
-- global model as yip.rubrics / scoring_flags_config / position_bonus_config
-- (none of which carry an event_id/chapter scope).
--
-- `parameters` is flexible JSONB so a session can use a subset + re-weight of the
-- 110-mark rubric OR fully session-specific parameters, and can carry BOTH
-- evaluation parameters and participation parameters (kind: 'evaluation' |
-- 'participation'). `session_weight` drives the per-delegate WEIGHTED AVERAGE
-- across the sessions they were scored in (replaces the earlier best-N model).
--
-- Additive + inert: nothing reads this table until the per-session scoring code
-- ships. The disruptive scores-uniqueness cutover stays separate.

create table if not exists yip.session_parameters (
  id            uuid primary key default gen_random_uuid(),
  agenda_type   text not null,
  label         text not null,
  -- [{ key, label, kind: 'evaluation'|'participation', max_score, weight }]
  parameters    jsonb not null default '[]'::jsonb,
  total_max     integer not null default 0,
  session_weight numeric not null default 1,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (agenda_type)
);

create index if not exists idx_session_parameters_active
  on yip.session_parameters(agenda_type) where is_active;

-- Lock down: reachable only via service-role server actions (super-admin gated),
-- exactly like yip.jury_session_assignments.
alter table yip.session_parameters enable row level security;
revoke all on yip.session_parameters from anon, authenticated;
grant all on yip.session_parameters to service_role;
