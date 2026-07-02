-- yip.projector_moments — director-curated AI moments for the venue projector.
--
-- Flow: the control panel enqueues a projector_* ai_drafts request → the
-- out-of-band routine generates it (pending_review) → the DIRECTOR reviews on
-- the control panel and taps "Project" → the server copies the approved
-- content into THIS table (status='projected') → the anon projector kiosk
-- polls it and renders the scene. Nothing AI-generated ever reaches the big
-- screen without that human tap.
--
-- Anon read is scoped to status='projected' ONLY — the projector is an
-- unauthenticated kiosk (same model as the 20260615190000 projector anon-read
-- policies). Writes happen exclusively through the service client (server
-- actions gated by getYipEventAccess.canManage); no anon/authenticated write
-- policy exists.
--
-- payload shape (jsonb, built SERVER-SIDE — for kind='projector_quotes' the
-- quote text is copied verbatim from yip.questions by the server, never from
-- model output, so quotes are verbatim BY CONSTRUCTION):
--   { "title": string, "subtitle": string|null,
--     "lines": string[] | null,                     -- text scenes
--     "quotes": [{ "text","name","constituency","ministry" }] | null }

create table if not exists yip.projector_moments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references yip.events(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'projected', -- 'projected' | 'retired'
  source_draft_id uuid null,
  is_mock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projector_moments_event_status_idx
  on yip.projector_moments (event_id, status);

alter table yip.projector_moments enable row level security;

-- The venue projector (anon kiosk) may see ONLY currently-projected rows.
grant select on yip.projector_moments to anon;
create policy yip_projector_moments_read_anon on yip.projector_moments
  for select to anon using (status = 'projected');

-- Signed-in organiser surfaces may read all rows of the event they manage;
-- row-level scoping is enforced app-side (service client) — this policy only
-- lets the authed browser client preview projected/retired rows.
grant select on yip.projector_moments to authenticated;
create policy yip_projector_moments_read_auth on yip.projector_moments
  for select to authenticated using (true);
