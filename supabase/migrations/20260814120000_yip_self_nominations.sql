-- ═══════════════════════════════════════════════════════════════════
-- YIP Self-Nomination — students put themselves forward, pre-event
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- Before the organiser runs the real elections, students nominate THEMSELVES
-- for one or more of three roles from their own phone (typically days before
-- event day). This is a LIST THE ORGANISER READS — it does NOT feed
-- vote_sessions.config.candidateIds and does not change any election path.
-- The organiser still hand-picks ballot candidates exactly as today.
--
-- Two objects:
--
--   yip.self_nominations        — one row per (event, student). The student
--                                 edits their selection IN PLACE while the
--                                 window is open (upsert on the unique index),
--                                 so there is never more than one row each.
--   yip.events.self_nomination_open
--                               — the per-event admin toggle that opens and
--                                 closes the window. Explicit switch ONLY:
--                                 there is deliberately no opens_at/closes_at
--                                 and no auto-close (Director, 2026-08-14).
--                                 Same shape as speaking_placard_enabled
--                                 (20260704093000), default OFF so no running
--                                 chapter round changes behaviour on deploy.
--
-- `roles` stores the parliament_role ENUM VALUES verbatim ('speaker',
-- 'party_leader', 'parliamentary_administrator') rather than UI labels, so the
-- organiser's downstream role assignment needs no translation table. It is a
-- text[] and NOT parliament_role[]: the column must accept only these three of
-- the 22 enum members, and a CHECK on text[] states that restriction plainly.
--
-- FK on participant_id — DIFFERENT from yip.score_revisions / yip.formation_*,
-- which deliberately carry no participant FK because they are append-only
-- LOGS that must outlive a participant reset. A self-nomination is not a log:
-- it is live, editable state owned by one student row, and it is meaningless
-- once that student row is gone (a re-import mints new participant ids + new
-- access codes). So it cascades — an orphaned nomination would otherwise
-- surface in the organiser's results table as a nameless ghost.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists yip.self_nominations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references yip.events(id)       on delete cascade,
  participant_id uuid not null references yip.participants(id) on delete cascade,
  roles          text[] not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One nomination per student per event — also the ON CONFLICT target the
-- submit action upserts against (a plain multi-column unique index is a valid
-- inference target; only EXPRESSION indexes are not).
create unique index if not exists yip_self_nominations_event_participant
  on yip.self_nominations (event_id, participant_id);

-- The organiser's results table is always "every nomination for one event,
-- newest first".
create index if not exists yip_self_nominations_event_created
  on yip.self_nominations (event_id, created_at desc);

-- Non-empty subset of exactly the three self-nominable roles, at most one of
-- each in practice. Postgres CHECK cannot contain a subquery, so array-level
-- DE-DUPLICATION is enforced in code (normalizeSelfNominationRoles in
-- lib/yip/self-nomination.ts) rather than here; the 1..3 cardinality bound
-- still caps any pathological input.
alter table yip.self_nominations
  drop constraint if exists yip_self_nominations_roles_valid;
alter table yip.self_nominations
  add constraint yip_self_nominations_roles_valid check (
    cardinality(roles) between 1 and 3
    and roles <@ array[
      'parliamentary_administrator',
      'speaker',
      'party_leader'
    ]::text[]
  );

-- Per-event admin toggle for the nomination window. Default FALSE: the window
-- is shut on every existing event until an organiser deliberately opens it.
alter table yip.events
  add column if not exists self_nomination_open boolean not null default false;

-- RLS posture: server-action-only (same as yip.score_revisions /
-- yip.formation_steps) — enable RLS with NO anon/authenticated policies, so
-- the table is deny-all by default. Students reach it ONLY through the
-- self-nomination server actions, which resolve identity from the httpOnly
-- yip_session cookie. This is what keeps one minor's nomination invisible to
-- every other minor even though the students share an anon key.
alter table yip.self_nominations enable row level security;

-- Mgmt-API-created tables get NO default service_role grant (hard-won memory
-- rule) — grant explicitly or every service-client read/write silently fails.
grant all on yip.self_nominations to service_role;
