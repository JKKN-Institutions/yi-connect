-- ═══════════════════════════════════════════════════════════════════
-- YIP Self-Nomination — one window PER ROLE, not one for all of them
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- yip.events.self_nomination_open is a SINGLE boolean. That was right when
-- there were three roles that all opened together (2026-08-14). Since
-- 2026-08-21 there are eight, and they run at different times: Administrator /
-- Speaker / Party Leader before Government Formation, then PM & LOP, then
-- Cabinet / Shadow, and Student Journalist on its own day.
--
-- With one switch, opening the window for Student Journalist ALSO reopens
-- Administrator, Speaker and Party Leader — letting students edit or withdraw
-- nominations the organiser has already selected from. This migration gives
-- each role its own switch.
--
-- Shape mirrors yip.questionnaire_windows (event_id + key + state, one row
-- each, unique index) so the two windows systems read the same way.
--
-- BACKWARDS-COMPATIBLE BY CONSTRUCTION: every existing event is backfilled
-- with its CURRENT self_nomination_open value for the three original roles, so
-- no running chapter changes behaviour on deploy. The five later roles default
-- CLOSED — an organiser opens them deliberately.
--
-- events.self_nomination_open is deliberately KEPT, not dropped. It stays as
-- the value the backfill read, and dropping a column that live code may still
-- reference during a rolling deploy is how you take a chapter down mid-event.
-- It is no longer the authority: readOpenNominationRoles() reads this table.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists yip.self_nomination_windows (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references yip.events(id) on delete cascade,
  role       text not null,
  is_open    boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint yip_self_nomination_windows_role_check check (
    role in ('parliamentary_administrator','speaker','party_leader',
             'parliamentary_journalist','prime_minister','leader_of_opposition',
             'cabinet_minister','shadow_minister')
  )
);

-- One row per (event, role) — also the ON CONFLICT target the admin toggle
-- upserts against.
create unique index if not exists yip_self_nomination_windows_event_role
  on yip.self_nomination_windows (event_id, role);

-- Backfill. The three ORIGINAL roles inherit each event's current switch, so
-- an event with the window open right now stays open for exactly the roles it
-- was already open for. Everything added on 2026-08-21 starts closed.
insert into yip.self_nomination_windows (event_id, role, is_open)
select e.id, r.role,
       case when r.role in ('parliamentary_administrator','speaker','party_leader')
            then coalesce(e.self_nomination_open, false)
            else false
       end
from yip.events e
cross join (values
  ('parliamentary_administrator'),('speaker'),('party_leader'),
  ('parliamentary_journalist'),('prime_minister'),('leader_of_opposition'),
  ('cabinet_minister'),('shadow_minister')
) as r(role)
on conflict (event_id, role) do nothing;

-- Same RLS posture as yip.self_nominations: server-action-only. Enable RLS
-- with NO anon/authenticated policies (deny-all by default); students reach it
-- only through the self-nomination server actions, which resolve identity from
-- the httpOnly yip_session cookie.
alter table yip.self_nomination_windows enable row level security;

-- Mgmt-API-created tables get NO default service_role grant — grant explicitly
-- or every service-client read/write silently fails.
grant all on yip.self_nomination_windows to service_role;
