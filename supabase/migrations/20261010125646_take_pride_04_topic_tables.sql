-- Take Pride 2026: topic tables ("circles") delegates can join or host.
--
-- ADDITIVE ONLY. Two new tables, same access model as take_pride_01: RLS
-- ENABLED with ZERO policies, only the service client reads or writes,
-- behind a delegate's secret pass token or the organiser gate
-- (lib/take-pride/tables.ts). No contact details are stored here.
--
-- A table runs at one of the agenda's networking times (day + starts_at)
-- at one lounge table (place). The host, when a delegate hosts, also holds
-- a seat as a member. Seat cap, time clash and the 2-tables-per-host cap
-- are enforced in the app with a re-check after insert; the partial unique
-- index below stops two open tables at the same place and time.

create table if not exists yi_connect.tp_circles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 60),
  about text check (about is null or char_length(about) <= 200),
  host_delegate_id uuid references yi_connect.tp_delegates(id) on delete cascade,
  created_by_organiser boolean not null default false,
  day smallint not null check (day in (1, 2)),
  starts_at text not null,
  place text not null,
  seats integer not null check (seats between 2 and 30),
  status text not null default 'open' check (status in ('open', 'cancelled')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists yi_connect.tp_circle_members (
  circle_id uuid not null references yi_connect.tp_circles(id) on delete cascade,
  delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, delegate_id)
);

create index if not exists tp_circle_members_delegate_idx on yi_connect.tp_circle_members (delegate_id);
create index if not exists tp_circles_host_idx on yi_connect.tp_circles (host_delegate_id);
create unique index if not exists tp_circles_open_place_key
  on yi_connect.tp_circles (day, starts_at, place)
  where status = 'open';

do $$
declare t text;
begin
  foreach t in array array['tp_circles','tp_circle_members'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated, public', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;

-- Six SAMPLE organiser tables on the 1% Shift theme, at the agenda's
-- networking times (the "Lunch / Morning brief and partner meetings" slots).
insert into yi_connect.tp_circles
  (id, title, about, created_by_organiser, day, starts_at, place, seats, status, is_sample)
values
  ('ed371b7e-11c4-42c4-b477-43a1b3c826a7', 'Founders who export',
   'One small change that opened a new market. Bring your export story or your first question.',
   true, 1, '13:00', 'Lounge table A', 10, 'open', true),
  ('1ea0e3bb-775e-4b85-a708-1a0227bd2602', 'Climate action lunch table',
   'Practical 1% shifts on energy, waste and water that a chapter or a factory can start next month.',
   true, 1, '13:00', 'Lounge table B', 10, 'open', true),
  ('d844154a-887e-483b-b4eb-dd1ada454c51', 'Family business, next generation',
   'Taking over, growing, or changing a family business without breaking the family.',
   true, 2, '09:30', 'Lounge table A', 10, 'open', true),
  ('a9e035f5-51df-4978-a3f0-669a727def5a', 'Road safety in your city',
   'What chapters have tried on road safety, what worked, and what one city can copy from another.',
   true, 2, '09:30', 'Lounge table B', 10, 'open', true),
  ('8df6bfd9-5a89-4cba-a671-6d99e45b5c8d', 'Women in Yi leadership',
   'How more women lead chapters and verticals, and the small changes that make it easier.',
   true, 2, '13:00', 'Lounge table A', 10, 'open', true),
  ('37e0663d-6723-415a-aa47-0ef9eef11ed2', 'First-time chapter chairs',
   'New and incoming chairs swap what they wish they had known in their first 100 days.',
   true, 2, '13:00', 'Lounge table B', 10, 'open', true)
on conflict (id) do nothing;
