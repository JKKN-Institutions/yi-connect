-- =====================================================================
-- YIQ 13 — event admin: an editable qualifying line + auditable
--          team disqualification.
--
-- Director rulings, 2026-08-25:
--
--   (1) yiq.chapter_events.qualifying_team_count already exists (default 10,
--       CHECK 2..50) and is READ in seven places and WRITTEN in none. It
--       becomes editable: by the chapter organiser only BEFORE the online
--       round opens, and by YIQ national at any time. That rule is enforced
--       in code (lib/yiq/event-admin.ts + app/yiq/actions/event-admin.ts),
--       not here — the column itself needs no change.
--
--   (2) yiq.teams.status already ALLOWS 'disqualified' and nothing ever set
--       it. This migration adds the audit trail that makes setting it
--       defensible: the reason, who did it, when, and the status to restore
--       on an undo.
--
-- Deliberately NOT done here:
--   * no delete of attempts or answers. A disqualified team keeps every row
--     it wrote; disqualification changes standing, never history. The
--     standings query already excludes it
--     (app/yiq/actions/admin.ts: .not("status","in","(withdrawn,disqualified)")).
--   * no touch to any other yiq table.
--
-- Safe to re-run.
-- =====================================================================

alter table yiq.teams
  add column if not exists disqualified_reason text,
  add column if not exists disqualified_at timestamptz,
  add column if not exists disqualified_by uuid,
  -- The status the team held immediately before disqualification, so an undo
  -- restores what was actually there instead of guessing.
  add column if not exists status_before_disqualification text;

comment on column yiq.teams.disqualified_reason is
  'Required free text recorded when status is set to disqualified. Never cleared silently — a reinstatement moves it to the audit log and nulls it.';
comment on column yiq.teams.disqualified_at is
  'When the team was disqualified (UTC).';
comment on column yiq.teams.disqualified_by is
  'auth.users.id of the organiser or national admin who disqualified the team.';
comment on column yiq.teams.status_before_disqualification is
  'Status held just before disqualification; restored on reinstatement.';

-- A disqualified team must carry a reason. This encodes the ruling at the
-- table so no future code path can disqualify silently. No existing row can
-- violate it: nothing has ever written 'disqualified' to yiq.teams.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'yiq.teams'::regclass
      and conname = 'teams_disqualified_needs_reason'
  ) then
    alter table yiq.teams
      add constraint teams_disqualified_needs_reason
      check (
        status <> 'disqualified'
        or (disqualified_reason is not null and length(btrim(disqualified_reason)) >= 6)
      );
  end if;
end $$;

-- Reading "which teams in this chapter are out, and why" is a per-event
-- question asked by one screen; index the predicate it filters on.
create index if not exists yiq_teams_disqualified
  on yiq.teams (chapter_event_id)
  where status = 'disqualified';
