-- =====================================================================
-- YIQ — rebuild the papers that yiq_03 built before pools existed.
--
-- yiq_03 attached EVERY active MCQ to BOTH the practice paper and the
-- Final Online Round paper, because at that point the bank held only the
-- 33 sample questions from the deck and there was no pool column.
--
-- yiq_04 then correctly moved those 33 to pool='practice' (they ship in
-- the deck that circulates to chapters and schools, so their answers are
-- already public) and added 195 pool='competition' questions.
--
-- Adding the column did NOT un-attach anything. So right now the Final
-- Online Round paper still points at 33 practice questions — every team
-- that read the deck would sit a paper they have already seen. This
-- migration repoints each paper at its eligible pool.
--
-- Mirrors lib/yiq/question-pools.ts: mock draws practice+either; every
-- scored paper draws competition+either and NEVER practice.
-- =====================================================================

-- 1. Drop the wrongly-attached questions from every SCORED paper.
--    Practice papers keep theirs — practice questions are what they want.
delete from yiq.paper_questions pq
using yiq.papers p, yiq.questions q
where pq.paper_id = p.id
  and pq.question_id = q.id
  and p.paper_kind <> 'mock'
  and q.pool = 'practice';

-- 2. Repopulate each scored paper from its eligible pool, evenly across
--    topics so no paper is lopsided. Ordered by topic then age.
insert into yiq.paper_questions (paper_id, question_id, display_order)
select p.id, q.id,
       row_number() over (partition by p.id order by t.display_order, q.created_at)
from yiq.papers p
join yiq.questions q
  on q.is_active = true
 and q.is_retired = false
 and q.question_type = 'mcq'
 and q.category in (p.category, 'both')
 and q.pool in ('competition', 'either')
join yiq.topics t on t.id = q.topic_id
where p.paper_kind <> 'mock'
  and not exists (
    select 1 from yiq.paper_questions pq
    where pq.paper_id = p.id and pq.question_id = q.id
  );

-- 3. Keep the denormalised count honest.
update yiq.papers p
set total_questions = (
  select count(*) from yiq.paper_questions pq where pq.paper_id = p.id
);

-- 4. Assert the leak is closed. Raises if ANY scored paper still holds a
--    practice question — a failed assertion here means step 1 or 2 is
--    wrong, and it is far better to fail the migration than to ship a
--    round whose answers are public.
do $do$
declare leaked integer;
begin
  select count(*) into leaked
  from yiq.paper_questions pq
  join yiq.papers p on p.id = pq.paper_id
  join yiq.questions q on q.id = pq.question_id
  where p.paper_kind <> 'mock' and q.pool = 'practice';

  if leaked > 0 then
    raise exception 'YIQ pool leak: % practice question(s) still attached to scored papers', leaked;
  end if;
  raise notice 'YIQ pool check clean: no practice questions on any scored paper';
end;
$do$;
