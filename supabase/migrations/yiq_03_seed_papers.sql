-- YIQ starter papers.
--
-- ⚠️ CONTENT WARNING (flagged to the Director 2026-08-24): the bank currently
-- holds only the 33 sample questions from the deck, so the MOCK paper and the
-- ONLINE ROUND paper necessarily draw from the same pool — practising would
-- reveal the real paper. Before go-live the bank must grow and the two pools
-- must be disjoint (tag questions, or reserve a round-only set). These papers
-- exist so the flow is testable end to end now.

-- Mock papers: short, published immediately, unlimited attempts.
insert into yiq.papers (edition_id, name, paper_kind, category, duration_minutes,
  total_questions, marks_per_question, negative_marks, is_published, published_at,
  instructions)
select e.id, 'YIQ Practice — ' || c.label, 'mock', c.cat, 10, 0, 1, 0, true, now(),
  'Practice run. Your score here never counts towards your team.'
from yiq.editions e
cross join (values ('junior','Junior'),('senior','Senior')) as c(cat,label)
where e.slug = 'yiq-2026-27'
  and not exists (
    select 1 from yiq.papers p
    where p.edition_id = e.id and p.paper_kind = 'mock' and p.category = c.cat
  );

-- Online round papers: the real thing. Published so a chapter can go live.
insert into yiq.papers (edition_id, name, paper_kind, category, duration_minutes,
  total_questions, marks_per_question, negative_marks, is_published, published_at,
  instructions)
select e.id, 'Final Online Round 2026 — ' || c.label, 'online_round', c.cat, 30, 0, 1, 0, true, now(),
  'One attempt only. The clock starts when you begin and does not pause.'
from yiq.editions e
cross join (values ('junior','Junior'),('senior','Senior')) as c(cat,label)
where e.slug = 'yiq-2026-27'
  and not exists (
    select 1 from yiq.papers p
    where p.edition_id = e.id and p.paper_kind = 'online_round' and p.category = c.cat
  );

-- Attach every active MCQ to each paper, ordered by topic so the draw is even.
insert into yiq.paper_questions (paper_id, question_id, display_order)
select p.id, q.id,
       row_number() over (partition by p.id order by t.display_order, q.created_at)
from yiq.papers p
join yiq.questions q
  on q.is_active = true and q.is_retired = false and q.question_type = 'mcq'
 and q.category in (p.category, 'both')
join yiq.topics t on t.id = q.topic_id
where not exists (
  select 1 from yiq.paper_questions pq
  where pq.paper_id = p.id and pq.question_id = q.id
);

update yiq.papers p
set total_questions = (
  select count(*) from yiq.paper_questions pq where pq.paper_id = p.id
);
