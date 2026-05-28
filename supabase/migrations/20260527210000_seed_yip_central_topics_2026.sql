-- ============================================================================
-- Seed: YIP Central Topics 2026 (Phase 18 demo readiness, Mizoram June 4-5)
-- ============================================================================
-- This file DOCUMENTS the seed that was applied via the Supabase Management
-- API on 2026-05-27. The rows were written directly to production
-- (project ref: bkmpbcoxbjyafieabxao) using POST /v1/projects/<ref>/database/query
-- because `supabase db push --linked` would not accept this as a forward
-- migration after the existing 10 legacy central topics were already in prod
-- since 2026-04-18.
--
-- Re-running this script is IDEMPOTENT:
--   * legacy rows with title NOT IN the new-20 set get deactivated +
--     shifted to negative topic_number slots to free 1..20
--   * the INSERT skips any new-20 title that already exists in yip.topics
--
-- What changed in production:
--   * 10 legacy central topics (topic_number 1..10, generic theme titles like
--     "Education Reform & Skill-Based Learning") were renumbered to -1..-10
--     and set is_active=false. They remain in the table for historical
--     reference and to preserve event_topics FK integrity (1 event still
--     points at the old topic_number=1 row).
--   * 20 new ministry-mapped topics installed at topic_number 1..20, with
--     description = "Ministry: <name>" and sub_points = ["<linked policy>"].
--   * All 20 are is_active=true, category='central', zone=NULL.
--
-- Verification after apply:
--   SELECT topic_number, title FROM yip.topics
--    WHERE category='central' AND is_active=true ORDER BY topic_number;
--   -- expects exactly 20 rows numbered 1..20
-- ============================================================================

BEGIN;

-- Step 1: Deactivate + renumber any legacy central rows occupying slots 1..20
-- whose title is NOT one of the new 20 (this excludes idempotent re-runs).
UPDATE yip.topics t
SET is_active = false,
    topic_number = CASE WHEN t.topic_number > 0 THEN -1 * t.topic_number ELSE t.topic_number END
WHERE t.category = 'central'
  AND t.topic_number BETWEEN 1 AND 20
  AND t.title NOT IN (
    'How can AI and digital learning tools be responsibly integrated into school education?',
    'How should India strengthen cyber safety and data privacy for students and citizens?',
    'How can financial literacy be made compulsory in schools to promote responsible money management?',
    'How can schools and colleges better prepare students for employment and entrepreneurship?',
    'How can road safety awareness and responsible driving behaviour be improved among youth?',
    'How can India improve mental health awareness and counselling support for students?',
    'How can schools and cities reduce pollution and encourage sustainable lifestyles?',
    'How can technology and innovation improve agricultural productivity and farmer incomes?',
    'How can Indian cities improve urban mobility and public transport systems?',
    'How can schools ensure safer and more inclusive spaces for girls and children?',
    'How can MSMEs and small businesses be supported in the era of digital transformation?',
    'How can India accelerate renewable energy adoption while balancing development needs?',
    'How can India strengthen internal security while protecting democratic freedoms?',
    'How can judicial reforms reduce case backlogs and improve access to justice?',
    'How can sports infrastructure and opportunities be expanded for youth across India?',
    'How can India become a global manufacturing and semiconductor hub?',
    'How can India address water disputes, conservation, and equitable water distribution?',
    'How should India balance diplomacy, defence, and strategic global alliances?',
    'How can India tackle youth unemployment and bridge the skill gap?',
    'How can rural employment, infrastructure, and local governance be strengthened?'
  );

