-- Global per-session scoring configuration (BUG-385 follow-up).
--
-- A CRUDable catalog of named scoring sessions, set centrally by super-admin and
-- applied to every chapter's events (global — no event/chapter scope, same model
-- as yip.rubrics). Keyed by a stable `session_key` so distinct sessions that
-- share an agenda_type (e.g. Speaker Candidates' Speeches vs Speaker Election,
-- or the two Debates) are each their own row. `agenda_type` is kept as a
-- non-unique reference for mapping to event agenda items.
--
-- `parameters` is flexible JSONB (subset/re-weight of the 110 rubric OR custom;
-- evaluation + participation kinds). `session_weight` drives the per-delegate
-- WEIGHTED AVERAGE across sessions. Seeded with the 11 handbook sessions as
-- defaults — others can be added and these removed later.
--
-- Additive + inert until the per-session scoring engine reads it.

drop table if exists yip.session_parameters cascade;

create table yip.session_parameters (
  id             uuid primary key default gen_random_uuid(),
  session_key    text not null unique,
  label          text not null,
  agenda_type    text,
  display_order  integer not null default 0,
  -- [{ key, label, kind: 'evaluation'|'participation', max_score, weight }]
  parameters     jsonb not null default '[]'::jsonb,
  total_max      integer not null default 0,
  session_weight numeric not null default 1,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_session_parameters_order
  on yip.session_parameters(display_order) where is_active;

alter table yip.session_parameters enable row level security;
revoke all on yip.session_parameters from anon, authenticated;
grant all on yip.session_parameters to service_role;

-- Seed the 11 handbook scoreable sessions as editable defaults, each starting
-- from the standard 110-mark parameter set (super-admin tunes per session later).
insert into yip.session_parameters
  (session_key, label, agenda_type, display_order, parameters, total_max, session_weight)
select
  v.session_key, v.label, v.agenda_type, v.display_order,
  '[{"key":"content","label":"Content & Substance","kind":"evaluation","max_score":30,"weight":1},
    {"key":"communication","label":"Communication & Delivery","kind":"evaluation","max_score":25,"weight":1},
    {"key":"conduct","label":"Parliamentary Conduct & Decorum","kind":"evaluation","max_score":30,"weight":1},
    {"key":"argumentation","label":"Argumentation & Persuasion","kind":"evaluation","max_score":15,"weight":1},
    {"key":"teamwork","label":"Teamwork & Collaboration","kind":"evaluation","max_score":10,"weight":1}]'::jsonb,
  110, 1
from (values
  ('speaker_candidates_speeches','Speaker Candidates'' Speeches','speaker_election',1),
  ('speaker_election','Speaker Election','speaker_election',2),
  ('cabinet_party_intros','Cabinet & Party Leader Introductions','cabinet_intro',3),
  ('urgent_public_importance','Discussion on Matters of Urgent Public Importance (Opening Speeches)','opening_speech',4),
  ('short_duration_debate','Short Duration Discussion / Debate','debate',5),
  ('committee_bill_drafting','Committee Discussions (Bill Drafting)','committee_discussion',6),
  ('opening_speeches','Opening Speeches','opening_speech',7),
  ('question_hour','Question Hour','question_hour',8),
  ('zero_hour','Zero Hour','zero_hour',9),
  ('debate_central_agenda','Debate on Central Agenda','debate',10),
  ('bill_presentation_voting','Bill Presentation & Voting','bill_presentation',11)
) as v(session_key, label, agenda_type, display_order);
