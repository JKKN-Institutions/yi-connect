-- Take Pride 2026: Catalyst member / standard price, partner team scanners,
-- and partner cancellations.
--
-- ADDITIVE ONLY. Same access model as take_pride_01: the new table has RLS
-- ENABLED with ZERO policies; only the service client reads or writes it,
-- behind a partner's (or team member's) secret link or the organiser gate.
--
-- 1. tp_partners.member_person_id: the yi_directory.people id the sign-up
--    matched (by email, or by the last 10 digits of the mobile). Set => the
--    member price; null => the standard price. No foreign key on purpose:
--    yi_directory is the mother source and this app never constrains it.
-- 2. tp_partners.cancelled_at / cancel_note / refund_decision: an organiser
--    cancels a partner case by case. A cancelled partner frees the seat, and
--    loses meeting requests and lead scanning. status is left as it was, so
--    the record of what was paid stays readable.
-- 3. tp_partner_team: up to 2 extra people per confirmed partner who may scan
--    leads with their own secret link (3 scanners including the owner). The
--    cap is enforced by the app. Removing a member sets active = false.
-- 4. tp_leads.scanned_by_team_id: which team member scanned the lead (null =
--    the partner owner).
-- 5. tp_partners.member_match: HOW the member check matched ('email' or
--    'phone'), so an organiser can check the match on the desk before
--    confirming a member-price payment.
-- 6. tp_signup_attempts: one row per Catalyst sign-up attempt (a SHA-256 hash
--    of the caller's IP, never the raw IP) so the public form can be rate
--    limited per network and platform-wide.

alter table yi_connect.tp_partners
  add column if not exists member_person_id uuid,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_note text check (cancel_note is null or char_length(cancel_note) <= 500),
  add column if not exists refund_decision text check (refund_decision is null or refund_decision in ('refund_due', 'no_refund', 'credit')),
  add column if not exists member_match text check (member_match is null or member_match in ('email', 'phone'));

create table if not exists yi_connect.tp_partner_team (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references yi_connect.tp_partners(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tp_partner_team_partner_idx on yi_connect.tp_partner_team (partner_id);

alter table yi_connect.tp_leads
  add column if not exists scanned_by_team_id uuid references yi_connect.tp_partner_team(id) on delete set null;

create index if not exists tp_leads_scanned_by_team_idx
  on yi_connect.tp_leads (scanned_by_team_id)
  where scanned_by_team_id is not null;

alter table yi_connect.tp_partner_team enable row level security;
revoke all on yi_connect.tp_partner_team from anon, authenticated, public;
grant all on yi_connect.tp_partner_team to service_role;

create table if not exists yi_connect.tp_signup_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists tp_signup_attempts_created_idx on yi_connect.tp_signup_attempts (created_at);
create index if not exists tp_signup_attempts_ip_idx on yi_connect.tp_signup_attempts (ip_hash, created_at);

alter table yi_connect.tp_signup_attempts enable row level security;
revoke all on yi_connect.tp_signup_attempts from anon, authenticated, public;
grant all on yi_connect.tp_signup_attempts to service_role;

notify pgrst, 'reload schema';
