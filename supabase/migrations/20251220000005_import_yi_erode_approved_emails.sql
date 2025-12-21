-- ================================================
-- Yi Erode Approved Emails Import
-- Adds member emails to approved_emails whitelist
-- Generated: 2025-12-20
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

  -- Get an admin user ID to use as approver (Om or any super admin)
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

  -- Insert approved emails for known member emails
  INSERT INTO approved_emails (email, approved_by, assigned_chapter_id, notes, is_active)
  VALUES
    -- Known emails from WhatsApp data
    ('sakthi@troobite.com', v_admin_id, v_chapter_id, 'Sakthi Vignessh - Yuva Co-Chair, Troobite', true),
    ('rathy@dataception.in', v_admin_id, v_chapter_id, 'Bhagirathy B - Yuva Joint Chair, Dataception', true)
  ON CONFLICT (email) DO NOTHING;

  RAISE NOTICE 'Added 2 known member emails to approved_emails whitelist';
END $$;

-- Verify import
SELECT email, notes, is_active, created_at
FROM approved_emails
WHERE assigned_chapter_id = (SELECT id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1)
ORDER BY created_at DESC;

-- ================================================
-- REMAINING MEMBERS NEED EMAIL ADDRESSES
-- ================================================
-- The following members from WhatsApp data need real emails:
-- 1. Ommsharravana - Chapter Chair, JKKN Institutions
-- 2. Yadhavi Yogesh - Outgoing Chair
-- 3. A Yogesh Kumar - Member
-- 4. Priya Navin - Past Chair 2021
-- 5. Kumaravel Thangavel - Past Co-Chair 2021
-- 6. Thiagarajan Thirunavukkarasu - Past Chair
-- 7. Srimathi - Thalir Chair
-- 8. Ruban Rajakumar - Executive Member
-- 9. Dr. Yuvabalan - Sports/Health
-- 10. D. Senthil Kumar - Founder Chair, Sakthi Masala
-- 11. Dr. Sudhakar - Sudha Hospitals
-- 12. Gomathi Srikalyan - Yuva Lead
-- ... and 71 more members
--
-- To add more emails, run:
-- INSERT INTO approved_emails (email, approved_by, assigned_chapter_id, notes)
-- VALUES ('member@email.com', '<admin_uuid>', '<chapter_uuid>', 'Member Name');
