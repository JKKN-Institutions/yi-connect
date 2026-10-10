-- Take Pride 2026 app: Catalyst Partner flow + delegate pass.
--
-- Lives in yi_connect (already exposed to PostgREST). RLS ENABLED with ZERO
-- policies: only the service client reads or writes, behind the gates in
-- lib/take-pride/*. Access is by secret link token (partner, delegate) or by
-- the organiser gate (yi_directory roles), never by a public grant.
--
-- Delegates are SAMPLE rows until the real list arrives from myCII
-- (is_sample = true). Nothing here touches yi_directory.

create table if not exists yi_connect.tp_settings (
  id smallint primary key default 1 check (id = 1),
  member_fee_inr integer not null default 300000,
  standard_fee_inr integer not null default 500000,
  gst_pct numeric not null default 18,
  catalyst_seats integer not null default 40,
  meeting_cap integer not null default 25,
  payment_instructions text,
  updated_at timestamptz not null default now()
);
insert into yi_connect.tp_settings (id) values (1) on conflict (id) do nothing;

create table if not exists yi_connect.tp_delegates (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  badge_code text not null unique,
  full_name text not null,
  chapter text not null,
  zone text not null,
  business_name text,
  industry text not null,
  role_title text,
  needs text[] not null default '{}',
  offers text[] not null default '{}',
  partner_meetings_opt_in boolean not null default true,
  checked_in_at timestamptz,
  checked_in_by uuid,
  is_sample boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists yi_connect.tp_partners (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  member_name text not null,
  email text not null,
  phone text not null,
  chapter text not null,
  zone text,
  business_name text not null,
  industry text not null,
  offers text[] not null default '{}',
  wants_industries text[] not null default '{}',
  pitch text,
  tier text not null default 'member' check (tier in ('member', 'standard')),
  amount_due_inr integer not null,
  status text not null default 'applied'
    check (status in ('applied', 'payment_submitted', 'confirmed', 'rejected')),
  payment_reference text,
  payment_submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid,
  reject_reason text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists yi_connect.tp_meetings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references yi_connect.tp_partners(id) on delete cascade,
  delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined')),
  slot text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (partner_id, delegate_id)
);

create table if not exists yi_connect.tp_leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references yi_connect.tp_partners(id) on delete cascade,
  delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (partner_id, delegate_id)
);

create table if not exists yi_connect.tp_agenda (
  id uuid primary key default gen_random_uuid(),
  day smallint not null check (day in (1, 2)),
  starts_at text not null,
  title text not null,
  hall text not null,
  kind text not null default 'session',
  sort_order integer not null default 0,
  is_sample boolean not null default true
);

create index if not exists tp_meetings_delegate_idx on yi_connect.tp_meetings (delegate_id);
create index if not exists tp_leads_partner_idx on yi_connect.tp_leads (partner_id);

do $$
declare t text;
begin
  foreach t in array array['tp_settings','tp_delegates','tp_partners','tp_meetings','tp_leads','tp_agenda'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated, public', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;
