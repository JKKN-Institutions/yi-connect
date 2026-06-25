-- YIP — Top-5 award candidates (contender shortlist per award).
--
-- WHY
-- The results engine now assigns ONE award per student (scarce-first cap, see
-- app/yip/actions/results.ts). The cap means a strong student's lower-priority
-- awards cascade to the next eligible contender — so the results page must SHOW
-- who the top contenders were for each award, BEFORE the cap, with the actual
-- winner(s) highlighted AFTER the cap. This table stores that per-award top-5
-- shortlist, recomputed (delete + insert for the event) every computeResults run,
-- exactly like yip.results.
--
-- ACCESS MODEL — mirrors yip.results EXACTLY (verified against the live DB
-- 2026-06-25 via the Supabase Management API):
--   • yip.results: RLS ENABLED, one SELECT policy "Results are readable"
--     USING (true) for PUBLIC, table-grant SELECT to *authenticated* only
--     (anon SELECT was revoked 2026-06-03), service_role full.
--   The net effect: anon CANNOT read (no grant), authenticated CAN read at the
--   DB level, and the APP further gates both yip.results and this table behind
--   canViewScores (national/super-admin) in the server actions (getResults /
--   getAwardCandidates), which read via the service-role client regardless.
--   We replicate that posture here so award_candidates has the SAME access model
--   as the leaderboard it accompanies — NOT anon-readable, but authenticated-
--   readable + app-gated. (New yip.* tables ship anon-readable by default; the
--   REVOKE below closes that known trap.)

create table if not exists yip.award_candidates (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references yip.events(id) on delete cascade,
  award_key      text not null,
  award_label    text not null,
  rank           smallint not null check (rank between 1 and 5),
  participant_id uuid not null references yip.participants(id) on delete cascade,
  score          numeric not null default 0,
  is_winner      boolean not null default false,
  computed_at    timestamptz not null default now()
);

create index if not exists idx_award_candidates_event
  on yip.award_candidates(event_id);
create index if not exists idx_award_candidates_event_award
  on yip.award_candidates(event_id, award_key, rank);

-- ── Access model — SERVICE-ROLE ONLY (tighter than yip.results) ─────────────
-- The app reads this table EXCLUSIVELY via the service-role client in
-- getAwardCandidates (gated by canViewScores) and writes it in computeResults —
-- it never needs PostgREST access by anon or authenticated users. So: RLS ON,
-- NO policies, and grants revoked from anon + authenticated. Only the service
-- role (which bypasses RLS) can read/write. This is the most restrictive safe
-- posture for a new yip.* table (which otherwise ship anon-readable) and is
-- intentionally tighter than yip.results' authenticated-readable grant, since
-- award contenders are pre-publication data with no client-direct read need.
alter table yip.award_candidates enable row level security;

revoke all on yip.award_candidates from anon, authenticated;

grant all on yip.award_candidates to service_role;
