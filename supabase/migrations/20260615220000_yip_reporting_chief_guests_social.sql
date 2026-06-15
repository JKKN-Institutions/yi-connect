-- YIP Batch-3 reporting: #11 chief guests + #12 social links & reach.
--
-- Both feed the post-session National report and render on the event Overview.
-- ADDITIVE only — a new table + two nullable event columns. Inert until the
-- organiser fills them in.

-- ── #11: Chief guests (one row per guest, ordered) ──────────────────────────
create table if not exists yip.event_chief_guests (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references yip.events(id) on delete cascade,
  name          text not null,
  designation   text,
  organization  text,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_event_chief_guests_event
  on yip.event_chief_guests(event_id, display_order);

-- New yip.* tables default to an anon-readable ACL → REVOKE + RLS-with-no-policies
-- so only service_role (app writes, which bypass RLS) can touch it.
alter table yip.event_chief_guests enable row level security;
revoke all on yip.event_chief_guests from anon, authenticated;
grant all on yip.event_chief_guests to service_role;

-- ── #12: Social links + reach (event-level reporting fields) ────────────────
-- social_links: post URLs the chapter shared for this event.
-- social_reach_count: total reach/impressions across those posts (organiser-entered).
--
-- NOTE on visibility: yip.events has a TABLE-LEVEL anon/authenticated SELECT
-- grant (the projector reads the live event), so these new columns inherit it —
-- they are anon-readable for rows the projector RLS already exposes. That is
-- acceptable: both are non-sensitive public reporting data (post URLs are public
-- already; reach is a marketing count). We deliberately do NOT column-scope the
-- events grant here — converting it would risk the projector read path (#451).
-- Writes remain service-role only (RLS + no anon write policy on events).
alter table yip.events add column if not exists social_links text[] not null default '{}';
alter table yip.events add column if not exists social_reach_count integer;
