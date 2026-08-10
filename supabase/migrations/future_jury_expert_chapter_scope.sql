-- Yi-Future: give jury and experts a real chapter binding.
--
-- Context (2026-08-10): the Erode co-chair opened /yi-future/chapter/jury and
-- saw all 9 jury members on the platform — Sivakasi's panel — including their
-- 6-character ACCESS CODES, which are the credential a jury member uses to
-- sign in and submit scores. Every chapter admin could read every other
-- chapter's jury codes.
--
-- Root cause: future.jury_assignments has no chapter_id. The listing tried to
-- scope with a filter on a nested embed:
--
--     .eq("jury_team_assignments.teams.chapter_id", chapterId)
--
-- In PostgREST a filter on an embedded resource that is not !inner trims the
-- EMBEDDED rows, never the parent. So every jury row came back, each with an
-- empty assignments array, and the page rendered all of them.
--
-- Deriving the chapter through the team chain also could not work for a jury
-- that has no team yet: /yi-future/chapter/jury/new creates with eventId null,
-- so a freshly added jury had no chapter binding at all. A column is the fix.
--
-- Applied to production 2026-08-10 via the Management API.

alter table future.jury_assignments
  add column if not exists chapter_id uuid references yi.chapters(id);

alter table future.experts
  add column if not exists chapter_id uuid references yi.chapters(id);

-- ─── Backfill jury ───────────────────────────────────────────────────
-- 1) From the event the jury was created against, where there is one.
update future.jury_assignments ja
   set chapter_id = e.chapter_id
  from future.events e
 where e.id = ja.event_id
   and ja.chapter_id is null
   and e.chapter_id is not null;

-- 2) Otherwise from team assignments, but ONLY where every assigned team
--    belongs to the same chapter. A jury spanning two chapters is left NULL
--    for a human to resolve rather than being guessed at.
update future.jury_assignments ja
   set chapter_id = s.chapter_id
  from (
    -- (array_agg(distinct …))[1] rather than min(): Postgres has no min(uuid).
    -- The HAVING below guarantees the array holds exactly one element.
    select jta.jury_id, (array_agg(distinct t.chapter_id))[1] as chapter_id
      from future.jury_team_assignments jta
      join future.teams t on t.id = jta.team_id
     where t.chapter_id is not null
     group by jta.jury_id
    having count(distinct t.chapter_id) = 1
  ) s
 where s.jury_id = ja.id
   and ja.chapter_id is null;

-- ─── Experts are deliberately NOT backfilled ─────────────────────────
-- Measured 2026-08-10: none of the 9 experts is attached to a phase_event, so
-- there is no evidence anywhere of which chapter owns any of them. Guessing
-- would be wrong, and scoping them strictly would empty the roster for every
-- chapter at once.
--
-- chapter_id therefore stays NULL for those rows and NULL means "shared pool"
-- — visible to every chapter, exactly as today. Newly created experts are
-- stamped with the creating chapter, so the shared set shrinks over time
-- instead of the feature breaking in one step. Attributing the existing 9 is
-- a data decision for the national team, not something a migration can infer.

create index if not exists idx_jury_assignments_chapter
  on future.jury_assignments (chapter_id, edition_id);

create index if not exists idx_experts_chapter
  on future.experts (chapter_id, edition_id);
