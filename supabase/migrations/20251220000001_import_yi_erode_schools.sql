-- ================================================
-- Yi Erode Schools Import
-- Run in Supabase SQL Editor
-- Generated: 2025-12-20
-- ================================================

-- Get Yi Erode chapter ID
DO $$
DECLARE
  v_chapter_id UUID;
BEGIN
  SELECT id INTO v_chapter_id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Yi Erode chapter not found. Please create chapter first.';
  END IF;

  -- Insert schools
  INSERT INTO schools (
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
  (v_chapter_id, 'Railway Colony Corp Primary School', 'primary', 'Erode', 'Government', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 80 students'),
  (v_chapter_id, 'Kollampalayam Corp School', 'primary', 'Erode', 'Government', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 78 students'),
  (v_chapter_id, 'Edayankaatuvalasu Govt Primary School', 'primary', 'Erode', 'Government', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 45 students'),
  (v_chapter_id, 'Veerapan Chatram Panchayat Union School', 'primary', 'Erode', 'Government', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 33 students'),
  (v_chapter_id, 'Manikampalayam Govt Primary School', 'primary', 'Erode', 'Government', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 60 students'),
  (v_chapter_id, 'Manikampalayam Boys High School', 'high_school', 'Erode', 'Government', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 40 students'),
  (v_chapter_id, 'Teacher''s Colony Higher Secondary School', 'high_school', 'Erode', 'Government', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 50 students'),
  (v_chapter_id, 'Government Model School', 'state_board', 'Erode', 'Government', ARRAY['MASOOM'], 'prospective', 'cold', 'New target school'),

  -- Private Schools (12)
  (v_chapter_id, 'Maharishi Vidya Mandir', 'cbse', 'Erode', 'Private', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 200 students'),
  (v_chapter_id, 'Lions Matriculation', 'matric', 'Erode', 'Private', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 100 students'),
  (v_chapter_id, 'Rajendran Academy', 'matric', 'Erode', 'Private', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 100 students'),
  (v_chapter_id, 'CS Academy', 'matric', 'Erode', 'Private', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 100 students'),
  (v_chapter_id, 'Erode Public School', 'cbse', 'Erode', 'Private', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 100 students'),
  (v_chapter_id, 'SSM Primary School', 'matric', 'Komarapalayam', 'Private', ARRAY['MASOOM'], 'active', 'direct', 'MASOOM session completed: 200 students'),
  (v_chapter_id, 'JKK Rangammal School', 'cbse', 'Komarapalayam', 'Private', ARRAY['MASOOM', 'Thalir'], 'active', 'through_member', 'MASOOM Model School - Completed. JKKN internal.'),
  (v_chapter_id, 'JKK Nataraja School', 'cbse', 'Komarapalayam', 'Private', ARRAY['MASOOM', 'Thalir'], 'active', 'through_member', 'MASOOM Model School - Completed. JKKN internal.'),
  (v_chapter_id, 'RTD International School', 'international', 'Erode', 'Private', ARRAY['MASOOM'], 'prospective', 'cold', 'Call in January'),
  (v_chapter_id, 'Dr Kids/Prerna', 'primary', 'Erode', 'Private', ARRAY['MASOOM'], 'prospective', 'cold', 'New target school'),
  (v_chapter_id, 'Spectrum School', 'cbse', 'Erode', 'Private', ARRAY['MASOOM'], 'prospective', 'cold', 'New target school'),
  (v_chapter_id, 'Narayana School', 'cbse', 'Erode', 'Private', ARRAY['MASOOM'], 'prospective', 'cold', 'New target school')

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Imported 20 schools for Yi Erode chapter';
END $$;

-- Verify import
SELECT
  school_name,
  school_type,
  management_type,
  city,
  status,
  suitable_programs
FROM schools
WHERE chapter_id = (SELECT id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1)
ORDER BY school_name;
