-- ════════════════════════════════════════════════════════════════════════
-- Migration: Yi Erode seed data lifted to yi_connect.*
--
-- Combines 6 original seed migrations:
--   - 20251220000001 import_yi_erode_schools         (20 schools)
--   - 20251220000002 import_yi_erode_colleges        (33 colleges)
--   - 20251220000003 import_yi_erode_events          (15 events)
--   - 20251220000004 import_all_yi_erode_events      (41 events)
--   - 20251220000005 import_yi_erode_approved_emails (2 emails)
--   - 20251221000001 import_ec_team_2025_emails      (16 emails)
--
-- Target schema: yi_connect (chapters live in yi.chapters)
--
-- Behaviour:
--   - Looks up Erode chapter id from yi.chapters
--   - Looks up director@jkkn.ac.in auth.users.id for approved_by FK
--   - Either lookup failing → RAISE NOTICE, exit gracefully (no error)
--   - ON CONFLICT DO NOTHING everywhere for idempotency
--   - approved_emails rows ONLY inserted when director uid is found
--     (approved_by is NOT NULL)
--   - connected_through_member_id always NULL — yi_connect.members
--     may not have those rows; FK left unset
--   - No GENERATED ALWAYS columns (search_vector is plain tsvector here)
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_chapter_id UUID;
  v_director_id UUID;
  v_have_director BOOLEAN := FALSE;
