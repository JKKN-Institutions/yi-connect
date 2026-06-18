-- ============================================================================
-- YIP Central Agenda Template (yip.agenda_template)
-- ============================================================================
-- One canonical 2-day YIP agenda that every NEW chapter event inherits at
-- creation (app/yip/actions/events.ts:createEvent reads this table first, and
-- falls back to the DEFAULT_AGENDA_TEMPLATE constant when the table is empty).
-- A super-admin can also re-push it onto ALL chapter events (overwrite) from
-- /yip/dashboard/admin/agenda (pushAgendaToAllChapterEvents).
--
-- NOTE: This migration documents structure that is ALREADY APPLIED in
-- production (project bkmpbcoxbjyafieabxao). It is idempotent and safe to
-- re-run; it exists for repo-as-source-of-truth and fresh-environment setup.
-- The agenda_mode enum lives in the PUBLIC schema and is assumed to exist.
-- ============================================================================

-- ── Table ───────────────────────────────────────────────────────────────────
create table if not exists yip.agenda_template (
  id               uuid primary key default gen_random_uuid(),
  day              int  not null,
  sequence_order   int  not null,
  title            text not null,
  description      text,
  agenda_type      text,
  duration_minutes int,
  mode             public.agenda_mode not null default 'party',
  is_scoreable     boolean not null default false,
  session_key      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (day, sequence_order)
);

-- ── RLS: lock to service_role only (no policies → authenticated/anon denied) ──
alter table yip.agenda_template enable row level security;

-- Mirror the rest of yip.* hardening: revoke the default table grants from the
-- anon / authenticated roles so PostgREST cannot read or write the template.
-- All app access goes through the service-role server actions in admin-agenda.ts.
revoke all on yip.agenda_template from anon;
revoke all on yip.agenda_template from authenticated;
grant all on yip.agenda_template to service_role;

-- ── Seed: 31 rows (Day 1 = 20 items, Day 2 = 11 items) ───────────────────────
-- Mirrors DEFAULT_AGENDA_TEMPLATE in lib/yip/constants.ts. Idempotent on
-- (day, sequence_order).
insert into yip.agenda_template
  (day, sequence_order, title, description, agenda_type, duration_minutes, mode, is_scoreable, session_key)
values
  (1, 1, 'Registration Opens', null, 'registration', 30, 'mixed', false, null),
  (1, 2, 'Delegates Seated', null, 'inaugural', 10, 'mixed', false, null),
  (1, 3, 'National Anthem', null, 'inaugural', 5, 'mixed', false, null),
  (1, 4, 'Welcome Address', null, 'inaugural', 5, 'mixed', false, null),
  (1, 5, 'About Young Indians', null, 'inaugural', 5, 'mixed', false, null),
  (1, 6, 'Chief Guest Address', null, 'inaugural', 20, 'mixed', false, null),
  (1, 7, 'Event Overview & Instructions', null, 'inaugural', 5, 'mixed', false, null),
  (1, 8, 'Speaker Candidates'' Speeches', null, 'speaker_election', 10, 'party', false, null),
  (1, 9, 'Speaker Election', null, 'speaker_election', 10, 'party', false, null),
  (1, 10, 'Government & Opposition Formation', null, 'party_formation', 10, 'party', false, null),
  (1, 11, 'Seating of Speaker', null, 'oath_taking', 5, 'party', false, null),
  (1, 12, 'Oath Taking Ceremony', null, 'oath_taking', 5, 'party', false, null),
  (1, 13, 'Cabinet & Party Leader Introductions', null, 'cabinet_intro', 25, 'party', false, null),
  (1, 14, 'Break', null, 'break', 15, 'mixed', false, null),
  (1, 15, 'Discussion on Matters of Urgent Public Importance (Part 1)', null, 'opening_speech', 90, 'party', false, null),
  (1, 16, 'Lunch Break', null, 'break', 45, 'mixed', false, null),
  (1, 17, 'Short Duration Discussion / Debate', null, 'debate', 60, 'party', false, null),
  (1, 18, 'Committee Discussions (Bill Drafting)', null, 'committee_discussion', 60, 'committee', false, null),
  (1, 19, 'Instructions for Day 2', null, 'inaugural', 15, 'mixed', false, null),
  (1, 20, 'House Adjourned by Speaker', null, 'adjournment', 5, 'mixed', false, null),
  (2, 1, 'Opening Speeches (Part 2)', null, 'opening_speech', 60, 'party', false, null),
  (2, 2, 'Question Hour', null, 'question_hour', 60, 'party', false, null),
  (2, 3, 'Zero Hour', null, 'zero_hour', 60, 'party', false, null),
  (2, 4, 'Debate on Central Agenda', null, 'debate', 45, 'party', false, null),
  (2, 5, 'Lunch Break', null, 'break', 45, 'mixed', false, null),
  (2, 6, 'Bill Presentation & Voting', null, 'bill_presentation', 105, 'party', false, null),
  (2, 7, 'Closing Statements & Adjournment', null, 'valedictory', 15, 'mixed', false, null),
  (2, 8, 'Valedictory: Chief Guest Address', null, 'valedictory', 20, 'mixed', false, null),
  (2, 9, 'Declaration of Awards', null, 'valedictory', 15, 'mixed', false, null),
  (2, 10, 'Felicitation Ceremony', null, 'valedictory', 10, 'mixed', false, null),
  (2, 11, 'National Anthem', null, 'valedictory', 5, 'mixed', false, null)
on conflict (day, sequence_order) do nothing;
