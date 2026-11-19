-- Yi Erode Enablers of Change (EC) 2027: member Expression of Interest (EOI)
-- Add-only: three new tables + one function in yi_connect. (Admin access uses Yi Connect
-- logins via yi_directory.role_assignments; see lib/ec-eoi/access-rule.ts.) Nothing existing changes.
-- All access goes through the server with the service role. Members and the
-- browser never read these tables directly (RLS on, no policies, grants revoked).

create table if not exists yi_connect.ec_eoi_settings (
  key text primary key,
  is_open boolean not null default false,  -- member form stays CLOSED until the Director says open
  updated_at timestamptz not null default now()
);
insert into yi_connect.ec_eoi_settings (key, is_open) values ('ec-2027', false)
on conflict (key) do nothing;

create table if not exists yi_connect.ec_eoi_applications (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,             -- one per form attempt: a retried submit never makes a second row
  submitted_at timestamptz not null default now(),
  team_year text not null default '2027',
  member_name text not null check (char_length(member_name) between 2 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),   -- 10 digits as text; shown with +91
  acknowledged boolean not null check (acknowledged),
  commitment_version text not null,
  role_ids text[] not null check (cardinality(role_ids) between 1 and 3)
);
create index if not exists ec_eoi_applications_phone_idx on yi_connect.ec_eoi_applications (phone, submitted_at);

create table if not exists yi_connect.ec_eoi_proposals (
  application_id uuid not null references yi_connect.ec_eoi_applications (id) on delete cascade,
  role_id text not null check (role_id ~ '^vertical-([0-9]|1[0-3])$'),  -- stable ids, see lib/ec-eoi/catalog.ts
  response text not null check (char_length(response) between 1 and 3000),
  primary key (application_id, role_id)
);

do $$
declare t text;
begin
  foreach t in array array['ec_eoi_settings','ec_eoi_applications','ec_eoi_proposals'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;

-- Saves one EOI and its proposals in a single transaction. If the same
-- request_key arrives again (a retry), returns the first save instead.
create or replace function yi_connect.ec_eoi_submit(p jsonb)
returns table (id uuid, submitted_at timestamptz, duplicate boolean)
language plpgsql
security invoker
set search_path = yi_connect, pg_temp
as $$
declare
  v_id uuid;
  v_at timestamptz;
  v_roles text[];
begin
  select array_agg(s->>'roleId') into v_roles from jsonb_array_elements(p->'selections') s;

  insert into yi_connect.ec_eoi_applications as a
    (request_key, team_year, member_name, phone, acknowledged, commitment_version, role_ids)
  values ((p->>'requestKey')::uuid, p->>'teamYear', p->>'name', p->>'phone', true, p->>'commitmentVersion', v_roles)
  on conflict (request_key) do nothing
  returning a.id, a.submitted_at into v_id, v_at;

  if v_id is null then
    select a.id, a.submitted_at into v_id, v_at from yi_connect.ec_eoi_applications a where a.request_key = (p->>'requestKey')::uuid;
    return query select v_id, v_at, true;
    return;
  end if;

  insert into yi_connect.ec_eoi_proposals (application_id, role_id, response)
  select v_id, s->>'roleId', s->>'answer' from jsonb_array_elements(p->'selections') s;

  return query select v_id, v_at, false;
end $$;
revoke all on function yi_connect.ec_eoi_submit(jsonb) from public, anon, authenticated;
grant execute on function yi_connect.ec_eoi_submit(jsonb) to service_role;
