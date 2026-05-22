-- ============================================================================
-- CMP (Common Minimum Program) National Targets for 2026
-- Created: 2026-01-03
-- Purpose: Seed national CMP targets for all Yi verticals
-- Source: Yi Erode Chapter vault data + Pathfinder 2026 guidelines
-- ============================================================================

-- ============================================================================
-- 1. ADD MISSING VERTICALS TO DEMO CHAPTER
-- These are needed as reference verticals for CMP targets
-- ============================================================================

INSERT INTO public.verticals (id, chapter_id, name, slug, description, color, icon, is_active, display_order)
VALUES
  -- Health/Mental Wellbeing
  (
    'ee000005-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Health & Mental Wellbeing',
    'health',
    'Healthcare awareness, mental health initiatives, and wellness programs',
    '#EC4899',
    'heart-pulse',
    TRUE,
    5
  ),
  -- Innovation
  (
    'ee000006-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Innovation',
    'innovation',
    'Innovation challenges, hackathons, and technology adoption initiatives',
    '#8B5CF6',
    'lightbulb',
    TRUE,
    6
  ),
  -- Entrepreneurship
  (
    'ee000007-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Entrepreneurship',
    'entrepreneurship',
    'Startup mentorship, business development, and entrepreneur support programs',
    '#F97316',
    'briefcase',
    TRUE,
    7
  ),
  -- Rural Initiative
  (
    'ee000008-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Rural Initiative',
    'rural',
    'Village adoption, rural development, and community empowerment programs',
    '#84CC16',
    'home',
    TRUE,
    8
  )
