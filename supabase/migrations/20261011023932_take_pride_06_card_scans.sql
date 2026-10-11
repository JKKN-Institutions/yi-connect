-- Take Pride 2026: business-card scanner for delegates.
--
-- ADDITIVE ONLY. Two new tables, same access model as take_pride_01: RLS
-- ENABLED with ZERO policies, only the service client reads or writes,
-- behind a delegate's secret pass token or the routine's X-Cron-Secret
-- (app/take-pride/api/ai-cards/route.ts).
--
-- The production app NEVER calls an LLM. A delegate photographs a card; the
-- browser shrinks it to a small JPEG and it is stored as base64 in a
-- 'pending' tp_card_scans row (no storage bucket). The out-of-band claude.ai
-- routine claims rows (pending -> generating), reads the printed fields and
-- POSTs them back. The app validates them, creates a tp_card_contacts row and
-- DELETES the photo (image_jpeg_b64 = NULL). Failed reads and photos nobody
-- read within 24 hours lose the photo too. The CHECK below makes "a finished
-- scan holds no photo" a database rule, not just an app habit.
--
-- Contacts are PRIVATE to the delegate who scanned the card.

create table if not exists yi_connect.tp_card_scans (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  -- base64 of at most 2 MB of JPEG (4 * ceil(2097152 / 3) = 2796204 characters)
  image_jpeg_b64 text check (image_jpeg_b64 is null or char_length(image_jpeg_b64) <= 2800000),
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  constraint tp_card_scans_finished_has_no_photo
    check (status in ('pending', 'generating') or image_jpeg_b64 is null)
);

create index if not exists tp_card_scans_delegate_idx
  on yi_connect.tp_card_scans (delegate_id, created_at desc);
create index if not exists tp_card_scans_status_idx
  on yi_connect.tp_card_scans (status, created_at);

create table if not exists yi_connect.tp_card_contacts (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  scan_id uuid references yi_connect.tp_card_scans(id) on delete set null,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  title text check (title is null or char_length(title) <= 120),
  company text check (company is null or char_length(company) <= 160),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 160),
  website text check (website is null or char_length(website) <= 200),
  city text check (city is null or char_length(city) <= 80),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists tp_card_contacts_delegate_idx
  on yi_connect.tp_card_contacts (delegate_id, created_at desc);
-- One contact per scan: a repeated POST can never create a second contact.
create unique index if not exists tp_card_contacts_scan_uidx
  on yi_connect.tp_card_contacts (scan_id) where scan_id is not null;

alter table yi_connect.tp_card_scans enable row level security;
alter table yi_connect.tp_card_contacts enable row level security;
revoke all on yi_connect.tp_card_scans from anon, authenticated, public;
revoke all on yi_connect.tp_card_contacts from anon, authenticated, public;
grant all on yi_connect.tp_card_scans to service_role;
grant all on yi_connect.tp_card_contacts to service_role;
