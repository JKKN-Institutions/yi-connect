-- =====================================================================
-- YIQ — two topics for the reasoning bank, and the retagging it needs.
--
-- THE MISTAKE THIS CORRECTS. The 200-question reasoning bank added on
-- 2026-08-27 filed 175 of its questions under "Science & Technology",
-- because the seven existing topics were designed for a general-knowledge
-- RECALL bank and none of them describes arithmetic, deduction or
-- geometry. Science & Technology was the least-bad fit, and "least-bad
-- fit" is how a bank ends up with 207 of its 428 questions in one topic.
--
-- WHAT THAT BROKE, in the Director's own words on seeing the admin page:
-- the bank looked lopsided, and filtering by topic — the one tool for
-- finding anything in 428 questions — returned almost everything.
--
-- What it did NOT break: paper generation already round-robins across
-- topics (app/yiq/actions/admin.ts: "Round-robin across topics so no paper
-- is lopsided towards one topic"), so no student ever sat a paper skewed
-- by this. It was a findability and honesty problem, not a scoring one.
--
-- THE DECISION (Director, 2026-08-27): add TWO topics rather than one, so
-- arithmetic and deduction are separately findable. The competition is
-- described as having 7 topics, but that number is COUNTED LIVE from this
-- table (app/yiq/page.tsx reads a count, nothing is hardcoded), so the
-- landing page will simply say 9.
--
-- HOW THE 175 ARE SPLIT. By section, because the sections were written to
-- be coherent, with one exception that had to be classified by hand:
--
--   BRAIN SPRINT       -> Numbers & Patterns   (arithmetic, sequences, %)
--   VISUAL DETECTIVE   -> Numbers & Patterns   (geometry, counting, symmetry)
--   LOGIC LAB          -> Logic & Reasoning    (deduction, classic puzzles)
--   THE FINAL CHALLENGE-> SPLIT BY HAND: the eleven questions about
--                         evidence, causation and sampling go to Logic &
--                         Reasoning; the probability and arithmetic ones
--                         go to Numbers & Patterns.
--   DON'T GOOGLE THIS  -> STAYS Science & Technology. Everyday physics is
--                         genuinely science and was never mis-filed.
--   CONNECT THE CLUES  -> STAYS wherever it is. Those were filed per
--                         question from the start (Boyle's law in science,
--                         opportunity cost in economics, the Tropic of
--                         Cancer in India) and are correct already.
--
-- IDEMPOTENT: re-running inserts nothing new and moves nothing twice.
-- =====================================================================

insert into yiq.topics (slug, name, description, display_order, is_active)
values
  ('numbers-patterns', 'Numbers & Patterns',
   'Arithmetic, proportion, sequences, geometry and probability — questions answered by working something out rather than recalling it.',
   8, true),
  ('logic-reasoning', 'Logic & Reasoning',
   'Deduction, evidence, causation and sampling — questions about what does and does not follow.',
   9, true)
on conflict (slug) do nothing;

do $do$
declare
  t_numbers uuid;
  t_logic   uuid;
  t_sci     uuid;
  moved_n   integer;
  moved_l   integer;
begin
  select id into t_numbers from yiq.topics where slug = 'numbers-patterns';
  select id into t_logic   from yiq.topics where slug = 'logic-reasoning';
  select id into t_sci     from yiq.topics where slug = 'science-technology';

  if t_numbers is null or t_logic is null or t_sci is null then
    raise exception 'YIQ: a required topic is missing — refusing to retag.';
  end if;

  -- ── Whole sections, unambiguous ────────────────────────────────────
  update yiq.questions
     set topic_id = t_numbers
   where topic_id = t_sci
     and (source like '%BRAIN SPRINT%' or source like '%VISUAL DETECTIVE%');

  update yiq.questions
     set topic_id = t_logic
   where topic_id = t_sci
     and source like '%LOGIC LAB%';

  -- ── THE FINAL CHALLENGE, classified by hand ────────────────────────
  -- These eleven are about judging evidence, not about calculating. They
  -- are matched on a distinctive opening rather than on an id, so this
  -- migration is readable and reviewable by a person.
  update yiq.questions
     set topic_id = t_logic
   where topic_id = t_sci
     and source like '%FINAL CHALLENGE%'
     and (
          question_text like '"If it rained%'
       or question_text like 'A disease affects 1 person in 10,000%'
       or question_text like 'A study finds students who eat breakfast%'
       or question_text like 'An advertisement states%'
       or question_text like 'Ice cream sales and drowning deaths%'
       or question_text like 'To gauge the whole school%'
       or question_text like 'To learn how many people in a town%'
       or question_text like 'Umbrella sales rise when traffic slows%'
       or question_text like 'What is the best evidence that a new study method%'
       or question_text like 'Which is the stronger evidence that a medicine works%'
     );

  -- Everything still left from that section is arithmetic or probability.
  update yiq.questions
     set topic_id = t_numbers
   where topic_id = t_sci
     and source like '%FINAL CHALLENGE%';

  select count(*) into moved_n from yiq.questions where topic_id = t_numbers;
  select count(*) into moved_l from yiq.questions where topic_id = t_logic;
  raise notice 'YIQ retag: Numbers & Patterns now %, Logic & Reasoning now %.',
    moved_n, moved_l;

  -- A guard, not decoration. If Science & Technology is still carrying
  -- more than a third of the bank the split did not do its job, and a
  -- human should look before this is called done.
  if (select count(*) from yiq.questions where topic_id = t_sci)
     > (select count(*) from yiq.questions) / 3 then
    raise exception
      'YIQ: Science & Technology still holds more than a third of the bank after retagging — the split did not work.';
  end if;
end
$do$;