BEGIN
  -- ────────────────────────────────────────────────────────────────
  -- Lookups
  -- ────────────────────────────────────────────────────────────────

  -- Erode chapter id (known to exist, but defensive lookup)
  SELECT id INTO v_chapter_id
    FROM yi.chapters
   WHERE id = 'fe71c429-2647-4262-b35b-e356c960903d'
   LIMIT 1;

  IF v_chapter_id IS NULL THEN
    -- fallback by name
    SELECT id INTO v_chapter_id
      FROM yi.chapters
     WHERE name ILIKE '%erode%'
     LIMIT 1;
  END IF;

  IF v_chapter_id IS NULL THEN
    RAISE NOTICE 'Yi Erode chapter not found in yi.chapters — skipping all seed inserts.';
    RETURN;
  END IF;

  -- Director auth user id (NEEDED for approved_emails.approved_by NOT NULL)
  SELECT id INTO v_director_id
    FROM auth.users
   WHERE email = 'director@jkkn.ac.in'
   LIMIT 1;

  IF v_director_id IS NULL THEN
    RAISE NOTICE 'director@jkkn.ac.in not found in auth.users — approved_emails inserts will be skipped.';
    v_have_director := FALSE;
  ELSE
    v_have_director := TRUE;
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- SCHOOLS (20 rows)
  -- ════════════════════════════════════════════════════════════════
  INSERT INTO yi_connect.schools (
    chapter_id,
    school_name,
    school_type,
    city,
    management_type,
    suitable_programs,
    status,
    connection_type,
    connection_notes
  ) VALUES
  -- Government Schools (8)
  (v_chapter_id, 'Railway Colony Corp Primary School',       'primary'::yi_connect.school_type,     'Erode',         'Government', ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 80 students'),
  (v_chapter_id, 'Kollampalayam Corp School',                'primary'::yi_connect.school_type,     'Erode',         'Government', ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 78 students'),
  (v_chapter_id, 'Edayankaatuvalasu Govt Primary School',    'primary'::yi_connect.school_type,     'Erode',         'Government', ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 45 students'),
  (v_chapter_id, 'Veerapan Chatram Panchayat Union School',  'primary'::yi_connect.school_type,     'Erode',         'Government', ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 33 students'),
  (v_chapter_id, 'Manikampalayam Govt Primary School',       'primary'::yi_connect.school_type,     'Erode',         'Government', ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 60 students'),
  (v_chapter_id, 'Manikampalayam Boys High School',          'high_school'::yi_connect.school_type, 'Erode',         'Government', ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 40 students'),
  (v_chapter_id, 'Teacher''s Colony Higher Secondary School','high_school'::yi_connect.school_type, 'Erode',         'Government', ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 50 students'),
  (v_chapter_id, 'Government Model School',                  'state_board'::yi_connect.school_type, 'Erode',         'Government', ARRAY['MASOOM'],          'prospective'::yi_connect.stakeholder_status,  'cold'::yi_connect.connection_type,           'New target school'),

  -- Private Schools (12)
  (v_chapter_id, 'Maharishi Vidya Mandir',                   'cbse'::yi_connect.school_type,        'Erode',         'Private',    ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 200 students'),
  (v_chapter_id, 'Lions Matriculation',                      'matric'::yi_connect.school_type,      'Erode',         'Private',    ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 100 students'),
  (v_chapter_id, 'Rajendran Academy',                        'matric'::yi_connect.school_type,      'Erode',         'Private',    ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 100 students'),
  (v_chapter_id, 'CS Academy',                               'matric'::yi_connect.school_type,      'Erode',         'Private',    ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 100 students'),
  (v_chapter_id, 'Erode Public School',                      'cbse'::yi_connect.school_type,        'Erode',         'Private',    ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 100 students'),
  (v_chapter_id, 'SSM Primary School',                       'matric'::yi_connect.school_type,      'Komarapalayam', 'Private',    ARRAY['MASOOM'],          'active'::yi_connect.stakeholder_status,       'direct'::yi_connect.connection_type,         'MASOOM session completed: 200 students'),
  (v_chapter_id, 'JKK Rangammal School',                     'cbse'::yi_connect.school_type,        'Komarapalayam', 'Private',    ARRAY['MASOOM','Thalir'], 'active'::yi_connect.stakeholder_status,       'through_member'::yi_connect.connection_type, 'MASOOM Model School - Completed. JKKN internal.'),
  (v_chapter_id, 'JKK Nataraja School',                      'cbse'::yi_connect.school_type,        'Komarapalayam', 'Private',    ARRAY['MASOOM','Thalir'], 'active'::yi_connect.stakeholder_status,       'through_member'::yi_connect.connection_type, 'MASOOM Model School - Completed. JKKN internal.'),
  (v_chapter_id, 'RTD International School',                 'international'::yi_connect.school_type,'Erode',        'Private',    ARRAY['MASOOM'],          'prospective'::yi_connect.stakeholder_status,  'cold'::yi_connect.connection_type,           'Call in January'),
  (v_chapter_id, 'Dr Kids/Prerna',                           'primary'::yi_connect.school_type,     'Erode',         'Private',    ARRAY['MASOOM'],          'prospective'::yi_connect.stakeholder_status,  'cold'::yi_connect.connection_type,           'New target school'),
  (v_chapter_id, 'Spectrum School',                          'cbse'::yi_connect.school_type,        'Erode',         'Private',    ARRAY['MASOOM'],          'prospective'::yi_connect.stakeholder_status,  'cold'::yi_connect.connection_type,           'New target school'),
  (v_chapter_id, 'Narayana School',                          'cbse'::yi_connect.school_type,        'Erode',         'Private',    ARRAY['MASOOM'],          'prospective'::yi_connect.stakeholder_status,  'cold'::yi_connect.connection_type,           'New target school')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded schools for Yi Erode chapter';

  -- ════════════════════════════════════════════════════════════════
  -- COLLEGES (33 rows)
  --
  -- connected_through_member_id always NULL — yi_connect.members may
  -- not have those rows yet; connection_notes preserves provenance.
  -- ════════════════════════════════════════════════════════════════
  INSERT INTO yi_connect.colleges (
    chapter_id,
    college_name,
    college_type,
    city,
    has_yuva_chapter,
    status,
    connection_type,
    connected_through_member_id,
    connection_notes
  ) VALUES
  -- JKKN Group (7 colleges)
  (v_chapter_id, 'JKKN College of Engineering',     'engineering'::yi_connect.college_type,  'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'JKKN Group - Internal connection (Om)'),
  (v_chapter_id, 'JKKN College of Arts & Science',  'arts_science'::yi_connect.college_type, 'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'JKKN Group - Internal connection (Om)'),
  (v_chapter_id, 'JKKN Dental College',             'medical'::yi_connect.college_type,      'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'JKKN Group - Internal connection (Om)'),
  (v_chapter_id, 'JKKN College of Pharmacy',        'medical'::yi_connect.college_type,      'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'JKKN Group - Internal connection (Om)'),
  (v_chapter_id, 'JKKN College of Allied Health',   'medical'::yi_connect.college_type,      'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'JKKN Group - Internal connection (Om)'),
  (v_chapter_id, 'JKKN College of Nursing',         'medical'::yi_connect.college_type,      'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'JKKN Group - Internal connection (Om)'),
  (v_chapter_id, 'JKKN College of Education',       'other'::yi_connect.college_type,        'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'JKKN Group - Internal connection (Om)'),

  -- Nandha Group (6 colleges)
  (v_chapter_id, 'Nandha Engineering College',      'engineering'::yi_connect.college_type,  'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'through_member'::yi_connect.connection_type, NULL, 'Nandha Group - Hari can take lead'),
  (v_chapter_id, 'Nandha College of Technology',    'engineering'::yi_connect.college_type,  'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'through_member'::yi_connect.connection_type, NULL, 'Nandha Group'),
  (v_chapter_id, 'Nandha Arts & Science',           'arts_science'::yi_connect.college_type, 'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Nandha Group - To Contact'),
  (v_chapter_id, 'Nandha College of Pharmacy',      'medical'::yi_connect.college_type,      'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Nandha Group - To Contact'),
  (v_chapter_id, 'Nandha College of Nursing',       'medical'::yi_connect.college_type,      'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Nandha Group - To Contact'),
  (v_chapter_id, 'Nandha Polytechnic',              'polytechnic'::yi_connect.college_type,  'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Nandha Group - To Contact'),

  -- KSR Group (3 colleges)
  (v_chapter_id, 'KSR College of Engineering',      'engineering'::yi_connect.college_type,  'Tiruchengode',      true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'KSR Group'),
  (v_chapter_id, 'KSR College for Women',           'engineering'::yi_connect.college_type,  'Tiruchengode',      true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'KSR Group'),
  (v_chapter_id, 'KSR College of Arts & Science',   'arts_science'::yi_connect.college_type, 'Tiruchengode',      true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'KSR Group'),

  -- Vellalar Group (2 colleges)
  (v_chapter_id, 'Vellalar College for Women',      'arts_science'::yi_connect.college_type, 'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Vellalar Group - Documents requested, renewal pending'),
  (v_chapter_id, 'Vellalar Engineering',            'engineering'::yi_connect.college_type,  'Erode',             false, 'inactive'::yi_connect.stakeholder_status,    'cold'::yi_connect.connection_type,           NULL, 'Vellalar Group - Inactive'),

  -- SSM Group (3 colleges)
  (v_chapter_id, 'SSM College of Nursing',          'medical'::yi_connect.college_type,      'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'SSM Group - MOU Signed'),
  (v_chapter_id, 'SSM College of Physiotherapy',    'medical'::yi_connect.college_type,      'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'SSM Group - MOU Signed'),
  (v_chapter_id, 'SSM Polytechnic',                 'polytechnic'::yi_connect.college_type,  'Komarapalayam',     true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'SSM Group - MOU Signed'),

  -- Kongu Group (2 colleges)
  (v_chapter_id, 'Kongu Engineering College',       'engineering'::yi_connect.college_type,  'Perundurai',        true,  'active'::yi_connect.stakeholder_status,      'through_member'::yi_connect.connection_type, NULL, 'Kongu Group - Management contact: Dr. Karthik (via Haribaskar)'),
  (v_chapter_id, 'Kongu Polytechnic',               'polytechnic'::yi_connect.college_type,  'Perundurai',        true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'Kongu Group'),

  -- Individual Colleges (7)
  (v_chapter_id, 'Excel Engineering College',       'engineering'::yi_connect.college_type,  'Komarapalayam',     false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Individual - Partial engagement'),
  (v_chapter_id, 'PKR Engineering',                 'engineering'::yi_connect.college_type,  'Erode',             true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'Individual'),
  (v_chapter_id, 'Gobi Arts & Science',             'arts_science'::yi_connect.college_type, 'Gobichettipalayam', true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'Individual'),
  (v_chapter_id, 'KPR Engineering',                 'engineering'::yi_connect.college_type,  'Coimbatore',        true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'MOU Signed'),
  (v_chapter_id, 'SNS Engineering',                 'engineering'::yi_connect.college_type,  'Coimbatore',        true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'MOU Signed'),
  (v_chapter_id, 'Sri Krishna Engineering',         'engineering'::yi_connect.college_type,  'Coimbatore',        true,  'active'::yi_connect.stakeholder_status,      'direct'::yi_connect.connection_type,         NULL, 'MOU Signed'),
  (v_chapter_id, 'Navarasam Arts & Science',        'arts_science'::yi_connect.college_type, 'Erode',             false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'To verify'),

  -- Potential New (2 colleges)
  (v_chapter_id, 'Vivekananda College',             'arts_science'::yi_connect.college_type, 'Salem',             false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Potential New - Medium priority'),
  (v_chapter_id, 'Shanmuga Engineering',            'engineering'::yi_connect.college_type,  'Tiruchengode',      false, 'prospective'::yi_connect.stakeholder_status, 'cold'::yi_connect.connection_type,           NULL, 'Potential New - Medium priority')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded colleges for Yi Erode chapter';

  -- ════════════════════════════════════════════════════════════════
  -- EVENTS — first batch (15 rows: 2025 key events + 2021 notable)
  -- ════════════════════════════════════════════════════════════════
  INSERT INTO yi_connect.events (
    chapter_id,
    title,
    description,
    category,
    status,
    start_date,
    end_date,
    tags,
    custom_fields
  ) VALUES
  -- 2025 Key Events
  (v_chapter_id, 'Diwali Damakka 2025', 'Annual Diwali celebration with crackers, music concert, and dinner. District Collector attended.',
   'cultural'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2025-10-12 17:00:00+05:30', '2025-10-12 22:00:00+05:30',
   ARRAY['diwali', 'cultural', 'family', '2025'],
   '{"impact": "28+ families attended", "vip_attendance": "District Collector"}'::jsonb),

  (v_chapter_id, 'Erode Varnam Vizha 2025 - Thiran Ottam', 'Community run event as part of Erode Varnam Vizha celebrations.',
   'sports'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2025-10-11 06:00:00+05:30', '2025-10-11 09:00:00+05:30',
   ARRAY['run', 'sports', 'varnam-vizha', '2025'],
   '{}'::jsonb),

  (v_chapter_id, 'MASOOM TOT Session 2025', 'Train-the-Trainer session on Child Sexual Abuse Awareness. First of its kind in SRTN region.',
   'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2025-10-17 10:00:00+05:30', '2025-10-17 16:00:00+05:30',
   ARRAY['masoom', 'tot', 'child-safety', 'training', '2025'],
   '{"impact": {"schools": 7, "teachers_trained": 69}, "speaker": "Dr. Ashwini N. V."}'::jsonb),

  (v_chapter_id, 'E-Waste Collection Campaign', 'Partnership with Ascent Urban Recyclers and OEF for e-waste collection across Erode.',
   'community_service'::yi_connect.event_category, 'ongoing'::yi_connect.event_status,
   '2025-10-21 00:00:00+05:30', '2025-11-14 23:59:00+05:30',
   ARRAY['climate-change', 'e-waste', 'environment', '2025'],
   '{"partners": ["Ascent Urban Recyclers", "OEF"]}'::jsonb),

  (v_chapter_id, 'HUM5 Running Challenge', 'National initiative - 70km run in 5 days with prizes worth 3 lakh.',
   'sports'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2025-11-05 05:00:00+05:30', '2025-11-09 20:00:00+05:30',
   ARRAY['hum5', 'running', 'health', 'national', '2025'],
   '{"challenge": "70km in 5 days", "prizes": "Worth 3 lakh"}'::jsonb),

  (v_chapter_id, 'Stories from the Top - V R Muthu', 'CII Erode Learning Series with Idhayam Chairman at Hotel Rathna Residency.',
   'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2025-10-25 18:00:00+05:30', '2025-10-25 21:00:00+05:30',
   ARRAY['learning', 'cii', 'business', '2025'],
   '{"speaker": "V R Muthu, Idhayam Chairman", "venue": "Hotel Rathna Residency, Erode"}'::jsonb),

  -- 2021 Notable Events
  (v_chapter_id, 'Tree Plantation Drive 2021', 'Climate change initiative with 2850 saplings planted across Erode.',
   'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-06-05 08:00:00+05:30', '2021-06-05 12:00:00+05:30',
   ARRAY['climate-change', 'tree-plantation', '2021'],
   '{"impact": {"saplings_planted": 2850}}'::jsonb),

  (v_chapter_id, '5K Run 2021', 'Annual 5K run event for Yi Erode members and families.',
   'sports'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-01-26 06:00:00+05:30', '2021-01-26 09:00:00+05:30',
   ARRAY['sports', 'run', '5k', '2021'],
   '{}'::jsonb),

  (v_chapter_id, 'Pongal Vizha 2021', 'Traditional Pongal celebration with members.',
   'cultural'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-01-14 10:00:00+05:30', '2021-01-14 14:00:00+05:30',
   ARRAY['pongal', 'cultural', '2021'],
   '{}'::jsonb),

  (v_chapter_id, 'Pool Party Holi 2021', 'Family event with games and dinner.',
   'social'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-03-28 16:00:00+05:30', '2021-03-28 21:00:00+05:30',
   ARRAY['holi', 'social', 'family', '2021'],
   '{}'::jsonb),

  (v_chapter_id, 'Blood Donation Drive 2021', 'Health camp in memory of Past Chair Shanmugam''s aunt.',
   'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-03-26 09:00:00+05:30', '2021-03-26 15:00:00+05:30',
   ARRAY['health', 'blood-donation', '2021'],
   '{"in_memory_of": "Past Chair Shanmugam aunt"}'::jsonb),

  (v_chapter_id, 'Singalila Ridge Trek 2021', 'First Yi Trek - Darjeeling to Sandakphu adventure.',
   'sports'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-04-23 06:00:00+05:30', '2021-04-27 18:00:00+05:30',
   ARRAY['trek', 'adventure', 'sports', '2021'],
   '{"route": "Darjeeling to Sandakphu", "note": "First Yi Trek"}'::jsonb),

  (v_chapter_id, 'COVID Vaccine Priority Access 2021', 'CII-Yi initiative providing vaccine access for members and employees.',
   'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-05-01 09:00:00+05:30', '2021-07-31 18:00:00+05:30',
   ARRAY['covid', 'health', 'vaccination', '2021'],
   '{"initiative": "CII-Yi"}'::jsonb),

  (v_chapter_id, 'Sai Krupa Special School Visit 2021', 'Walk in my shoes - interaction with special children at Tirupur.',
   'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-03-20 09:00:00+05:30', '2021-03-20 16:00:00+05:30',
   ARRAY['thalir', 'special-children', '2021'],
   '{"location": "Tirupur", "theme": "Walk in my shoes"}'::jsonb),

  (v_chapter_id, 'Show the Ink Campaign 2021', 'Voting encouragement - 20 brands offered 10% discount for voters.',
   'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status,
   '2021-04-06 00:00:00+05:30', '2021-04-10 23:59:00+05:30',
   ARRAY['voting', 'awareness', '2021'],
   '{"impact": "20 brands, 10% discount"}'::jsonb)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded first 15 events for Yi Erode chapter';

  -- ════════════════════════════════════════════════════════════════
  -- EVENTS — second batch (41 more 2021 events)
  -- ════════════════════════════════════════════════════════════════
  INSERT INTO yi_connect.events (
    chapter_id,
    title,
    description,
    category,
    status,
    start_date,
    end_date,
    tags,
    custom_fields
  ) VALUES
  -- MASOOM Sessions 2021
  (v_chapter_id, 'MASOOM Session - Rajendra CBSE School',     'Child safety awareness session at Rajendra CBSE School.',                    'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-15 10:00:00+05:30', '2021-01-15 12:00:00+05:30', ARRAY['masoom', 'child-safety', 'school', '2021'], '{}'::jsonb),
  (v_chapter_id, 'MASOOM Session - Rajendra Matric School',   'Child safety awareness session at Rajendra Matric School.',                  'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-16 10:00:00+05:30', '2021-01-16 12:00:00+05:30', ARRAY['masoom', 'child-safety', 'school', '2021'], '{}'::jsonb),
  (v_chapter_id, 'MASOOM Session - Lions Matric School',      'Child safety awareness session at Lions Matric School.',                     'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-17 10:00:00+05:30', '2021-01-17 12:00:00+05:30', ARRAY['masoom', 'child-safety', 'school', '2021'], '{}'::jsonb),
  (v_chapter_id, 'MASOOM - Agasthiya International School',   'Child safety awareness session at Agasthiya International School.',          'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-10 10:00:00+05:30', '2021-02-10 12:00:00+05:30', ARRAY['masoom', 'child-safety', 'international-school', '2021'], '{}'::jsonb),
  (v_chapter_id, 'MASOOM for Rural Women - Kulur',            'Child safety awareness for rural women in Kulur village.',                   'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-15 10:00:00+05:30', '2021-03-15 13:00:00+05:30', ARRAY['masoom', 'rural', 'women-empowerment', '2021'], '{}'::jsonb),

  -- Thalir Events 2021
  (v_chapter_id, 'Story Telling Session - JKKN School',       'Interactive story telling session for students.',                            'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-20 10:00:00+05:30', '2021-01-20 12:00:00+05:30', ARRAY['thalir', 'storytelling', 'school', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Selfie with Daughter',                      'Father-daughter bonding awareness campaign.',                                'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-25 09:00:00+05:30', '2021-01-25 18:00:00+05:30', ARRAY['thalir', 'awareness', 'family', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Industry Visit - Milkymist',                'Students visit to Milkymist dairy plant.',                                   'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-15 09:00:00+05:30', '2021-02-15 14:00:00+05:30', ARRAY['thalir', 'industry-visit', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Thalir MoU - JKKN Matriculation School',    'MoU signing with JKKN Matriculation School for Thalir programs.',            'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-20 11:00:00+05:30', '2021-02-20 12:00:00+05:30', ARRAY['thalir', 'mou', 'jkkn', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Thalir MoU - SSM Nursery and Primary School', 'MoU signing with SSM School for Thalir programs.',                         'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-21 11:00:00+05:30', '2021-02-21 12:00:00+05:30', ARRAY['thalir', 'mou', 'ssm', '2021'], '{}'::jsonb),
  (v_chapter_id, 'National Science Day - Peeku Bird Park Visit', 'Educational visit to bird park on National Science Day.',                 'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-28 09:00:00+05:30', '2021-02-28 16:00:00+05:30', ARRAY['thalir', 'science-day', 'educational', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Chennai Rice Industry Visit',               'Industrial visit to rice processing unit. 7500 tonnes storage capacity.',    'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-30 08:00:00+05:30', '2021-03-30 17:00:00+05:30', ARRAY['thalir', 'industry-visit', '2021'], '{"impact": "7500 tonnes storage capacity tour"}'::jsonb),
  (v_chapter_id, 'Career Guidance - Shri Mahaa & Maharishi Vidya Mandir', 'Career guidance session for school students.',                    'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-10 10:00:00+05:30', '2021-03-10 13:00:00+05:30', ARRAY['thalir', 'career-guidance', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Poem Writing Competition',                  'Cross-chapter poem writing competition.',                                    'cultural'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-04-10 10:00:00+05:30', '2021-04-10 17:00:00+05:30', ARRAY['thalir', 'competition', 'poetry', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Children in New Normal - Pandemic Session', 'Panel session on child wellness during pandemic. Doctors, nutritionists, mental wellness experts.', 'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-05-22 10:00:00+05:30', '2021-05-22 13:00:00+05:30', ARRAY['thalir', 'covid', 'mental-health', '2021'], '{"panel": "Doctor, Nutritionist, Mental Wellness"}'::jsonb),

  -- Climate Change Events 2021
  (v_chapter_id, 'Wall Painting at VOC Park',                 'Climate awareness wall painting at VOC Park.',                               'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-30 08:00:00+05:30', '2021-01-30 14:00:00+05:30', ARRAY['climate-change', 'art', 'awareness', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Chithiram Wall Painting',                   'Environmental awareness wall painting campaign.',                            'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-25 08:00:00+05:30', '2021-02-25 14:00:00+05:30', ARRAY['climate-change', 'art', 'awareness', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Earth Hour Observance',                     'Lights off from 8:30-9:30pm, lit diyas instead.',                            'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-27 20:30:00+05:30', '2021-03-27 21:30:00+05:30', ARRAY['climate-change', 'earth-hour', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Sapling Plantation - Kanagamalai Village',  'Tree plantation drive at Kanagamalai village.',                              'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-04-01 07:00:00+05:30', '2021-04-01 11:00:00+05:30', ARRAY['climate-change', 'tree-plantation', 'rural', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Tree Plantation - Vellalar School',         'Earth Day plantation with 120 saplings planted by 12th graders.',            'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-04-22 08:00:00+05:30', '2021-04-22 12:00:00+05:30', ARRAY['climate-change', 'earth-day', 'school', '2021'], '{"impact": {"saplings_planted": 120}}'::jsonb),

  -- Health Events 2021
  (v_chapter_id, 'Cancer Awareness - Sengundhar School',      'Cancer awareness session for students.',                                     'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-04 10:00:00+05:30', '2021-02-04 12:00:00+05:30', ARRAY['health', 'cancer-awareness', 'school', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Health Checkup for Drivers - Vijayamangalam Toll Gate', 'Free health checkup for truck drivers.',                         'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-08 09:00:00+05:30', '2021-02-08 15:00:00+05:30', ARRAY['health', 'drivers', 'health-camp', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Eye Check Up Camp - Kulur Village',         'Free eye checkup camp for villagers.',                                       'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-05 09:00:00+05:30', '2021-03-05 16:00:00+05:30', ARRAY['health', 'eye-camp', 'rural', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Cervical Cancer Awareness - Kamraj Nagar',  'Women''s health awareness session in Kamraj Nagar.',                          'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-08 10:00:00+05:30', '2021-03-08 13:00:00+05:30', ARRAY['health', 'cancer-awareness', 'women', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Dental Hygiene Session - Rajendra Schools', 'Dental hygiene awareness by Dr. C.S. Sri Darshini, MDS.',                    'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-26 10:00:00+05:30', '2021-03-26 12:00:00+05:30', ARRAY['health', 'dental', 'school', '2021'], '{"speaker": "Dr. C.S. Sri Darshini, MDS"}'::jsonb),

  -- Road Safety Events 2021
  (v_chapter_id, 'Road Safety Awareness - Vijayalingam Toll Gate', 'Road safety awareness for drivers at toll gate.',                       'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-01 09:00:00+05:30', '2021-02-01 14:00:00+05:30', ARRAY['road-safety', 'drivers', 'awareness', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Kuttycop Session with Police Department',   'Road safety session in collaboration with police.',                          'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-22 10:00:00+05:30', '2021-02-22 13:00:00+05:30', ARRAY['road-safety', 'kuttycop', 'police', '2021'], '{}'::jsonb),

  -- Rural Initiative 2021
  (v_chapter_id, 'Women Empowerment Session - Kulur',         'Women empowerment and skill development session in Kulur village.',          'workshop'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-14 10:00:00+05:30', '2021-03-14 14:00:00+05:30', ARRAY['rural', 'women-empowerment', '2021'], '{}'::jsonb),

  -- Yuva Sessions 2021
  (v_chapter_id, 'Yuva Session - Mr Fizal Ahmed, MD Suxus',   'Entrepreneurship session by Fizal Ahmed for college students.',              'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-22 14:00:00+05:30', '2021-01-22 17:00:00+05:30', ARRAY['yuva', 'entrepreneurship', 'learning', '2021'], '{"speaker": "Mr Fizal Ahmed, MD Suxus"}'::jsonb),
  (v_chapter_id, 'Yuva Session - Karthikeyan from Unibic Foods', 'Success story session at Kongu Business School. 105 students attended.',  'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-20 14:00:00+05:30', '2021-03-20 17:00:00+05:30', ARRAY['yuva', 'learning', 'success-story', '2021'], '{"speaker": "Karthikeyan, Unibic Foods", "impact": {"students": 105}, "venue": "Kongu Business School"}'::jsonb),
  (v_chapter_id, 'Yuva Session - NLP Coach Sharmila',         'Session on confidence building: Am I Confident or Confused.',                'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-04-16 14:00:00+05:30', '2021-04-16 17:00:00+05:30', ARRAY['yuva', 'nlp', 'confidence', '2021'], '{"speaker": "NLP Coach Sharmila", "topic": "Am I Confident or Confused"}'::jsonb),

  -- Learning & Business Events 2021
  (v_chapter_id, 'Yi Erode Movie Night',                      'Social bonding event with members and families.',                            'social'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-23 18:00:00+05:30', '2021-01-23 22:00:00+05:30', ARRAY['social', 'family', 'bonding', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Just a Minute Competition',                 'Public speaking competition for members.',                                   'cultural'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-28 18:00:00+05:30', '2021-01-28 21:00:00+05:30', ARRAY['learning', 'competition', 'public-speaking', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Yi Erode Pathfinder 2021',                  'Annual planning session for the year.',                                      'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-01-10 09:00:00+05:30', '2021-01-10 17:00:00+05:30', ARRAY['planning', 'pathfinder', '2021'], '{}'::jsonb),
  (v_chapter_id, 'Erodstar',                                  'Talent competition event.',                                                  'cultural'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-02-14 17:00:00+05:30', '2021-02-14 21:00:00+05:30', ARRAY['competition', 'talent', '2021'], '{}'::jsonb),
  (v_chapter_id, 'TN MSME Summit 2021',                       '3-day summit hosted by CII Erode, led by D Senthil Kumar.',                  'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-25 09:00:00+05:30', '2021-03-27 18:00:00+05:30', ARRAY['cii', 'msme', 'business', '2021'], '{"duration": "3 days", "host": "CII Erode", "lead": "D Senthil Kumar"}'::jsonb),
  (v_chapter_id, 'Entrepreneurs Motivation Trip - Yercaud Coffee Estate', 'Motivational trip to coffee estate.',                            'social'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-03-13 06:00:00+05:30', '2021-03-13 20:00:00+05:30', ARRAY['learning', 'industry-visit', 'coffee', '2021'], '{}'::jsonb),
  (v_chapter_id, 'History Learning Session - Dr R K Vikrama Karna', 'Tamil history session by Dr R K Vikrama Karna.',                       'seminar'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-05-07 18:00:00+05:30', '2021-05-07 20:00:00+05:30', ARRAY['learning', 'history', 'tamil', '2021'], '{"speaker": "Dr R K Vikrama Karna"}'::jsonb),
  (v_chapter_id, 'Tambola Game - Cross Chapter',              'Social event organized by Yi Puducherry for Yi Erode.',                      'social'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-05-15 19:00:00+05:30', '2021-05-15 21:00:00+05:30', ARRAY['social', 'cross-chapter', 'puducherry', '2021'], '{"organized_by": "Yi Puducherry"}'::jsonb),
  (v_chapter_id, 'CATCH UP Campaign - CII Southern Region',   'COVID-19 response and school reopening campaign.',                           'community_service'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-04-23 10:00:00+05:30', '2021-04-23 13:00:00+05:30', ARRAY['covid', 'education', 'cii', '2021'], '{}'::jsonb),

  -- Sports Events 2021
  (v_chapter_id, 'Shooting Sports Session',                   'Session by national rifle shooter: You can become a shooter.',               'sports'::yi_connect.event_category, 'completed'::yi_connect.event_status, '2021-04-23 16:00:00+05:30', '2021-04-23 18:00:00+05:30', ARRAY['sports', 'shooting', 'learning', '2021'], '{"speaker": "National Rifle Shooter"}'::jsonb)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded second batch of 41 events for Yi Erode chapter';

  -- ════════════════════════════════════════════════════════════════
  -- APPROVED EMAILS (18 rows total: 2 original + 16 EC Team 2026)
  --
  -- Only inserted if director_uid found — approved_by is NOT NULL FK.
  -- ════════════════════════════════════════════════════════════════
  IF v_have_director THEN
    INSERT INTO yi_connect.approved_emails (email, approved_by, assigned_chapter_id, notes, is_active) VALUES
      -- From 20251220000005 (known WhatsApp members)
      ('sakthi@troobite.com',         v_director_id, v_chapter_id, 'Sakthi Vignessh - Yuva Co-Chair, Troobite',                       true),
      ('rathy@dataception.in',        v_director_id, v_chapter_id, 'Bhagirathy B - Yuva Joint Chair, Dataception',                    true),

      -- From 20251221000001 (EC Team 2026)
      -- MEMBERSHIP Vertical
      ('sharab2222@gmail.com',        v_director_id, v_chapter_id, 'Sharabhesh S - Membership Joint-Chair 2026',                      true),
      -- YUVA Vertical
      ('insurebaski@gmail.com',       v_director_id, v_chapter_id, 'Haribaskar - YUVA Joint-Chair 2026, Kongu Engineering',           true),
      -- THALIR Vertical
      ('viyasjanani@gmail.com',       v_director_id, v_chapter_id, 'Viyas Janani - Thalir Joint-Chair 2026',                          true),
      ('srimathi3084@gmail.com',      v_director_id, v_chapter_id, 'Srimathi - Thalir Joint-Chair 2026',                              true),
      -- ACCESSIBILITY Vertical
      ('nkrj93@gmail.com',            v_director_id, v_chapter_id, 'Naveen Kumar - Accessibility Chair 2026',                         true),
      -- CLIMATE CHANGE Vertical
      ('praadeepgenius@gmail.com',    v_director_id, v_chapter_id, 'Pradeep - Climate Change Chair 2026',                             true),
      ('mithun@prdrigs.com',          v_director_id, v_chapter_id, 'Mithunraj - Climate Change Co-Chair 2026, PRD Rigs',              true),
      ('balamuruganselvakumar@gmail.com', v_director_id, v_chapter_id, 'Balamurugaan - Climate Change Co-Chair 2026',                 true),
      -- ENTREPRENEURSHIP Vertical
      ('amdineshca@gmail.com',        v_director_id, v_chapter_id, 'Mohandinesh - Entrepreneurship Chair 2026',                       true),
      ('yaallal2017@gmail.com',       v_director_id, v_chapter_id, 'Yall - Entrepreneurship Co-Chair 2026',                           true),
      -- HEALTH Vertical
      ('isvarya@jkkn.ac.in',          v_director_id, v_chapter_id, 'Isvarya K - Health Joint-Chair 2026, JKKN',                       true),
      -- INNOVATION Vertical
      ('keerthu005@gmail.com',        v_director_id, v_chapter_id, 'Keerthana - Innovation Joint-Chair 2026',                         true),
      -- MASOOM Vertical
      ('shalinimohana1206@gmail.com', v_director_id, v_chapter_id, 'Shalini - MASOOM Chair 2026',                                     true),
      -- ROAD SAFETY Vertical
      ('kavinrt@gmail.com',           v_director_id, v_chapter_id, 'Kavinraj - Road Safety Joint-Chair 2026',                         true),
      -- VARNAM VIZHA Vertical
      ('deepaksmj@gmail.com',         v_director_id, v_chapter_id, 'Deepak - Varnam Vizha Chair 2026',                                true),
      -- LEARNING Vertical
      ('mohanapriyamathi@gmail.com',  v_director_id, v_chapter_id, 'Mohanapriya - Learning Joint-Chair 2026',                         true)
    ON CONFLICT (email) DO NOTHING;

    RAISE NOTICE 'Seeded 18 approved emails for Yi Erode chapter';
  ELSE
    RAISE NOTICE 'Skipped approved_emails inserts — director uid not available.';
  END IF;

  RAISE NOTICE 'Yi Erode seed migration complete.';
END $$;
