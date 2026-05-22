/**
 * Demo Chapter Setup Migration
 *
 * Creates Yi DemoChapter with all sample data and demo accounts.
 * Demo accounts use magic link authentication and auto-assign correct roles.
 *
 * Demo Accounts:
 * - demo-chair@yi-demo.com → Chair role (hierarchy 4)
 * - demo-cochair@yi-demo.com → Co-Chair role (hierarchy 3)
 * - demo-ec@yi-demo.com → EC Member role (hierarchy 2)
 */

-- ============================================================================
-- 1. ADD ROLE ASSIGNMENT COLUMN TO APPROVED_EMAILS
-- ============================================================================

ALTER TABLE public.approved_emails
ADD COLUMN IF NOT EXISTS assigned_role_name TEXT DEFAULT 'Member';

COMMENT ON COLUMN public.approved_emails.assigned_role_name IS 'Role to assign when user first logs in. Defaults to Member.';

-- ============================================================================
-- 2. UPDATE HANDLE_NEW_USER TO ASSIGN SPECIFIED ROLE
-- ============================================================================

-- Drop and recreate to add role assignment logic
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_email_record RECORD;
  v_member_request_record RECORD;
  v_profile_id UUID;
  v_role_id UUID;
  v_role_name TEXT;
BEGIN
  -- 1. Check if email is in approved_emails whitelist
  SELECT * INTO v_approved_email_record
  FROM public.approved_emails
  WHERE email = NEW.email
    AND is_active = TRUE;

  -- If email is NOT in whitelist, block the user
  IF v_approved_email_record IS NULL THEN
    RAISE EXCEPTION 'Email % is not authorized. Please apply at /apply first.', NEW.email
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Create profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    chapter_id,
    approved_email_id,
    approved_at,
    approved_by
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_approved_email_record.assigned_chapter_id,
    v_approved_email_record.id,
    v_approved_email_record.approved_at,
    v_approved_email_record.approved_by
  );

  v_profile_id := NEW.id;

  -- 3. Determine which role to assign (use specified or default to Member)
  v_role_name := COALESCE(v_approved_email_record.assigned_role_name, 'Member');

  SELECT id INTO v_role_id FROM public.roles WHERE name = v_role_name LIMIT 1;

  -- Fallback to Member if role not found
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'Member' LIMIT 1;
    v_role_name := 'Member';
  END IF;

  -- Assign the role
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (NEW.id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RAISE NOTICE 'Assigned role % to user %', v_role_name, NEW.email;

  -- 4. Get member request data if available
  IF v_approved_email_record.member_request_id IS NOT NULL THEN
    SELECT * INTO v_member_request_record
    FROM public.member_requests
    WHERE id = v_approved_email_record.member_request_id;

    -- 5. Create member record with data from member_request
    IF v_member_request_record IS NOT NULL THEN
      INSERT INTO public.members (
        id,
        chapter_id,
        membership_status,
        member_since,
        -- Professional Information
        company,
        designation,
        industry,
        years_of_experience,
        linkedin_url,
        -- Personal Information
        date_of_birth,
        gender,
        address,
        city,
        state,
        country,
        pincode,
        -- Emergency Contact
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        -- System fields
        is_active
      )
      VALUES (
        v_profile_id,
        v_approved_email_record.assigned_chapter_id,
        'active',
        CURRENT_DATE,
        -- Professional Information
        v_member_request_record.company,
        v_member_request_record.designation,
        v_member_request_record.industry,
        v_member_request_record.years_of_experience,
        v_member_request_record.linkedin_url,
        -- Personal Information
        v_member_request_record.date_of_birth,
        v_member_request_record.gender,
        v_member_request_record.address,
        v_member_request_record.city,
        v_member_request_record.state,
        v_member_request_record.country,
        v_member_request_record.pincode,
        -- Emergency Contact
        v_member_request_record.emergency_contact_name,
        v_member_request_record.emergency_contact_phone,
        v_member_request_record.emergency_contact_relationship,
        -- System fields
        TRUE
      );

      -- Update approved_emails to mark member_created
      UPDATE public.approved_emails
      SET
        first_login_at = NOW(),
        member_created = TRUE,
        created_member_id = v_profile_id
      WHERE id = v_approved_email_record.id;

      -- Update member_requests to link created member
      UPDATE public.member_requests
      SET created_member_id = v_profile_id
      WHERE id = v_approved_email_record.member_request_id;

      RAISE NOTICE 'Created profile and member record for %', NEW.email;
    END IF;
  ELSE
    -- No member_request found - create a basic member record for demo/approved accounts
    INSERT INTO public.members (
      id,
      chapter_id,
      membership_status,
      member_since,
      is_active
    )
    VALUES (
      v_profile_id,
      v_approved_email_record.assigned_chapter_id,
      'active',
      CURRENT_DATE,
      TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.approved_emails
    SET
      first_login_at = NOW(),
      member_created = TRUE,
      created_member_id = v_profile_id
    WHERE id = v_approved_email_record.id
      AND first_login_at IS NULL;

    RAISE NOTICE 'Created profile for % with basic member record', NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Creates profile AND member record for new users if their email is in the approved_emails whitelist. Assigns role specified in assigned_role_name (defaults to Member).';

-- ============================================================================
-- 3. CREATE DEMO CHAPTER
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
  0,
  'active',
  '{"demo_mode": true}'::JSONB,
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'active',
  settings = EXCLUDED.settings;

-- ============================================================================
-- 4. ADD APPROVED EMAILS FOR DEMO ACCOUNTS
-- ============================================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_chapter_id UUID := 'de000001-0000-4000-a000-000000000001'::UUID;
BEGIN
  -- Find an existing admin
  SELECT ur.user_id INTO v_admin_id
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE r.hierarchy_level >= 6
  LIMIT 1;

  -- Fallback to any profile
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.profiles LIMIT 1;
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No existing users found. Skipping approved_emails setup.';
    RETURN;
  END IF;

  -- Demo Chair Account
  INSERT INTO public.approved_emails (
    email,
    approved_by,
    assigned_chapter_id,
    assigned_role_name,
    notes,
    is_active
  ) VALUES (
    'demo-chair@yi-demo.com',
    v_admin_id,
    v_chapter_id,
    'Chair',
    'Demo Chapter Chair - Use magic link to login',
    TRUE
  ) ON CONFLICT (email) DO UPDATE SET
    assigned_chapter_id = EXCLUDED.assigned_chapter_id,
    assigned_role_name = 'Chair',
    is_active = TRUE,
    notes = EXCLUDED.notes;

  -- Demo Co-Chair Account
  INSERT INTO public.approved_emails (
    email,
    approved_by,
    assigned_chapter_id,
    assigned_role_name,
    notes,
    is_active
  ) VALUES (
    'demo-cochair@yi-demo.com',
    v_admin_id,
    v_chapter_id,
    'Co-Chair',
    'Demo Chapter Co-Chair - Use magic link to login',
    TRUE
  ) ON CONFLICT (email) DO UPDATE SET
    assigned_chapter_id = EXCLUDED.assigned_chapter_id,
    assigned_role_name = 'Co-Chair',
    is_active = TRUE,
    notes = EXCLUDED.notes;

  -- Demo EC Member Account
  INSERT INTO public.approved_emails (
    email,
    approved_by,
    assigned_chapter_id,
    assigned_role_name,
    notes,
    is_active
  ) VALUES (
    'demo-ec@yi-demo.com',
    v_admin_id,
    v_chapter_id,
    'EC Member',
    'Demo EC Member - Use magic link to login',
    TRUE
  ) ON CONFLICT (email) DO UPDATE SET
    assigned_chapter_id = EXCLUDED.assigned_chapter_id,
    assigned_role_name = 'EC Member',
    is_active = TRUE,
    notes = EXCLUDED.notes;

  RAISE NOTICE 'Demo accounts approved successfully';
END $$;

-- ============================================================================
-- 5. INITIALIZE FEATURE TOGGLES FOR DEMO CHAPTER
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
-- 6. CREATE SAMPLE VERTICALS
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
-- 7. CREATE SAMPLE EVENTS
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
  venue_address,
  max_capacity
)
VALUES
  -- Past Events
  (
    'ef000001-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'MASOOM School Awareness Session',
    'Child safety awareness session conducted at local government school. 250 students participated.',
    'community_service',
    'completed',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days' + INTERVAL '3 hours',
    'Government High School, Main Road, Demo City',
    300
  ),
  (
    'ef000002-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Yuva Career Guidance Workshop',
    'Career counseling session for final year engineering students. Featured industry experts from IT and Manufacturing.',
    'workshop',
    'completed',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days' + INTERVAL '4 hours',
    'Engineering College Auditorium, College Road, Demo City',
    200
  ),
  (
    'ef000003-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Tree Plantation Drive',
    'Planted 500 saplings in the city outskirts with local community participation.',
    'community_service',
    'completed',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days' + INTERVAL '5 hours',
    'City Forest Reserve, Outer Ring Road, Demo City',
    100
  ),
  -- Upcoming Events
  (
    'ef000004-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Monthly Chapter Meeting',
    'Regular monthly meeting to discuss upcoming initiatives and review progress.',
    'networking',
    'published',
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '5 days' + INTERVAL '2 hours',
    'Chapter Office, Business District, Demo City',
    50
  ),
  (
    'ef000005-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Road Safety Helmet Awareness Rally',
    'Motorcycle rally to spread awareness about helmet safety. Expected 200+ participants.',
    'community_service',
    'published',
    NOW() + INTERVAL '10 days',
    NOW() + INTERVAL '10 days' + INTERVAL '4 hours',
    'City Center, Main Circle, Demo City',
    300
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
    'Co-working Space, Tech Park, Demo City',
    30
  ),
  (
    'ef000007-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Yuva Entrepreneurship Bootcamp',
    'Two-day intensive bootcamp for aspiring young entrepreneurs. Featuring startup mentors.',
    'workshop',
    'published',
    NOW() + INTERVAL '25 days',
    NOW() + INTERVAL '26 days',
    'Innovation Hub, Startup Valley, Demo City',
    100
  ),
  (
    'ef000008-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Regional Chapter Conclave',
    'Annual gathering of all SRTN region chapters. Networking and best practices sharing.',
    'conference',
    'published',
    NOW() + INTERVAL '45 days',
    NOW() + INTERVAL '46 days',
    'Convention Center, Exhibition Road, Demo City',
    500
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. CREATE SAMPLE STAKEHOLDERS - SCHOOLS
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
  total_students,
  decision_maker,
  connection_notes,
  status
)
VALUES
  (
    'ec000001-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'Government Higher Secondary School',
    'state_board',
    'Main Road, Near Bus Stand',
    'Demo City',
    'Tamil Nadu',
    '0422-1234567',
    'ghss-demo@tn.gov.in',
    'direct',
    1200,
    'Mr. Ramesh Kumar (Principal) - 9876543210',
    '3 MASOOM sessions conducted. Last session: 30 days ago. High engagement.',
    'active'
  ),
  (
    'ec000002-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'St. Mary''s Matriculation School',
    'cbse',
    'Church Street',
    'Demo City',
    'Tamil Nadu',
    '0422-2345678',
    'info@stmarysdemo.edu.in',
    'through_member',
    800,
    'Sr. Maria Francis (Principal) - 9876543211',
    '5 MASOOM sessions conducted. Last session: 15 days ago. High engagement.',
    'active'
  ),
  (
    'ec000003-0000-4000-a000-000000000001'::UUID,
    'de000001-0000-4000-a000-000000000001',
    'DAV Public School',
    'cbse',
    'Industrial Area',
    'Demo City',
    'Tamil Nadu',
    '0422-3456789',
    'principal@davdemo.edu.in',
    'cold',
    600,
    'Mr. Suresh Babu (Principal) - 9876543212',
    'No MASOOM sessions yet. Low engagement - needs follow-up.',
    'prospective'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. CREATE SAMPLE STAKEHOLDERS - COLLEGES
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
  total_students,
  decision_maker,
  connection_notes,
  has_yuva_chapter,
  status
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
    'through_member',
    2500,
    'Dr. Venkatesh (Principal) - 9876543220',
    '4 Yuva programs conducted. Last program: 20 days ago. High engagement.',
    TRUE,
    'active'
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
    'direct',
    1800,
    'Dr. Lakshmi Devi (Principal) - 9876543221',
    '2 Yuva programs conducted. Last program: 45 days ago. Medium engagement.',
    FALSE,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMPLETION NOTICE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Demo Chapter Setup Complete!';
  RAISE NOTICE '';
  RAISE NOTICE '📍 Chapter: Yi DemoChapter (Demo City, SRTN)';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Demo Accounts (use magic link):';
  RAISE NOTICE '   • demo-chair@yi-demo.com (Chair)';
  RAISE NOTICE '   • demo-cochair@yi-demo.com (Co-Chair)';
  RAISE NOTICE '   • demo-ec@yi-demo.com (EC Member)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Sample Data Created:';
  RAISE NOTICE '   • 4 Verticals (MASOOM, Yuva, Climate, Road Safety)';
  RAISE NOTICE '   • 8 Events (3 past, 5 upcoming)';
  RAISE NOTICE '   • 3 Schools';
  RAISE NOTICE '   • 2 Colleges';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Login URL: https://yi-connect-app.vercel.app/login';
END $$;
