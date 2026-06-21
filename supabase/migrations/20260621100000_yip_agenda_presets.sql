-- Chapter agenda presets (Phase 3): a chapter saves several NAMED agendas and
-- reuses them on future events. Snapshot (frozen) — central template changes
-- never touch a saved preset. RLS on with NO policies + anon/authenticated
-- revoked: only the service client (behind a getYipEventAccess capability gate)
-- can read/write. Applied to live 2026-06-21 before the code deploy.
create table if not exists yip.agenda_presets (
  id uuid primary key default gen_random_uuid(),
  chapter_name text not null,
  yi_chapter_id uuid,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_name, name)
);
alter table yip.agenda_presets enable row level security;
revoke all on yip.agenda_presets from anon, authenticated;
