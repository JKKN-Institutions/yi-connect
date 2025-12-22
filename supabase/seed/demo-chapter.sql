/**
 * Demo Chapter Seed Data
 *
 * Creates Yi DemoChapter with sample data for chapter leaders to demo the system.
 * Includes: Chapter, Demo Accounts (Chair, Co-Chair, EC Member), Members, Events,
 * Verticals, and Stakeholders.
 *
 * Run this in Supabase SQL editor after the main migrations.
 *
 * Demo Accounts (use magic links):
 * - demo-chair@yi-demo.com → Chair role
 * - demo-cochair@yi-demo.com → Co-Chair role
 * - demo-ec@yi-demo.com → EC Member role
 */

-- ============================================================================
-- 1. CREATE DEMO CHAPTER
-- ============================================================================

INSERT INTO public.chapters (
  id,
  name,
  location,
  region,
  established_date,
  member_count,
  status,
  settings,
  created_at
) VALUES (
  'de000001-0000-4000-a000-000000000001'::UUID,
  'Yi DemoChapter',
  'Demo City',
  'SRTN',
  '2024-01-15',
  12,
  'active',
  '{"demo_mode": true}'::JSONB,
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  settings = EXCLUDED.settings;

-- ============================================================================
-- 2. APPROVED EMAILS FOR DEMO ACCOUNTS
-- ============================================================================

-- First, get an admin user ID for approved_by (use existing National Admin or Super Admin)
DO $$
DECLARE
  v_admin_id UUID;
  v_chapter_id UUID := 'de000001-0000-4000-a000-000000000001'::UUID;
BEGIN
  -- Try to find an existing admin
  SELECT ur.user_id INTO v_admin_id
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE r.hierarchy_level >= 6
  LIMIT 1;

  -- If no admin found, use the first profile
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.profiles LIMIT 1;
  END IF;

  -- If still null, we can't proceed (need at least one user)
  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No existing users found. Please create at least one admin user first.';
    RETURN;
  END IF;

  -- Insert approved emails for demo accounts
  INSERT INTO public.approved_emails (email, approved_by, assigned_chapter_id, notes, is_active)
  VALUES
    ('demo-chair@yi-demo.com', v_admin_id, v_chapter_id, 'Demo Chair account for chapter demos', TRUE),
    ('demo-cochair@yi-demo.com', v_admin_id, v_chapter_id, 'Demo Co-Chair account for chapter demos', TRUE),
    ('demo-ec@yi-demo.com', v_admin_id, v_chapter_id, 'Demo EC Member account for chapter demos', TRUE)
  ON CONFLICT (email) DO UPDATE SET
    assigned_chapter_id = EXCLUDED.assigned_chapter_id,
    is_active = TRUE,
    notes = EXCLUDED.notes;

  RAISE NOTICE 'Demo emails approved successfully';
END $$;

-- ============================================================================
-- 3. INITIALIZE FEATURE TOGGLES FOR DEMO CHAPTER
-- ============================================================================

INSERT INTO public.chapter_feature_toggles (chapter_id, feature, is_enabled, enabled_at)
VALUES
  ('de000001-0000-4000-a000-000000000001', 'events', TRUE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'communications', TRUE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'stakeholder_crm', TRUE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'verticals', TRUE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'awards', TRUE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'analytics', TRUE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'finance', FALSE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'session_bookings', FALSE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'opportunities', FALSE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'knowledge_base', FALSE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'member_intelligence', FALSE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'succession_planning', FALSE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'sub_chapters', FALSE, NOW()),
  ('de000001-0000-4000-a000-000000000001', 'industrial_visits', FALSE, NOW())
ON CONFLICT (chapter_id, feature) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled;

-- ============================================================================
-- 4. CREATE SAMPLE VERTICALS
-- ============================================================================

INSERT INTO public.verticals (id, chapter_id, name, slug, description, color, icon, is_active, display_order)
VALUES
  (
    'ee000001-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'MASOOM',
    'masoom',
    'Making Schools Safe, Oriented and Motivated - Child safety awareness program',
    '#EF4444',
    'shield',
    TRUE,
    1
  ),
  (
    'ee000002-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Yuva',
    'yuva',
    'Youth empowerment and skill development for college students',
    '#3B82F6',
    'users',
    TRUE,
    2
  ),
  (
    'ee000003-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Climate Action',
    'climate',
    'Environmental sustainability and climate awareness initiatives',
    '#22C55E',
    'leaf',
    TRUE,
    3
  ),
  (
    'ee000004-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Road Safety',
    'road-safety',
    'Road safety awareness and accident prevention campaigns',
    '#F59E0B',
    'alert-triangle',
    TRUE,
    4
  )
ON CONFLICT (chapter_id, slug) DO NOTHING;

-- ============================================================================
-- 5. CREATE SAMPLE EVENTS
-- ============================================================================

INSERT INTO public.events (
  id,
  chapter_id,
  title,
  description,
  category,
  status,
  start_date,
  end_date,
  venue_name,
  venue_address,
  venue_city,
  max_attendees,
  is_public,
  registration_required
)
VALUES
  -- Past Events
  (
    'ef000001-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'MASOOM School Awareness Session',
    'Child safety awareness session conducted at local government school. 250 students participated.',
    'masoom',
    'completed',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days' + INTERVAL '3 hours',
    'Government High School',
    'Main Road',
    'Demo City',
    300,
    FALSE,
    FALSE
  ),
  (
    'ef000002-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Yuva Career Guidance Workshop',
    'Career counseling session for final year engineering students. Featured industry experts from IT and Manufacturing.',
    'yuva',
    'completed',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days' + INTERVAL '4 hours',
    'Engineering College Auditorium',
    'College Road',
    'Demo City',
    200,
    TRUE,
    TRUE
  ),
  (
    'ef000003-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Tree Plantation Drive',
    'Planted 500 saplings in the city outskirts with local community participation.',
    'climate_action',
    'completed',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days' + INTERVAL '5 hours',
    'City Forest Reserve',
    'Outer Ring Road',
    'Demo City',
    100,
    TRUE,
    TRUE
  ),
  -- Upcoming Events
  (
    'ef000004-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Monthly Chapter Meeting',
    'Regular monthly meeting to discuss upcoming initiatives and review progress.',
    'chapter_meeting',
    'confirmed',
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '5 days' + INTERVAL '2 hours',
    'Chapter Office',
    'Business District',
    'Demo City',
    50,
    FALSE,
    TRUE
  ),
  (
    'ef000005-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Road Safety Helmet Awareness Rally',
    'Motorcycle rally to spread awareness about helmet safety. Expected 200+ participants.',
    'road_safety',
    'confirmed',
    NOW() + INTERVAL '10 days',
    NOW() + INTERVAL '10 days' + INTERVAL '4 hours',
    'City Center',
    'Main Circle',
    'Demo City',
    300,
    TRUE,
    TRUE
  ),
  (
    'ef000006-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Yi Connect Platform Training',
    'Training session for chapter members on using the Yi Connect platform effectively.',
    'workshop',
    'draft',
    NOW() + INTERVAL '15 days',
    NOW() + INTERVAL '15 days' + INTERVAL '3 hours',
    'Co-working Space',
    'Tech Park',
    'Demo City',
    30,
    FALSE,
    TRUE
  ),
  (
    'ef000007-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Yuva Entrepreneurship Bootcamp',
    'Two-day intensive bootcamp for aspiring young entrepreneurs. Featuring startup mentors.',
    'yuva',
    'confirmed',
    NOW() + INTERVAL '25 days',
    NOW() + INTERVAL '26 days',
    'Innovation Hub',
    'Startup Valley',
    'Demo City',
    100,
    TRUE,
    TRUE
  ),
  (
    'ef000008-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Regional Chapter Conclave',
    'Annual gathering of all SRTN region chapters. Networking and best practices sharing.',
    'conclave',
    'confirmed',
    NOW() + INTERVAL '45 days',
    NOW() + INTERVAL '46 days',
    'Convention Center',
    'Exhibition Road',
    'Demo City',
    500,
    FALSE,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. CREATE SAMPLE STAKEHOLDERS - SCHOOLS
-- ============================================================================

INSERT INTO public.schools (
  id,
  chapter_id,
  school_name,
  school_type,
  address_line1,
  city,
  state,
  phone,
  email,
  connection_type,
  student_strength,
  principal_name,
  principal_phone,
  masoom_sessions_conducted,
  last_session_date,
  engagement_level
)
VALUES
  (
    'ec000001-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Government Higher Secondary School',
    'government',
    'Main Road, Near Bus Stand',
    'Demo City',
    'Tamil Nadu',
    '0422-1234567',
    'ghss-demo@tn.gov.in',
    'warm',
    1200,
    'Mr. Ramesh Kumar',
    '9876543210',
    3,
    NOW() - INTERVAL '30 days',
    'high'
  ),
  (
    'ec000002-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'St. Mary''s Matriculation School',
    'private',
    'Church Street',
    'Demo City',
    'Tamil Nadu',
    '0422-2345678',
    'info@stmarysdemo.edu.in',
    'hot',
    800,
    'Sr. Maria Francis',
    '9876543211',
    5,
    NOW() - INTERVAL '15 days',
    'high'
  ),
  (
    'ec000003-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'DAV Public School',
    'private',
    'Industrial Area',
    'Demo City',
    'Tamil Nadu',
    '0422-3456789',
    'principal@davdemo.edu.in',
    'cold',
    600,
    'Mr. Suresh Babu',
    '9876543212',
    0,
    NULL,
    'low'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. CREATE SAMPLE STAKEHOLDERS - COLLEGES
-- ============================================================================

INSERT INTO public.colleges (
  id,
  chapter_id,
  college_name,
  college_type,
  affiliation,
  address_line1,
  city,
  state,
  phone,
  email,
  website,
  connection_type,
  student_strength,
  principal_name,
  principal_phone,
  yuva_programs_conducted,
  last_program_date,
  engagement_level
)
VALUES
  (
    'ed000001-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Demo Engineering College',
    'engineering',
    'Anna University',
    'College Road',
    'Demo City',
    'Tamil Nadu',
    '0422-4567890',
    'principal@demoengcollege.edu.in',
    'www.demoengcollege.edu.in',
    'hot',
    2500,
    'Dr. Venkatesh',
    '9876543220',
    4,
    NOW() - INTERVAL '20 days',
    'high'
  ),
  (
    'ed000002-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Demo Arts & Science College',
    'arts_science',
    'Bharathiar University',
    'University Road',
    'Demo City',
    'Tamil Nadu',
    '0422-5678901',
    'info@demoarts.edu.in',
    'www.demoarts.edu.in',
    'warm',
    1800,
    'Dr. Lakshmi Devi',
    '9876543221',
    2,
    NOW() - INTERVAL '45 days',
    'medium'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. UPDATE CHAPTER MEMBER COUNT
-- ============================================================================

UPDATE public.chapters
SET member_count = 12
WHERE id = 'de000001-0000-4000-a000-000000000001';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Uncomment these to verify the seed data:

-- SELECT 'Chapters' as table_name, COUNT(*) as count FROM chapters WHERE id = 'de000001-0000-4000-a000-000000000001'
-- UNION ALL
-- SELECT 'Approved Emails', COUNT(*) FROM approved_emails WHERE email LIKE 'demo-%@yi-demo.com'
-- UNION ALL
-- SELECT 'Feature Toggles', COUNT(*) FROM chapter_feature_toggles WHERE chapter_id = 'de000001-0000-4000-a000-000000000001'
-- UNION ALL
-- SELECT 'Verticals', COUNT(*) FROM verticals WHERE chapter_id = 'de000001-0000-4000-a000-000000000001'
-- UNION ALL
-- SELECT 'Events', COUNT(*) FROM events WHERE chapter_id = 'de000001-0000-4000-a000-000000000001'
-- UNION ALL
-- SELECT 'Schools', COUNT(*) FROM schools WHERE chapter_id = 'de000001-0000-4000-a000-000000000001'
-- UNION ALL
-- SELECT 'Colleges', COUNT(*) FROM colleges WHERE chapter_id = 'de000001-0000-4000-a000-000000000001';

RAISE NOTICE 'Demo chapter seed completed successfully!';
RAISE NOTICE 'Demo accounts ready for magic link login:';
RAISE NOTICE '  - demo-chair@yi-demo.com (Chair)';
RAISE NOTICE '  - demo-cochair@yi-demo.com (Co-Chair)';
RAISE NOTICE '  - demo-ec@yi-demo.com (EC Member)';
