-- ============================================================================
-- Yi-Future Announcements  (Feature #1, 2026-06-29)
-- Chapter admins announce to their own delegates (one delegate / one team /
-- whole chapter). National admins announce to everyone (all delegates of an
-- edition). Delivered in-app on the delegate dashboard; best-effort web push.
--
-- Access pattern: ALL reads/writes go through the service client (RLS-bypass),
-- gated in server actions by readSession()/requireChapterAdmin()/national gate.
-- RLS is enabled with NO policies so the anon/authenticated keys can never read
-- these rows directly (defense-in-depth) — the service role bypasses RLS.
-- ============================================================================

create table if not exists future.announcements (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid not null references future.editions(id) on delete cascade,

  -- who authored it (Supabase Auth admin)
  author_user_id uuid,
  author_name    text,
  -- 'chapter' = a chapter admin to their own delegates; 'national' = a national
  -- admin to a whole edition (optionally narrowed to one chapter).
  author_scope   text not null check (author_scope in ('chapter','national')),

  -- targeting
  -- audience: 'everyone'  -> all active delegates in edition (national only)
  --           'chapter'   -> all active delegates of chapter_id
  --           'team'      -> all members of team_id
  --           'delegate'  -> a single delegate_id
  audience       text not null check (audience in ('everyone','chapter','team','delegate')),
  -- future.chapters is a VIEW (not a table) so no FK is possible — store the id plain.
  chapter_id     uuid,
  team_id        uuid references future.teams(id) on delete cascade,
  delegate_id    uuid references future.delegates(id) on delete cascade,

  title          text not null,
  body           text not null,
  -- optional in-app CTA (a relative /yi-future/... path)
  url            text,

  created_at     timestamptz not null default now()
);

create index if not exists idx_future_announcements_edition
  on future.announcements (edition_id, created_at desc);
create index if not exists idx_future_announcements_chapter
  on future.announcements (chapter_id, created_at desc);
create index if not exists idx_future_announcements_team
  on future.announcements (team_id);
create index if not exists idx_future_announcements_delegate
  on future.announcements (delegate_id);

-- Per-delegate read receipts (drives the unread badge on the dashboard).
create table if not exists future.announcement_reads (
  announcement_id uuid not null references future.announcements(id) on delete cascade,
  delegate_id     uuid not null references future.delegates(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, delegate_id)
);

alter table future.announcements      enable row level security;
alter table future.announcement_reads enable row level security;

-- Table-level grants (same Management-API gotcha as jury_track_assignments:
-- no default service_role grants on API-created tables). Applied to prod 2026-07-04.
grant select, insert, update, delete on future.announcements to service_role;
grant select, insert, update, delete on future.announcement_reads to service_role;
