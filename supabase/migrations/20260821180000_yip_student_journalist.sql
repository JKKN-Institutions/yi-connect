-- ═══════════════════════════════════════════════════════════════════
-- YIP Student Journalist — self-nomination + the news-report post
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- Adds a FOURTH self-nominable role and a FOURTH questionnaire post, both
-- keyed 'parliamentary_journalist'. That value already exists in the
-- public.parliament_role enum (it is one of the two OFFICIAL_DUTY_ROLES in
-- lib/yip/constants.ts, alongside parliamentary_administrator), so there is
-- NO enum change here — only the text[] / text CHECK constraints that
-- deliberately narrow those enum members down to the self-nominable set.
--
-- Two differences from the three existing posts, both Director decisions on
-- 2026-08-21 and both encoded in lib/yip/questionnaire.ts:
--
--   • The bank holds ONE prompt, not twenty. Selection is on a single written
--     news report, so questionsPerAttempt = 1 and the "draw" is that prompt.
--   • The window is 60 minutes, not the flat 30. QuestionnairePostDef now
--     carries attemptMinutes per post; the three original posts keep 30.
--
-- Everything else — windows, attempts, answers, the uniform per-window
-- deadline, advisory scoring, the organiser's results table and CSV — is the
-- existing machinery unchanged.
--
-- The report brief is seeded as a NATIONAL row (event_id is null) so every
-- chapter gets it without setup. A chapter that wants its own wording adds an
-- event-scoped row, which REPLACES the national set for that event exactly as
-- it does for the other three posts (see effectiveQuestions()).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Self-nomination: allow the fourth role ─────────────────────
-- Cardinality rises 3 → 4 in step with the catalogue. Array-level
-- de-duplication stays in code (normalizeSelfNominationRoles) because a
-- Postgres CHECK cannot contain a subquery.
alter table yip.self_nominations
  drop constraint if exists yip_self_nominations_roles_valid;
alter table yip.self_nominations
  add constraint yip_self_nominations_roles_valid check (
    cardinality(roles) between 1 and 4
    and roles <@ array[
      'parliamentary_administrator',
      'speaker',
      'party_leader',
      'parliamentary_journalist'
    ]::text[]
  );

-- ─── 2. Questionnaire: allow the fourth post on all three tables ───
-- questions / windows / attempts each carry their own post_key CHECK; all
-- three must widen together or a window can be opened for a post whose
-- attempts are then rejected.
alter table yip.questionnaire_questions
  drop constraint if exists yip_questionnaire_questions_post_key_check;
alter table yip.questionnaire_questions
  add constraint yip_questionnaire_questions_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader','parliamentary_journalist')
  );

alter table yip.questionnaire_windows
  drop constraint if exists yip_questionnaire_windows_post_key_check;
alter table yip.questionnaire_windows
  add constraint yip_questionnaire_windows_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader','parliamentary_journalist')
  );

alter table yip.questionnaire_attempts
  drop constraint if exists yip_questionnaire_attempts_post_key_check;
alter table yip.questionnaire_attempts
  add constraint yip_questionnaire_attempts_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader','parliamentary_journalist')
  );

-- ─── 3. Seed the national report brief ─────────────────────────────
-- One prompt. It carries the topic AND the milestone list, because the
-- candidate is judged on writing rather than recall — everyone must start
-- from the same facts (Director, 2026-08-21).
--
-- ⚠️ CONFIRM THE MILESTONE DATES against the chapter's real schedule before
-- opening this window. They are drafted from the YiP 2026 questionnaire
-- documents; a wrong date is unfair to every candidate. A chapter can
-- override by inserting its own event-scoped row for this post.
insert into yip.questionnaire_questions (event_id, post_key, body, display_order)
select v.event_id, v.post_key, v.body, v.display_order
from (values (
  null::uuid,
  'parliamentary_journalist'::text,
  E'Write a news report on the pre-event work of the YiP 2026 Regional Round — everything that happened from the first nominations up to Government Formation.\n\nAim for 300–500 words. Everyone is given the same facts below; use them, and add any real detail you witnessed yourself.\n\n1. Self-Nomination (Administrator / Speaker / Party Leader) — Members put their names forward for the first set of House roles.\n2. Party allocation & committees — Members were allotted their parties, constituencies and committees.\n3. Party Leader candidate videos — candidates posted 90-second pitches so the whole House could watch before voting.\n4. Party Leader election — each party chose its Leader, who then represented it in coalition talks.\n5. Coalition talks & Government Formation — held entirely online; parties negotiated until a Government and an Opposition emerged.\n6. Government declared and the Prime Minister named.\n7. PM & Leader of Opposition campaigning — through the Party Leaders'' network rather than individual candidate campaigns.'::text,
  1::int
)) as v(event_id, post_key, body, display_order)
where not exists (
  select 1 from yip.questionnaire_questions q
  where q.event_id is null and q.post_key = 'parliamentary_journalist'
);
