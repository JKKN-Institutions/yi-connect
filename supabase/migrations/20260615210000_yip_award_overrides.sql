-- YIP #6: Manual award override.
--
-- All 15 Yi-2026 awards are auto-computed by computeResults() (results.ts) and
-- written to results.award_category as a comma-joined string. A chair sometimes
-- needs the final say — e.g. the jury's intent differs from the raw tally, or a
-- tie was broken off-platform. This table lets a chair pin THE winner for one
-- award; computeResults applies the overrides as a final pass (remove the auto
-- winner of that award, award it to the chosen participant) so it survives every
-- recompute.
--
-- One override per (event, award_label). ADDITIVE + INERT: until a row exists,
-- computeResults reads an empty set and produces identical results.

create table if not exists yip.award_overrides (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references yip.events(id) on delete cascade,
  -- The exact award label as produced by computeResults (see lib/yip/awards.ts
  -- AWARD_LABELS — the single source of truth the override UI + action validate
  -- against). Stored verbatim so the final pass can string-match it.
  award_label    text not null,
  participant_id uuid not null references yip.participants(id) on delete cascade,
  note           text,
  set_by_user    uuid,
  set_by_email   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (event_id, award_label)
);

create index if not exists idx_award_overrides_event
  on yip.award_overrides(event_id);

-- Service-role only (app writes bypass RLS via service_role). New yip.* tables
-- default to anon-readable ACL — REVOKE + RLS-with-no-policies locks it down so
-- a public/anon key can never read or rig award assignments.
alter table yip.award_overrides enable row level security;
revoke all on yip.award_overrides from anon, authenticated;
grant all on yip.award_overrides to service_role;
