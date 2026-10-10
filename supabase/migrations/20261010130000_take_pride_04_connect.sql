-- Take Pride 2026: unguessable badges + scan-to-connect + "My people".
--
-- ADDITIVE ONLY. Same access model as take_pride_01: new tables have RLS
-- ENABLED with ZERO policies; only the service client reads or writes,
-- behind a delegate's secret pass token or a partner's secret link.
--
-- 1. tp_delegates.badge_secret: 5 random characters printed after the badge
--    number ("TP26-1234-K7QXM"). A Catalyst Partner (lead capture) or a
--    delegate (scan to connect) must present it, so badge numbers can no
--    longer be guessed to harvest delegates. Alphabet leaves out 0 O 1 I L.
--    The column default fills it for any row inserted without one (including
--    the import that is live before this code ships); the UPDATE below
--    backfills every existing row. gen_random_uuid() is volatile, so each
--    row and each character draws a fresh random byte (bytes 0..3 of a v4
--    uuid are fully random).
-- 2. tp_delegates.share_contact / phone / email: a delegate's own choice to
--    swap contact details. Phone and email are shown only to a mutual
--    connection, and only when BOTH sides have share_contact = true.
-- 3. tp_connections: one row per pair of delegates who scanned each other.
--    Each side keeps a private note and follow-up date (a = scanner).
--    scanned = false: the row only holds a note for a pair who have an
--    accepted delegate meeting but never scanned each other. A later scan
--    flips it to true.
-- 4. tp_scan_attempts: every badge scan by a partner or a delegate, success
--    or failure, so the app can cap scans per hour (wrong guesses count).

alter table yi_connect.tp_delegates
  add column if not exists badge_secret text
    default (
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 31, 1) ||
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 1) % 31, 1) ||
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 2) % 31, 1) ||
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 3) % 31, 1) ||
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 31, 1)
    ),
  add column if not exists share_contact boolean not null default false,
  add column if not exists phone text,
  add column if not exists email text;

update yi_connect.tp_delegates
set badge_secret =
  substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 31, 1) ||
  substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 1) % 31, 1) ||
  substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 2) % 31, 1) ||
  substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 3) % 31, 1) ||
  substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 31, 1)
where badge_secret is null;

create table if not exists yi_connect.tp_connections (
  id uuid primary key default gen_random_uuid(),
  a_delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  b_delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  created_at timestamptz not null default now(),
  scanned boolean not null default true,
  note_a text check (note_a is null or char_length(note_a) <= 500),
  note_b text check (note_b is null or char_length(note_b) <= 500),
  follow_up_a date,
  follow_up_b date,
  check (a_delegate_id <> b_delegate_id)
);

create unique index if not exists tp_connections_pair_key
  on yi_connect.tp_connections (
    least(a_delegate_id, b_delegate_id),
    greatest(a_delegate_id, b_delegate_id)
  );
create index if not exists tp_connections_a_idx on yi_connect.tp_connections (a_delegate_id);
create index if not exists tp_connections_b_idx on yi_connect.tp_connections (b_delegate_id);

create table if not exists yi_connect.tp_scan_attempts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references yi_connect.tp_partners(id) on delete cascade,
  delegate_id uuid references yi_connect.tp_delegates(id) on delete cascade,
  ok boolean not null default false,
  created_at timestamptz not null default now(),
  check (num_nonnulls(partner_id, delegate_id) = 1)
);

create index if not exists tp_scan_attempts_partner_idx on yi_connect.tp_scan_attempts (partner_id, created_at);
create index if not exists tp_scan_attempts_delegate_idx on yi_connect.tp_scan_attempts (delegate_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['tp_connections','tp_scan_attempts'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated, public', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;
