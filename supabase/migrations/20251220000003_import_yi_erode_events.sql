-- ================================================
-- Yi Erode Events Import
-- Run in Supabase SQL Editor
-- Generated: 2025-12-20
-- ================================================

-- Import key 2025 events and notable historical events
DO $$
DECLARE
  v_chapter_id UUID;
BEGIN
  SELECT id INTO v_chapter_id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Yi Erode chapter not found. Please create chapter first.';
  END IF;

  -- Insert 2025 Events (accurate dates)
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
  -- 2025 Key Events
  (v_chapter_id, 'Diwali Damakka 2025', 'Annual Diwali celebration with crackers, music concert, and dinner. District Collector attended.', 'cultural', 'completed',
   '2025-10-12 17:00:00+05:30', '2025-10-12 22:00:00+05:30',
   ARRAY['diwali', 'cultural', 'family', '2025'],
   '{"impact": "28+ families attended", "vip_attendance": "District Collector"}'::jsonb),

  (v_chapter_id, 'Erode Varnam Vizha 2025 - Thiran Ottam', 'Community run event as part of Erode Varnam Vizha celebrations.', 'sports', 'completed',
   '2025-10-11 06:00:00+05:30', '2025-10-11 09:00:00+05:30',
   ARRAY['run', 'sports', 'varnam-vizha', '2025'],
   '{}'::jsonb),

  (v_chapter_id, 'MASOOM TOT Session 2025', 'Train-the-Trainer session on Child Sexual Abuse Awareness. First of its kind in SRTN region.', 'workshop', 'completed',
   '2025-10-17 10:00:00+05:30', '2025-10-17 16:00:00+05:30',
   ARRAY['masoom', 'tot', 'child-safety', 'training', '2025'],
   '{"impact": {"schools": 7, "teachers_trained": 69}, "speaker": "Dr. Ashwini N. V."}'::jsonb),

  (v_chapter_id, 'E-Waste Collection Campaign', 'Partnership with Ascent Urban Recyclers and OEF for e-waste collection across Erode.', 'community_service', 'ongoing',
   '2025-10-21 00:00:00+05:30', '2025-11-14 23:59:00+05:30',
   ARRAY['climate-change', 'e-waste', 'environment', '2025'],
   '{"partners": ["Ascent Urban Recyclers", "OEF"]}'::jsonb),

  (v_chapter_id, 'HUM5 Running Challenge', 'National initiative - 70km run in 5 days with prizes worth 3 lakh.', 'sports', 'completed',
   '2025-11-05 05:00:00+05:30', '2025-11-09 20:00:00+05:30',
   ARRAY['hum5', 'running', 'health', 'national', '2025'],
   '{"challenge": "70km in 5 days", "prizes": "Worth 3 lakh"}'::jsonb),

  (v_chapter_id, 'Stories from the Top - V R Muthu', 'CII Erode Learning Series with Idhayam Chairman at Hotel Rathna Residency.', 'seminar', 'completed',
   '2025-10-25 18:00:00+05:30', '2025-10-25 21:00:00+05:30',
   ARRAY['learning', 'cii', 'business', '2025'],
   '{"speaker": "V R Muthu, Idhayam Chairman", "venue": "Hotel Rathna Residency, Erode"}'::jsonb),

  -- 2021 Notable Events (historical record)
  (v_chapter_id, 'Tree Plantation Drive 2021', 'Climate change initiative with 2850 saplings planted across Erode.', 'community_service', 'completed',
   '2021-06-05 08:00:00+05:30', '2021-06-05 12:00:00+05:30',
   ARRAY['climate-change', 'tree-plantation', '2021'],
   '{"impact": {"saplings_planted": 2850}}'::jsonb),

  (v_chapter_id, '5K Run 2021', 'Annual 5K run event for Yi Erode members and families.', 'sports', 'completed',
   '2021-01-26 06:00:00+05:30', '2021-01-26 09:00:00+05:30',
   ARRAY['sports', 'run', '5k', '2021'],
   '{}'::jsonb),

  (v_chapter_id, 'Pongal Vizha 2021', 'Traditional Pongal celebration with members.', 'cultural', 'completed',
   '2021-01-14 10:00:00+05:30', '2021-01-14 14:00:00+05:30',
   ARRAY['pongal', 'cultural', '2021'],
   '{}'::jsonb),

  (v_chapter_id, 'Pool Party Holi 2021', 'Family event with games and dinner.', 'social', 'completed',
   '2021-03-28 16:00:00+05:30', '2021-03-28 21:00:00+05:30',
   ARRAY['holi', 'social', 'family', '2021'],
   '{}'::jsonb),

  (v_chapter_id, 'Blood Donation Drive 2021', 'Health camp in memory of Past Chair Shanmugam''s aunt.', 'community_service', 'completed',
   '2021-03-26 09:00:00+05:30', '2021-03-26 15:00:00+05:30',
   ARRAY['health', 'blood-donation', '2021'],
   '{"in_memory_of": "Past Chair Shanmugam aunt"}'::jsonb),

  (v_chapter_id, 'Singalila Ridge Trek 2021', 'First Yi Trek - Darjeeling to Sandakphu adventure.', 'sports', 'completed',
   '2021-04-23 06:00:00+05:30', '2021-04-27 18:00:00+05:30',
   ARRAY['trek', 'adventure', 'sports', '2021'],
   '{"route": "Darjeeling to Sandakphu", "note": "First Yi Trek"}'::jsonb),

  (v_chapter_id, 'COVID Vaccine Priority Access 2021', 'CII-Yi initiative providing vaccine access for members and employees.', 'community_service', 'completed',
   '2021-05-01 09:00:00+05:30', '2021-07-31 18:00:00+05:30',
   ARRAY['covid', 'health', 'vaccination', '2021'],
   '{"initiative": "CII-Yi"}'::jsonb),

  (v_chapter_id, 'Sai Krupa Special School Visit 2021', 'Walk in my shoes - interaction with special children at Tirupur.', 'community_service', 'completed',
   '2021-03-20 09:00:00+05:30', '2021-03-20 16:00:00+05:30',
   ARRAY['thalir', 'special-children', '2021'],
   '{"location": "Tirupur", "theme": "Walk in my shoes"}'::jsonb),

  (v_chapter_id, 'Show the Ink Campaign 2021', 'Voting encouragement - 20 brands offered 10% discount for voters.', 'community_service', 'completed',
   '2021-04-06 00:00:00+05:30', '2021-04-10 23:59:00+05:30',
   ARRAY['voting', 'awareness', '2021'],
   '{"impact": "20 brands, 10% discount"}'::jsonb)

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Imported 15 key events for Yi Erode chapter';
END $$;

-- Verify import
SELECT
  title,
  category,
  status,
  start_date::date as event_date,
  tags
FROM events
WHERE chapter_id = (SELECT id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1)
ORDER BY start_date DESC;
