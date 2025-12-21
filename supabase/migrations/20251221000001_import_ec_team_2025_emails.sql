-- ================================================
-- Yi Erode EC Team 2026 Emails Import
-- Adds EC Team member emails to approved_emails whitelist
-- Generated: 2026-12-21
-- ================================================

DO $$
DECLARE
  v_chapter_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get Yi Erode chapter ID
  SELECT id INTO v_chapter_id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Yi Erode chapter not found. Please create chapter first.';
  END IF;

  -- Get an admin user ID to use as approver
  SELECT p.id INTO v_admin_id
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  JOIN roles r ON ur.role_id = r.id
  WHERE r.name IN ('super_admin', 'director', 'chair')
  LIMIT 1;

  -- Fallback: get any profile if no admin found
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM profiles LIMIT 1;
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No users found to use as approver. Please login first.';
  END IF;

  -- Insert EC Team 2026 approved emails
  INSERT INTO approved_emails (email, approved_by, assigned_chapter_id, notes, is_active)
  VALUES
    -- MEMBERSHIP Vertical
    ('sharab2222@gmail.com', v_admin_id, v_chapter_id, 'Sharabhesh S - Membership Joint-Chair 2026', true),

    -- YUVA Vertical
    ('insurebaski@gmail.com', v_admin_id, v_chapter_id, 'Haribaskar - YUVA Joint-Chair 2026, Kongu Engineering', true),

    -- THALIR Vertical
    ('viyasjanani@gmail.com', v_admin_id, v_chapter_id, 'Viyas Janani - Thalir Joint-Chair 2026', true),
    ('srimathi3084@gmail.com', v_admin_id, v_chapter_id, 'Srimathi - Thalir Joint-Chair 2026', true),

    -- ACCESSIBILITY Vertical
    ('nkrj93@gmail.com', v_admin_id, v_chapter_id, 'Naveen Kumar - Accessibility Chair 2026', true),

    -- CLIMATE CHANGE Vertical
    ('praadeepgenius@gmail.com', v_admin_id, v_chapter_id, 'Pradeep - Climate Change Chair 2026', true),
    ('mithun@prdrigs.com', v_admin_id, v_chapter_id, 'Mithunraj - Climate Change Co-Chair 2026, PRD Rigs', true),
    ('balamuruganselvakumar@gmail.com', v_admin_id, v_chapter_id, 'Balamurugaan - Climate Change Co-Chair 2026', true),

    -- ENTREPRENEURSHIP Vertical
    ('amdineshca@gmail.com', v_admin_id, v_chapter_id, 'Mohandinesh - Entrepreneurship Chair 2026', true),
    ('yaallal2017@gmail.com', v_admin_id, v_chapter_id, 'Yall - Entrepreneurship Co-Chair 2026', true),

    -- HEALTH Vertical
    ('isvarya@jkkn.ac.in', v_admin_id, v_chapter_id, 'Isvarya K - Health Joint-Chair 2026, JKKN', true),

    -- INNOVATION Vertical
    ('keerthu005@gmail.com', v_admin_id, v_chapter_id, 'Keerthana - Innovation Joint-Chair 2026', true),

    -- MASOOM Vertical
    ('shalinimohana1206@gmail.com', v_admin_id, v_chapter_id, 'Shalini - MASOOM Chair 2026', true),

    -- ROAD SAFETY Vertical
    ('kavinrt@gmail.com', v_admin_id, v_chapter_id, 'Kavinraj - Road Safety Joint-Chair 2026', true),

    -- VARNAM VIZHA Vertical
    ('deepaksmj@gmail.com', v_admin_id, v_chapter_id, 'Deepak - Varnam Vizha Chair 2026', true),

    -- LEARNING Vertical (Chair Om - already has access)
    ('mohanapriyamathi@gmail.com', v_admin_id, v_chapter_id, 'Mohanapriya - Learning Joint-Chair 2026', true)

  ON CONFLICT (email) DO NOTHING;

  RAISE NOTICE 'Added 16 EC Team 2026 emails to approved_emails whitelist';
END $$;

-- Verify import
SELECT email, notes, is_active, created_at
FROM approved_emails
WHERE assigned_chapter_id = (SELECT id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1)
ORDER BY created_at DESC;
