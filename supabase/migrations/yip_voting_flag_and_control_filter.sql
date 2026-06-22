-- YIP Scoring Framework — Maria's restructuring (part 1: schema)
-- 1. Per-agenda-item "use for voting?" flag on both the global template and each
--    event's agenda. Default false; backfill the canonical voting moments so
--    existing/seeded events keep their Speaker election, party/government
--    formation, cabinet, and Bill vote. No deployed code reads this column yet,
--    so applying this is behaviour-neutral in production until the branch ships.
-- 2. Per-chapter control-panel agenda filter ("full" vs "scored/voted only").

-- ── 1. use_for_voting ───────────────────────────────────────────────
alter table yip.agenda
  add column if not exists use_for_voting boolean not null default false;
alter table yip.agenda_template
  add column if not exists use_for_voting boolean not null default false;

-- Backfill: the canonical voting moments keep voting enabled by default.
update yip.agenda_template set use_for_voting = true
  where agenda_type in ('speaker_election','party_formation','cabinet_intro','bill_presentation')
    and use_for_voting = false;
update yip.agenda set use_for_voting = true
  where agenda_type in ('speaker_election','party_formation','cabinet_intro','bill_presentation')
    and use_for_voting = false;

-- ── 2. Per-chapter control-panel agenda filter ──────────────────────
create table if not exists yip.chapter_settings (
  yi_chapter_id uuid primary key,
  control_agenda_filter text not null default 'full'
    check (control_agenda_filter in ('full','scored_voted_only')),
  updated_at timestamptz not null default now()
);

-- Server-only (service client). New yip.* tables ship anon-readable by default —
-- enable RLS with no policies and revoke from anon/authenticated so PostgREST
-- exposes nothing. All reads/writes go through server actions on the service role.
alter table yip.chapter_settings enable row level security;
revoke all on yip.chapter_settings from anon, authenticated;
