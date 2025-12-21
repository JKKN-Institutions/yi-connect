-- ================================================
-- Yi Erode ALL Events Import (60 remaining)
-- Run in Supabase SQL Editor
-- Generated: 2025-12-20
-- ================================================

DO $$
DECLARE
  v_chapter_id UUID;
BEGIN
  SELECT id INTO v_chapter_id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Yi Erode chapter not found. Please create chapter first.';
  END IF;

  -- Insert remaining 2021 events (not already imported)
  INSERT INTO events (
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
  (v_chapter_id, 'MASOOM Session - Rajendra CBSE School', 'Child safety awareness session at Rajendra CBSE School.', 'workshop', 'completed',
   '2021-01-15 10:00:00+05:30', '2021-01-15 12:00:00+05:30',
   ARRAY['masoom', 'child-safety', 'school', '2021'], '{}'::jsonb),

  (v_chapter_id, 'MASOOM Session - Rajendra Matric School', 'Child safety awareness session at Rajendra Matric School.', 'workshop', 'completed',
   '2021-01-16 10:00:00+05:30', '2021-01-16 12:00:00+05:30',
   ARRAY['masoom', 'child-safety', 'school', '2021'], '{}'::jsonb),

  (v_chapter_id, 'MASOOM Session - Lions Matric School', 'Child safety awareness session at Lions Matric School.', 'workshop', 'completed',
   '2021-01-17 10:00:00+05:30', '2021-01-17 12:00:00+05:30',
   ARRAY['masoom', 'child-safety', 'school', '2021'], '{}'::jsonb),

  (v_chapter_id, 'MASOOM - Agasthiya International School', 'Child safety awareness session at Agasthiya International School.', 'workshop', 'completed',
   '2021-02-10 10:00:00+05:30', '2021-02-10 12:00:00+05:30',
   ARRAY['masoom', 'child-safety', 'international-school', '2021'], '{}'::jsonb),

  (v_chapter_id, 'MASOOM for Rural Women - Kulur', 'Child safety awareness for rural women in Kulur village.', 'workshop', 'completed',
   '2021-03-15 10:00:00+05:30', '2021-03-15 13:00:00+05:30',
   ARRAY['masoom', 'rural', 'women-empowerment', '2021'], '{}'::jsonb),

  -- Thalir Events 2021
  (v_chapter_id, 'Story Telling Session - JKKN School', 'Interactive story telling session for students.', 'workshop', 'completed',
   '2021-01-20 10:00:00+05:30', '2021-01-20 12:00:00+05:30',
   ARRAY['thalir', 'storytelling', 'school', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Selfie with Daughter', 'Father-daughter bonding awareness campaign.', 'community_service', 'completed',
   '2021-01-25 09:00:00+05:30', '2021-01-25 18:00:00+05:30',
   ARRAY['thalir', 'awareness', 'family', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Industry Visit - Milkymist', 'Students visit to Milkymist dairy plant.', 'workshop', 'completed',
   '2021-02-15 09:00:00+05:30', '2021-02-15 14:00:00+05:30',
   ARRAY['thalir', 'industry-visit', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Thalir MoU - JKKN Matriculation School', 'MoU signing with JKKN Matriculation School for Thalir programs.', 'seminar', 'completed',
   '2021-02-20 11:00:00+05:30', '2021-02-20 12:00:00+05:30',
   ARRAY['thalir', 'mou', 'jkkn', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Thalir MoU - SSM Nursery and Primary School', 'MoU signing with SSM School for Thalir programs.', 'seminar', 'completed',
   '2021-02-21 11:00:00+05:30', '2021-02-21 12:00:00+05:30',
   ARRAY['thalir', 'mou', 'ssm', '2021'], '{}'::jsonb),

  (v_chapter_id, 'National Science Day - Peeku Bird Park Visit', 'Educational visit to bird park on National Science Day.', 'workshop', 'completed',
   '2021-02-28 09:00:00+05:30', '2021-02-28 16:00:00+05:30',
   ARRAY['thalir', 'science-day', 'educational', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Chennai Rice Industry Visit', 'Industrial visit to rice processing unit. 7500 tonnes storage capacity.', 'workshop', 'completed',
   '2021-03-30 08:00:00+05:30', '2021-03-30 17:00:00+05:30',
   ARRAY['thalir', 'industry-visit', '2021'],
   '{"impact": "7500 tonnes storage capacity tour"}'::jsonb),

  (v_chapter_id, 'Career Guidance - Shri Mahaa & Maharishi Vidya Mandir', 'Career guidance session for school students.', 'workshop', 'completed',
   '2021-03-10 10:00:00+05:30', '2021-03-10 13:00:00+05:30',
   ARRAY['thalir', 'career-guidance', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Poem Writing Competition', 'Cross-chapter poem writing competition.', 'cultural', 'completed',
   '2021-04-10 10:00:00+05:30', '2021-04-10 17:00:00+05:30',
   ARRAY['thalir', 'competition', 'poetry', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Children in New Normal - Pandemic Session', 'Panel session on child wellness during pandemic. Doctors, nutritionists, mental wellness experts.', 'workshop', 'completed',
   '2021-05-22 10:00:00+05:30', '2021-05-22 13:00:00+05:30',
   ARRAY['thalir', 'covid', 'mental-health', '2021'],
   '{"panel": "Doctor, Nutritionist, Mental Wellness"}'::jsonb),

  -- Climate Change Events 2021
  (v_chapter_id, 'Wall Painting at VOC Park', 'Climate awareness wall painting at VOC Park.', 'community_service', 'completed',
   '2021-01-30 08:00:00+05:30', '2021-01-30 14:00:00+05:30',
   ARRAY['climate-change', 'art', 'awareness', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Chithiram Wall Painting', 'Environmental awareness wall painting campaign.', 'community_service', 'completed',
   '2021-02-25 08:00:00+05:30', '2021-02-25 14:00:00+05:30',
   ARRAY['climate-change', 'art', 'awareness', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Earth Hour Observance', 'Lights off from 8:30-9:30pm, lit diyas instead.', 'community_service', 'completed',
   '2021-03-27 20:30:00+05:30', '2021-03-27 21:30:00+05:30',
   ARRAY['climate-change', 'earth-hour', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Sapling Plantation - Kanagamalai Village', 'Tree plantation drive at Kanagamalai village.', 'community_service', 'completed',
   '2021-04-01 07:00:00+05:30', '2021-04-01 11:00:00+05:30',
   ARRAY['climate-change', 'tree-plantation', 'rural', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Tree Plantation - Vellalar School', 'Earth Day plantation with 120 saplings planted by 12th graders.', 'community_service', 'completed',
   '2021-04-22 08:00:00+05:30', '2021-04-22 12:00:00+05:30',
   ARRAY['climate-change', 'earth-day', 'school', '2021'],
   '{"impact": {"saplings_planted": 120}}'::jsonb),

  -- Health Events 2021
  (v_chapter_id, 'Cancer Awareness - Sengundhar School', 'Cancer awareness session for students.', 'workshop', 'completed',
   '2021-02-04 10:00:00+05:30', '2021-02-04 12:00:00+05:30',
   ARRAY['health', 'cancer-awareness', 'school', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Health Checkup for Drivers - Vijayamangalam Toll Gate', 'Free health checkup for truck drivers.', 'community_service', 'completed',
   '2021-02-08 09:00:00+05:30', '2021-02-08 15:00:00+05:30',
   ARRAY['health', 'drivers', 'health-camp', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Eye Check Up Camp - Kulur Village', 'Free eye checkup camp for villagers.', 'community_service', 'completed',
   '2021-03-05 09:00:00+05:30', '2021-03-05 16:00:00+05:30',
   ARRAY['health', 'eye-camp', 'rural', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Cervical Cancer Awareness - Kamraj Nagar', 'Women''s health awareness session in Kamraj Nagar.', 'workshop', 'completed',
   '2021-03-08 10:00:00+05:30', '2021-03-08 13:00:00+05:30',
   ARRAY['health', 'cancer-awareness', 'women', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Dental Hygiene Session - Rajendra Schools', 'Dental hygiene awareness by Dr. C.S. Sri Darshini, MDS.', 'workshop', 'completed',
   '2021-03-26 10:00:00+05:30', '2021-03-26 12:00:00+05:30',
   ARRAY['health', 'dental', 'school', '2021'],
   '{"speaker": "Dr. C.S. Sri Darshini, MDS"}'::jsonb),

  -- Road Safety Events 2021
  (v_chapter_id, 'Road Safety Awareness - Vijayalingam Toll Gate', 'Road safety awareness for drivers at toll gate.', 'community_service', 'completed',
   '2021-02-01 09:00:00+05:30', '2021-02-01 14:00:00+05:30',
   ARRAY['road-safety', 'drivers', 'awareness', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Kuttycop Session with Police Department', 'Road safety session in collaboration with police.', 'workshop', 'completed',
   '2021-02-22 10:00:00+05:30', '2021-02-22 13:00:00+05:30',
   ARRAY['road-safety', 'kuttycop', 'police', '2021'], '{}'::jsonb),

  -- Rural Initiative 2021
  (v_chapter_id, 'Women Empowerment Session - Kulur', 'Women empowerment and skill development session in Kulur village.', 'workshop', 'completed',
   '2021-03-14 10:00:00+05:30', '2021-03-14 14:00:00+05:30',
   ARRAY['rural', 'women-empowerment', '2021'], '{}'::jsonb),

  -- Yuva Sessions 2021
  (v_chapter_id, 'Yuva Session - Mr Fizal Ahmed, MD Suxus', 'Entrepreneurship session by Fizal Ahmed for college students.', 'seminar', 'completed',
   '2021-01-22 14:00:00+05:30', '2021-01-22 17:00:00+05:30',
   ARRAY['yuva', 'entrepreneurship', 'learning', '2021'],
   '{"speaker": "Mr Fizal Ahmed, MD Suxus"}'::jsonb),

  (v_chapter_id, 'Yuva Session - Karthikeyan from Unibic Foods', 'Success story session at Kongu Business School. 105 students attended.', 'seminar', 'completed',
   '2021-03-20 14:00:00+05:30', '2021-03-20 17:00:00+05:30',
   ARRAY['yuva', 'learning', 'success-story', '2021'],
   '{"speaker": "Karthikeyan, Unibic Foods", "impact": {"students": 105}, "venue": "Kongu Business School"}'::jsonb),

  (v_chapter_id, 'Yuva Session - NLP Coach Sharmila', 'Session on confidence building: Am I Confident or Confused.', 'seminar', 'completed',
   '2021-04-16 14:00:00+05:30', '2021-04-16 17:00:00+05:30',
   ARRAY['yuva', 'nlp', 'confidence', '2021'],
   '{"speaker": "NLP Coach Sharmila", "topic": "Am I Confident or Confused"}'::jsonb),

  -- Learning & Business Events 2021
  (v_chapter_id, 'Yi Erode Movie Night', 'Social bonding event with members and families.', 'social', 'completed',
   '2021-01-23 18:00:00+05:30', '2021-01-23 22:00:00+05:30',
   ARRAY['social', 'family', 'bonding', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Just a Minute Competition', 'Public speaking competition for members.', 'cultural', 'completed',
   '2021-01-28 18:00:00+05:30', '2021-01-28 21:00:00+05:30',
   ARRAY['learning', 'competition', 'public-speaking', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Yi Erode Pathfinder 2021', 'Annual planning session for the year.', 'seminar', 'completed',
   '2021-01-10 09:00:00+05:30', '2021-01-10 17:00:00+05:30',
   ARRAY['planning', 'pathfinder', '2021'], '{}'::jsonb),

  (v_chapter_id, 'Erodstar', 'Talent competition event.', 'cultural', 'completed',
   '2021-02-14 17:00:00+05:30', '2021-02-14 21:00:00+05:30',
   ARRAY['competition', 'talent', '2021'], '{}'::jsonb),

  (v_chapter_id, 'TN MSME Summit 2021', '3-day summit hosted by CII Erode, led by D Senthil Kumar.', 'seminar', 'completed',
   '2021-03-25 09:00:00+05:30', '2021-03-27 18:00:00+05:30',
   ARRAY['cii', 'msme', 'business', '2021'],
   '{"duration": "3 days", "host": "CII Erode", "lead": "D Senthil Kumar"}'::jsonb),

  (v_chapter_id, 'Entrepreneurs Motivation Trip - Yercaud Coffee Estate', 'Motivational trip to coffee estate.', 'social', 'completed',
   '2021-03-13 06:00:00+05:30', '2021-03-13 20:00:00+05:30',
   ARRAY['learning', 'industry-visit', 'coffee', '2021'], '{}'::jsonb),

  (v_chapter_id, 'History Learning Session - Dr R K Vikrama Karna', 'Tamil history session by Dr R K Vikrama Karna.', 'seminar', 'completed',
   '2021-05-07 18:00:00+05:30', '2021-05-07 20:00:00+05:30',
   ARRAY['learning', 'history', 'tamil', '2021'],
   '{"speaker": "Dr R K Vikrama Karna"}'::jsonb),

  (v_chapter_id, 'Tambola Game - Cross Chapter', 'Social event organized by Yi Puducherry for Yi Erode.', 'social', 'completed',
   '2021-05-15 19:00:00+05:30', '2021-05-15 21:00:00+05:30',
   ARRAY['social', 'cross-chapter', 'puducherry', '2021'],
   '{"organized_by": "Yi Puducherry"}'::jsonb),

  (v_chapter_id, 'CATCH UP Campaign - CII Southern Region', 'COVID-19 response and school reopening campaign.', 'community_service', 'completed',
   '2021-04-23 10:00:00+05:30', '2021-04-23 13:00:00+05:30',
   ARRAY['covid', 'education', 'cii', '2021'], '{}'::jsonb),

  -- Sports Events 2021
  (v_chapter_id, 'Shooting Sports Session', 'Session by national rifle shooter: You can become a shooter.', 'sports', 'completed',
   '2021-04-23 16:00:00+05:30', '2021-04-23 18:00:00+05:30',
   ARRAY['sports', 'shooting', 'learning', '2021'],
   '{"speaker": "National Rifle Shooter"}'::jsonb)

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Imported remaining events for Yi Erode chapter';
END $$;

-- Verify import
SELECT
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM start_date) = 2021) as events_2021,
  COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM start_date) = 2025) as events_2025
FROM events
WHERE chapter_id = (SELECT id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1);