ON CONFLICT (chapter_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- ============================================================================
-- 2. CREATE NATIONAL CMP TARGETS FOR 2026
-- These are minimum targets that apply to ALL chapters nationally
-- ============================================================================

-- MASOOM (Child Safety) - 2 activities per month
-- Focus: School safety awareness, Good Touch/Bad Touch, Child protection
INSERT INTO public.cmp_targets (
  vertical_id,
  calendar_year,
  min_activities,
  min_participants,
  min_ec_participation,
  min_awareness_activities,
  min_action_activities,
  min_advocacy_activities,
  chapter_id,
  is_national_target,
  description
)
VALUES (
  'ee000001-0000-4000-a000-000000000001'::UUID,
  2026,
  24,      -- 2 activities per month
  500,     -- Total beneficiaries/participants
  12,      -- EC member participation count
  6,       -- Awareness: School sessions, parent meetings
  12,      -- Action: Training workshops, safety audits
  6,       -- Advocacy: Policy meetings, stakeholder engagement
  NULL,    -- National target
  TRUE,
  'MASOOM 2026: Minimum 24 school safety sessions reaching 500+ students. Focus on Good Touch/Bad Touch awareness, safety protocols, and teacher training.'
)
ON CONFLICT (vertical_id, calendar_year, chapter_id, is_national_target)
DO UPDATE SET
  min_activities = EXCLUDED.min_activities,
  min_participants = EXCLUDED.min_participants,
  min_ec_participation = EXCLUDED.min_ec_participation,
  min_awareness_activities = EXCLUDED.min_awareness_activities,
  min_action_activities = EXCLUDED.min_action_activities,
  min_advocacy_activities = EXCLUDED.min_advocacy_activities,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Climate Change / Climate Action
-- Focus: Tree plantation, awareness campaigns, sustainability
INSERT INTO public.cmp_targets (
  vertical_id,
  calendar_year,
  min_activities,
  min_participants,
  min_ec_participation,
  min_awareness_activities,
  min_action_activities,
  min_advocacy_activities,
  chapter_id,
  is_national_target,
  description
)
VALUES (
  'ee000003-0000-4000-a000-000000000001'::UUID,
  2026,
  20,      -- Activities throughout the year
  1000,    -- Trees planted + event participants
  20,      -- High EC engagement expected
  8,       -- Awareness: Climate workshops, school programs
  8,       -- Action: Tree plantation drives, clean-up campaigns
  4,       -- Advocacy: Policy engagement, green initiatives
  NULL,
  TRUE,
  'Climate Action 2026: Plant 1000+ trees, conduct climate awareness in schools/colleges. Partner with local bodies for sustainable initiatives.'
)
ON CONFLICT (vertical_id, calendar_year, chapter_id, is_national_target)
DO UPDATE SET
  min_activities = EXCLUDED.min_activities,
  min_participants = EXCLUDED.min_participants,
  min_ec_participation = EXCLUDED.min_ec_participation,
  min_awareness_activities = EXCLUDED.min_awareness_activities,
  min_action_activities = EXCLUDED.min_action_activities,
  min_advocacy_activities = EXCLUDED.min_advocacy_activities,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Road Safety
-- Focus: Chota Cop program, helmet awareness, traffic safety
INSERT INTO public.cmp_targets (
  vertical_id,
  calendar_year,
  min_activities,
  min_participants,
  min_ec_participation,
  min_awareness_activities,
  min_action_activities,
  min_advocacy_activities,
  chapter_id,
  is_national_target,
  description
)
VALUES (
  'ee000004-0000-4000-a000-000000000001'::UUID,
  2026,
  12,      -- Monthly road safety activities
  25000,   -- Chota Cop reaches large student population
  15,      -- EC participation
  4,       -- Awareness: School programs, campaigns
  6,       -- Action: Chota Cop, helmet drives, safety checks
  2,       -- Advocacy: Traffic dept coordination
  NULL,
  TRUE,
  'Road Safety 2026: Chota Cop program targeting 25,000 students. Helmet awareness campaigns, zebra crossing safety, and partnership with traffic police.'
)
ON CONFLICT (vertical_id, calendar_year, chapter_id, is_national_target)
DO UPDATE SET
  min_activities = EXCLUDED.min_activities,
  min_participants = EXCLUDED.min_participants,
  min_ec_participation = EXCLUDED.min_ec_participation,
  min_awareness_activities = EXCLUDED.min_awareness_activities,
  min_action_activities = EXCLUDED.min_action_activities,
  min_advocacy_activities = EXCLUDED.min_advocacy_activities,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Health & Mental Wellbeing
-- Focus: Mental health awareness, health camps, wellness programs
INSERT INTO public.cmp_targets (
  vertical_id,
  calendar_year,
  min_activities,
  min_participants,
  min_ec_participation,
  min_awareness_activities,
  min_action_activities,
  min_advocacy_activities,
  chapter_id,
  is_national_target,
  description
)
VALUES (
  'ee000005-0000-4000-a000-000000000001'::UUID,
  2026,
  12,      -- Monthly health/wellness activities
  300,     -- Beneficiaries reached
  10,      -- EC participation
  4,       -- Awareness: Mental health talks, wellness workshops
  6,       -- Action: Health camps, counseling sessions
  2,       -- Advocacy: Mental health policy advocacy
  NULL,
  TRUE,
  'Health 2026: Mental wellness programs, health camps, and awareness sessions. Focus on stress management, work-life balance for young professionals.'
)
ON CONFLICT (vertical_id, calendar_year, chapter_id, is_national_target)
DO UPDATE SET
  min_activities = EXCLUDED.min_activities,
  min_participants = EXCLUDED.min_participants,
  min_ec_participation = EXCLUDED.min_ec_participation,
  min_awareness_activities = EXCLUDED.min_awareness_activities,
  min_action_activities = EXCLUDED.min_action_activities,
  min_advocacy_activities = EXCLUDED.min_advocacy_activities,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Innovation
-- Focus: Hackathons, innovation challenges, tech adoption
INSERT INTO public.cmp_targets (
  vertical_id,
  calendar_year,
  min_activities,
  min_participants,
  min_ec_participation,
  min_awareness_activities,
  min_action_activities,
  min_advocacy_activities,
  chapter_id,
  is_national_target,
  description
)
VALUES (
  'ee000006-0000-4000-a000-000000000001'::UUID,
  2026,
  8,       -- Quarterly innovation events
  200,     -- Participants
  8,       -- EC participation
  2,       -- Awareness: Tech talks, innovation showcases
  4,       -- Action: Hackathons, innovation challenges
  2,       -- Advocacy: Industry partnerships
  NULL,
  TRUE,
  'Innovation 2026: Host innovation challenges, hackathons, and tech showcases. Connect young innovators with industry mentors and investors.'
)
ON CONFLICT (vertical_id, calendar_year, chapter_id, is_national_target)
DO UPDATE SET
  min_activities = EXCLUDED.min_activities,
  min_participants = EXCLUDED.min_participants,
  min_ec_participation = EXCLUDED.min_ec_participation,
  min_awareness_activities = EXCLUDED.min_awareness_activities,
  min_action_activities = EXCLUDED.min_action_activities,
  min_advocacy_activities = EXCLUDED.min_advocacy_activities,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Entrepreneurship
-- Focus: Startup mentorship, business development, investor connects
INSERT INTO public.cmp_targets (
  vertical_id,
  calendar_year,
  min_activities,
  min_participants,
  min_ec_participation,
  min_awareness_activities,
  min_action_activities,
  min_advocacy_activities,
  chapter_id,
  is_national_target,
  description
)
VALUES (
  'ee000007-0000-4000-a000-000000000001'::UUID,
  2026,
  8,       -- Quarterly entrepreneurship events
  150,     -- Entrepreneurs reached
  8,       -- EC participation
  2,       -- Awareness: Entrepreneur talks, success stories
  4,       -- Action: Mentorship programs, pitch sessions
  2,       -- Advocacy: Startup ecosystem building
  NULL,
  TRUE,
  'Entrepreneurship 2026: Mentorship programs for aspiring entrepreneurs, startup pitch sessions, and investor connect events.'
)
ON CONFLICT (vertical_id, calendar_year, chapter_id, is_national_target)
DO UPDATE SET
  min_activities = EXCLUDED.min_activities,
  min_participants = EXCLUDED.min_participants,
  min_ec_participation = EXCLUDED.min_ec_participation,
  min_awareness_activities = EXCLUDED.min_awareness_activities,
  min_action_activities = EXCLUDED.min_action_activities,
  min_advocacy_activities = EXCLUDED.min_advocacy_activities,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Rural Initiative
-- Focus: Village adoption, rural development, community empowerment
INSERT INTO public.cmp_targets (
  vertical_id,
  calendar_year,
  min_activities,
  min_participants,
  min_ec_participation,
  min_awareness_activities,
  min_action_activities,
  min_advocacy_activities,
  chapter_id,
  is_national_target,
  description
)
VALUES (
  'ee000008-0000-4000-a000-000000000001'::UUID,
  2026,
  8,       -- Quarterly rural activities
  200,     -- Villagers impacted
  10,      -- EC participation (higher for rural outreach)
  2,       -- Awareness: Skill training, health awareness
  4,       -- Action: Infrastructure, livelihood programs
  2,       -- Advocacy: Government scheme linkages
  NULL,
  TRUE,
  'Rural 2026: Village adoption program with focus on skill development, health camps, and infrastructure improvement. Partner with government schemes.'
)
ON CONFLICT (vertical_id, calendar_year, chapter_id, is_national_target)
DO UPDATE SET
  min_activities = EXCLUDED.min_activities,
  min_participants = EXCLUDED.min_participants,
  min_ec_participation = EXCLUDED.min_ec_participation,
  min_awareness_activities = EXCLUDED.min_awareness_activities,
  min_action_activities = EXCLUDED.min_action_activities,
  min_advocacy_activities = EXCLUDED.min_advocacy_activities,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

-- Display summary of seeded targets
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.cmp_targets
  WHERE calendar_year = 2026 AND is_national_target = TRUE;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'CMP Targets 2026 Seed Complete';
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'National targets created/updated: %', v_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Vertical Targets Summary:';
  RAISE NOTICE '  - MASOOM: 24 activities, 500 participants';
  RAISE NOTICE '  - Climate: 20 activities, 1000 trees/participants';
  RAISE NOTICE '  - Road Safety: 12 activities, 25000 (Chota Cop)';
  RAISE NOTICE '  - Health: 12 activities, 300 participants';
  RAISE NOTICE '  - Innovation: 8 activities, 200 participants';
  RAISE NOTICE '  - Entrepreneurship: 8 activities, 150 participants';
  RAISE NOTICE '  - Rural: 8 activities, 200 participants';
  RAISE NOTICE '====================================================';
END $$;

-- Optional: View all 2026 national targets
-- SELECT
--   v.name AS vertical,
--   t.min_activities,
--   t.min_participants,
--   t.min_awareness_activities AS awareness,
--   t.min_action_activities AS action,
--   t.min_advocacy_activities AS advocacy,
--   t.description
-- FROM public.cmp_targets t
-- JOIN public.verticals v ON t.vertical_id = v.id
-- WHERE t.calendar_year = 2026 AND t.is_national_target = TRUE
-- ORDER BY v.display_order;
