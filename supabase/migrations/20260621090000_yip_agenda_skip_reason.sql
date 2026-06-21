-- Plan-vs-skip distinction (Phase 3): tag WHY an agenda item is not running so the
-- post-event report can tell a pre-event exclusion (Agenda screen "won't run live")
-- apart from an on-the-day Skip (Control panel). Nullable; existing skipped rows
-- read as "Did not run". Applied to live 2026-06-21 before the code deploy.
alter table yip.agenda add column if not exists skip_reason text;
alter table yip.agenda drop constraint if exists agenda_skip_reason_chk;
alter table yip.agenda add constraint agenda_skip_reason_chk
  check (skip_reason is null or skip_reason in ('excluded_preevent','skipped_live'));
