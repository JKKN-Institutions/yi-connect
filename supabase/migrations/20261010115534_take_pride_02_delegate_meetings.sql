-- Take Pride 2026: delegate-to-delegate meeting requests.
--
-- ADDITIVE ONLY. One new column on tp_delegates (who is open to being asked
-- by other delegates) and one new table of requests between two delegates.
-- Same access model as take_pride_01: RLS ENABLED with ZERO policies, only
-- the service client reads or writes, behind the delegate's secret pass
-- token (lib/take-pride/delegate-match.ts). No contact details are stored.

alter table yi_connect.tp_delegates
  add column if not exists delegate_meetings_opt_in boolean not null default true;

create table if not exists yi_connect.tp_delegate_meetings (
  id uuid primary key default gen_random_uuid(),
  from_delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  to_delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined')),
  note text check (note is null or char_length(note) <= 140),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_delegate_id, to_delegate_id),
  check (from_delegate_id <> to_delegate_id)
);

create index if not exists tp_delegate_meetings_to_idx on yi_connect.tp_delegate_meetings (to_delegate_id);

do $$
declare t text;
begin
  foreach t in array array['tp_delegate_meetings'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated, public', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;
