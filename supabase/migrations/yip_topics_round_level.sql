-- Committee topics that can differ by ROUND LEVEL (chapter / regional / national).
--
-- THE PROBLEM
-- yip.topics is the whole YIP topic catalogue, and it has no level dimension.
-- A regional round therefore has to debate the same committee topics a chapter
-- round debates, because there is only one committee list and no way to say
-- "this one is for the regional round". The six regional events created so far
-- carry ZERO topics as a result: createEvent only inherits the catalogue for
-- level = 'chapter', and there was nothing regional to inherit.
--
-- NAMING TRAP, stated once so nobody re-learns it
-- topic_category has a value 'regional', and it does NOT mean "regional round".
-- It means ZONE-SPECIFIC: the 61 category='regional' rows each carry a zone
-- (SRTN 11, SRTKKA 11, WR 10, ER 10, NER 10, NR 9). Round level is an entirely
-- separate axis and is spelled `levels` — the column this migration adds. The
-- committees seeded below are category='committee', levels='{regional}': they
-- are committee topics used by the regional ROUND, at no particular zone.
--
-- THE SHAPE  (identical to yip_session_parameters_round_level.sql, on purpose)
-- `levels` is an ARRAY of the existing public.event_level enum, nullable:
--   levels IS NULL                 -> applies at EVERY level  (what all 90 rows mean today)
--   levels = '{regional}'          -> regional rounds only
--   levels = '{chapter,regional}'  -> one topic serving two levels, no duplicate row
-- Reusing public.event_level keeps ONE definition of "what a level is", shared
-- with yip.events.level, so the two cannot drift apart.
--
-- ZERO BEHAVIOUR CHANGE FOR CHAPTER ROUNDS
-- The column is added with no default and left NULL on all 90 existing rows.
-- NULL means "every level", which is precisely how those rows behave today, so
-- every chapter round resolves to exactly the catalogue it resolved to before.
-- The 15 new rows are scoped '{regional}', so they are invisible to a chapter
-- round: nothing a chapter event reads today gains or loses a single topic.
--
-- WHY THE UNIQUE KEY MOVES
-- Twelve of the fifteen regional committees share a ministry name with an
-- existing category='committee' row but carry a DIFFERENT examination question
-- (eight are byte-identical titles: Education, Women & Child Development, Youth
-- Affairs & Sports, Health & Family Welfare, MSME, Jal Shakti, Housing & Urban
-- Affairs, Finance). Two committee rows must therefore be allowed to coexist in
-- the same (category, zone) bucket at different level scopes. UNIQUE
-- (category, zone, topic_number) cannot express that once per-level renumbering
-- starts, so it is replaced by UNIQUE (category, zone, topic_number, levels)
-- NULLS NOT DISTINCT.
--
-- NULLS NOT DISTINCT is what keeps the old guarantee intact, and in one respect
-- STRENGTHENS it: the replaced constraint used the default NULLS DISTINCT, so
-- it never actually blocked two (committee, NULL, 1) rows — zone IS NULL made
-- them non-conflicting. Verified against production before writing this: zero
-- duplicate (category, zone, topic_number) groups and zero NULL topic_numbers
-- across all 90 rows, so the stricter index builds cleanly.
--
-- The new index is created BEFORE the old constraint is dropped and both run in
-- one transaction, so there is never a moment without a uniqueness guarantee.
--
-- WHAT THIS MIGRATION DOES NOT DO
-- It does not touch a single event. Attaching these committees to the six
-- existing regional events is a separate, event-specific backfill that lives in
-- the pull request body for a human to run, deliberately kept out of here so
-- this file stays re-runnable and event-agnostic.
--
-- SAFE ON A LIVE ROUND
-- Additive only: one nullable column, one CHECK, one new index, one constraint
-- swapped, and 15 INSERTs into a catalogue no running event reads yet. No column
-- is dropped, no existing row is rewritten, no NOT NULL is added, and no result
-- is recomputed. 90 rows, so the brief ACCESS EXCLUSIVE lock is instantaneous.
-- Idempotent: re-running inserts nothing and re-creates nothing.

BEGIN;

-- 1. The scope column. No DEFAULT: existing rows stay NULL = "every level".
ALTER TABLE yip.topics
  ADD COLUMN IF NOT EXISTS levels public.event_level[];

COMMENT ON COLUMN yip.topics.levels IS
  'Round levels this topic applies to. NULL = every level (the default, and how all pre-2026-08 rows behave). An event inherits topics scoped to its own level plus every NULL-scoped topic; a topic scoped to a DIFFERENT level is never offered to it. NOTE: unrelated to category=''regional'', which means zone-specific, not regional-round.';

-- 2. Shape guard: an EMPTY array would be ambiguous against NULL, so forbid it.
--    Valid values are already constrained by the enum type itself.
ALTER TABLE yip.topics
  DROP CONSTRAINT IF EXISTS topics_levels_not_empty;
ALTER TABLE yip.topics
  ADD CONSTRAINT topics_levels_not_empty
  CHECK (levels IS NULL OR array_length(levels, 1) >= 1);

-- 3. Widen the uniqueness key, new index first so no window is left unguarded.
CREATE UNIQUE INDEX IF NOT EXISTS topics_category_zone_topic_number_levels_key
  ON yip.topics (category, zone, topic_number, levels) NULLS NOT DISTINCT;

ALTER TABLE yip.topics
  DROP CONSTRAINT IF EXISTS topics_category_zone_topic_number_key;

