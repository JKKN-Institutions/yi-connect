-- YIP AI LAYER — foundation tables.
--
-- The prod app NEVER calls an LLM. AI runs OUT-OF-BAND in an hourly Claude Code
-- routine that polls a bearer-protected endpoint (app/yip/api/ai-drafts) to (1)
-- GET pending requests + their grounding inputs and (2) POST back the draft.
--
-- Two objects, both additive + idempotent:
--   1. yip.ai_drafts  — one row per (event, kind, subject). The app enqueues a
--      row (status='requested'), the routine fills draft_text, the app reads it.
--   2. yip.events.ai_enabled — chair opt-in flag. OFF by default (cards are
--      shown to minors, so AI features stay off until the chair turns them on).
--
-- status flow:
--   requested -> generating -> ready          (participant_story; auto-shows)
--   requested -> generating -> pending_review (round_narrative; chair gate)
--                              pending_review -> approved | rejected
--
-- kind values:
--   'participant_story' (subject_id = participants.id) — dispute-proof, NO scores
--   'round_narrative'   (subject_id NULL, event-level) — chair report narrative
--   'ministry_verdict'  (future)

create table if not exists yip.ai_drafts (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references yip.events(id) on delete cascade,
  kind         text not null,
  subject_id   uuid null,
  status       text not null default 'requested',
  draft_text   text,
  source_refs  jsonb default '[]'::jsonb,
  model_note   text,
  generated_at timestamptz,
  reviewed_by  uuid,
  approved_text text,
  reviewed_at  timestamptz,
  is_mock      boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- One draft per (event, kind, subject). subject_id is NULL for event-level kinds;
-- a partial unique index handles the NULL case (a plain UNIQUE treats NULLs as
-- distinct, which would allow duplicate round_narrative rows per event).
create unique index if not exists ai_drafts_event_kind_subject_uniq
  on yip.ai_drafts (event_id, kind, subject_id)
  where subject_id is not null;

create unique index if not exists ai_drafts_event_kind_nullsubject_uniq
  on yip.ai_drafts (event_id, kind)
  where subject_id is null;

-- Lookup indexes: the routine GETs pending rows; the app reads by (event,kind).
create index if not exists ai_drafts_status_idx on yip.ai_drafts (status);
create index if not exists ai_drafts_event_kind_idx on yip.ai_drafts (event_id, kind);

comment on table yip.ai_drafts is
  'Out-of-band AI drafts for YIP. The app enqueues requests + reads drafts; an hourly Claude Code routine generates them via the bearer endpoint app/yip/api/ai-drafts. kind: participant_story (dispute-proof, no scores) | round_narrative (chair-reviewed report narrative) | ministry_verdict (future). status: requested -> generating -> ready | pending_review -> approved | rejected.';
comment on column yip.ai_drafts.source_refs is
  'Anti-hallucination citations: JSON array of the grounded rows the draft was built from. Surfaced to the reviewer/organiser.';
comment on column yip.ai_drafts.approved_text is
  'Chair-reviewed final text. The printed official report renders approved_text ONLY (never un-reviewed draft_text).';

-- Chair opt-in for AI features. OFF by default — participant cards are shown to
-- minors, so generation/auto-show is gated on this flag.
alter table yip.events
  add column if not exists ai_enabled boolean default false;

comment on column yip.events.ai_enabled is
  'Chair opt-in for YIP AI features (participant story cards + report narrative). Default false; cards auto-show only when true AND a ready/approved draft exists.';