-- Step 2: Insert the 20 new ministry-mapped central topics.
-- Title-level dedupe gives idempotency.
INSERT INTO yip.topics (category, zone, topic_number, title, description, sub_points, handbook_page, is_active)
SELECT 'central'::public.topic_category, NULL, nt.topic_number, nt.title, nt.description, nt.sub_points, NULL, true
FROM (
  VALUES
    (1::int, 'How can AI and digital learning tools be responsibly integrated into school education?', 'Ministry: Ministry of Education', '["NEP 2020, DIKSHA, PM eVidya"]'::jsonb),
    (2, 'How should India strengthen cyber safety and data privacy for students and citizens?', 'Ministry: Ministry of Electronics & IT', '["Digital India Act, DPDP Act"]'::jsonb),
    (3, 'How can financial literacy be made compulsory in schools to promote responsible money management?', 'Ministry: Ministry of Finance', '["RBI Financial Literacy Initiatives"]'::jsonb),
    (4, 'How can schools and colleges better prepare students for employment and entrepreneurship?', 'Ministry: Ministry of Skill Development & Entrepreneurship', '["Skill India Mission, Startup India"]'::jsonb),
    (5, 'How can road safety awareness and responsible driving behaviour be improved among youth?', 'Ministry: Ministry of Road Transport & Highways', '["Motor Vehicles Act, Road Safety Policy"]'::jsonb),
    (6, 'How can India improve mental health awareness and counselling support for students?', 'Ministry: Ministry of Health & Family Welfare', '["Ayushman Bharat School Health Programme"]'::jsonb),
    (7, 'How can schools and cities reduce pollution and encourage sustainable lifestyles?', 'Ministry: Ministry of Environment, Forest & Climate Change', '["National Clean Air Programme"]'::jsonb),
    (8, 'How can technology and innovation improve agricultural productivity and farmer incomes?', 'Ministry: Ministry of Agriculture & Farmers Welfare', '["Digital Agriculture Mission"]'::jsonb),
    (9, 'How can Indian cities improve urban mobility and public transport systems?', 'Ministry: Ministry of Housing & Urban Affairs', '["Smart Cities Mission"]'::jsonb),
    (10, 'How can schools ensure safer and more inclusive spaces for girls and children?', 'Ministry: Ministry of Women & Child Development', '["Beti Bachao Beti Padhao, POCSO Act"]'::jsonb),
    (11, 'How can MSMEs and small businesses be supported in the era of digital transformation?', 'Ministry: Ministry of MSME', '["MSME Development Act"]'::jsonb),
    (12, 'How can India accelerate renewable energy adoption while balancing development needs?', 'Ministry: Ministry of Renewable Energy & Power', '["National Solar Mission"]'::jsonb),
    (13, 'How can India strengthen internal security while protecting democratic freedoms?', 'Ministry: Ministry of Home Affairs', '["Disaster Management Act, Internal Security Policies"]'::jsonb),
    (14, 'How can judicial reforms reduce case backlogs and improve access to justice?', 'Ministry: Ministry of Law & Justice', '["e-Courts Mission Mode Project"]'::jsonb),
    (15, 'How can sports infrastructure and opportunities be expanded for youth across India?', 'Ministry: Ministry of Youth Affairs & Sports', '["Khelo India Programme"]'::jsonb),
    (16, 'How can India become a global manufacturing and semiconductor hub?', 'Ministry: Ministry of Commerce & Industry', '["Make in India, Semiconductor Mission"]'::jsonb),
    (17, 'How can India address water disputes, conservation, and equitable water distribution?', 'Ministry: Ministry of Jal Shakti', '["Jal Jeevan Mission"]'::jsonb),
    (18, 'How should India balance diplomacy, defence, and strategic global alliances?', 'Ministry: Ministry of External Affairs & Defence', '["India Foreign Policy Framework"]'::jsonb),
    (19, 'How can India tackle youth unemployment and bridge the skill gap?', 'Ministry: Ministry of Labour & Employment', '["National Career Service, Skill India"]'::jsonb),
    (20, 'How can rural employment, infrastructure, and local governance be strengthened?', 'Ministry: Ministry of Rural Development & Panchayati Raj', '["MGNREGA, Digital Panchayat Mission"]'::jsonb)
) AS nt(topic_number, title, description, sub_points)
WHERE NOT EXISTS (
  SELECT 1 FROM yip.topics x
  WHERE x.category = 'central' AND x.title = nt.title
);

COMMIT;