-- 4. Seed the 15 regional-round committees.
--
--    title         = the ministry
--    description   = the topic for examination
--    linked_scheme = the linked Acts / Policies / Schemes
--    zone          = NULL (committee rows never carry a zone, like central rows)
--    levels        = '{regional}'
--
--    topic_number CONTINUES past the existing committee rows (currently 1..19,
--    so these take 20..34) rather than restarting at 1. The widened key would
--    permit restarting, but continuing keeps the number a stable global
--    identity — bills and scores join committees by NUMBER, so two committees
--    numbered 1 that differ only by an invisible scope would be a data error.
--
--    Idempotent: the NOT EXISTS guard keys on (category, levels, title), which
--    is the identity a re-run would duplicate. The base number is read inside
--    the statement, so a re-run after an unrelated committee insert still lands
--    above whatever is there.
WITH base AS (
  SELECT COALESCE(MAX(topic_number), 0) AS n
  FROM yip.topics
  WHERE category = 'committee'
),
seed (ord, title, description, linked_scheme) AS (
  VALUES
    (1, 'Ministry of Education',
        'Is India''s education system adequately preparing students for life, employment and entrepreneurship in a rapidly changing economy?',
        'National Education Policy 2020, PM SHRI'),
    (2, 'Ministry of Women & Child Development',
        'How can India strengthen prevention, early identification, and reporting of child sexual abuse while creating safer physical and digital spaces for children?',
        'POCSO Act, 2012; Mission Vatsalya'),
    (3, 'Ministry of Youth Affairs & Sports',
        'How can India make sports and physical fitness an integral part of everyday life for children and youth rather than limiting sports development to competitive athletes?',
        'Khelo India, Fit India Movement'),
    (4, 'Ministry of Health & Family Welfare',
        'Can India shift from treating illness to preventing it by creating a stronger culture of nutrition, fitness, preventative screening, and mental well-being?',
        'Ayushman Bharat; Ayushman Arogya Mandir'),
    (5, 'Ministry of Social Justice & Empowerment',
        'How accessible are India''s schools, colleges, workspaces, transport systems, and digital platforms for persons with disabilities, and what prevents true inclusion?',
        'Rights of Persons with Disabilities Act, 2016; Accessible India Campaign'),
    (6, 'Ministry of Road Transport & Highways',
        'Why does India continue to experience high road fatalities despite stronger laws, and how can technology, infrastructure, vehicle design, and behavioural change make Indian roads safer?',
        'Motor Vehicles Act; National Road Safety Framework'),
    (7, 'Ministry of Rural Development',
        'How can rural India create sufficient opportunities for its youth so that migration to cities becomes a choice rather than an economic necessity?',
        'Deendayal Antyodaya Yojana – National Rural Livelihoods Mission; Deendayal Upadhyaya Grameen Kaushalya Yojana'),
    (8, 'Ministry of Science & Technology',
        'How can India convert innovations developed by students and youth into scalable solutions to real problems faced by society?',
        'Innovation in Science Pursuit for Inspired Research – Million Minds Augmenting National Aspirations (INSPIRE-MANAK); National Innovation Initiatives'),
    (9, 'Ministry of MSME',
        'What prevents young Indians from choosing entrepreneurship as confidently as conventional employment, and how can first-generation entrepreneurs be better supported?',
        'Prime Minister''s Employment Generation Programme (PMEGP); Micro, Small and Medium Enterprises Development (MSMED) Act, 2006'),
    (10, 'Ministry of Environment, Forest, & Climate Change',
        'How can young citizens and communities contribute meaningfully to India''s climate preparedness while balancing environmental responsibility with development?',
        'Mission LiFE, National Action Plan on Climate Change'),
    (11, 'Ministry of Skill Development & Entrepreneurship',
        'Why does a gap continue to exist between education, skills, and employability, and how can India''s youth be prepared for jobs that may not even exist today?',
        'Pradhan Mantri Kaushal Vikas Yojana (PMKVY); National Apprenticeship Promotion Scheme (NAPS); Skill India Mission'),
    (12, 'Ministry of Electronics & Information Technology',
        'How can India protect children and young adults from cyber crime, misinformation, deepfakes, online abuse, and digital addiction without restricting benefits of an open internet?',
        'Digital Personal Data Protection Act, 2023; Information Technology Act, 2000'),
    (13, 'Ministry of Jal Shakti',
        'Can India''s young citizens and communities materially change the country''s growing water-security challenge through conservation, reuse, and responsible consumption?',
        'Jal Jeevan Mission; Atal Bhujal Yojana; Jal Shakti Abhiyan'),
    (14, 'Ministry of Housing & Urban Affairs',
        'Are Indian cities being designed for people – particularly children, senior citizens, and Persons with Disabilities – or primarily for vehicles and buildings?',
        'Smart Cities Mission; Atal Mission for Rejuvenation and Urban Transformation 2.0 (AMRUT 2.0); Accessible India Campaign (Sugamya Bharat Abhiyan)'),
    (15, 'Ministry of Finance',
        'Are easy loans, digital credit, and poor financial literacy putting young Indians and families at financial risk? And how can India build a stronger culture of saving and responsible borrowing?',
        'Pradhan Mantri Jan-Dhan Yojana (PMJDY); Reserve Bank of India''s Digital Lending Guidelines/Regulatory Framework')
)
INSERT INTO yip.topics
  (category, zone, topic_number, title, description, sub_points, handbook_page, linked_scheme, is_active, levels)
SELECT
  'committee'::public.topic_category,
  NULL,
  base.n + seed.ord,
  seed.title,
  seed.description,
  '[]'::jsonb,
  NULL,
  seed.linked_scheme,
  true,
  ARRAY['regional']::public.event_level[]
FROM seed CROSS JOIN base
WHERE NOT EXISTS (
  SELECT 1
  FROM yip.topics t
  WHERE t.category = 'committee'
    AND t.levels = ARRAY['regional']::public.event_level[]
    AND t.title = seed.title
);

COMMIT;
