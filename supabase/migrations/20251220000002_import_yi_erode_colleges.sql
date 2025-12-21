-- ================================================
-- Yi Erode Colleges Import
-- Run in Supabase SQL Editor
-- Generated: 2025-12-20
-- ================================================

-- Get Yi Erode chapter ID and member IDs for connections
DO $$
DECLARE
  v_chapter_id UUID;
  v_om_id UUID;
  v_hari_id UUID;
  v_haribaskar_id UUID;
BEGIN
  SELECT id INTO v_chapter_id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Yi Erode chapter not found. Please create chapter first.';
  END IF;

  -- Get member IDs for connections (may be null if not yet imported)
  -- Note: full_name is in profiles table, members references profiles.id
  SELECT m.id INTO v_om_id FROM members m JOIN profiles p ON m.id = p.id WHERE p.full_name ILIKE '%ommsharravana%' LIMIT 1;
  SELECT m.id INTO v_hari_id FROM members m JOIN profiles p ON m.id = p.id WHERE p.full_name ILIKE '%hari%' AND p.full_name NOT ILIKE '%haribaskar%' LIMIT 1;
  SELECT m.id INTO v_haribaskar_id FROM members m JOIN profiles p ON m.id = p.id WHERE p.full_name ILIKE '%haribaskar%' LIMIT 1;

  -- Insert colleges
  INSERT INTO colleges (
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
  (v_chapter_id, 'JKKN College of Engineering', 'engineering', 'Komarapalayam', true, 'active', 'through_member', v_om_id, 'JKKN Group - Internal connection'),
  (v_chapter_id, 'JKKN College of Arts & Science', 'arts_science', 'Komarapalayam', true, 'active', 'through_member', v_om_id, 'JKKN Group - Internal connection'),
  (v_chapter_id, 'JKKN Dental College', 'medical', 'Komarapalayam', true, 'active', 'through_member', v_om_id, 'JKKN Group - Internal connection'),
  (v_chapter_id, 'JKKN College of Pharmacy', 'medical', 'Komarapalayam', true, 'active', 'through_member', v_om_id, 'JKKN Group - Internal connection'),
  (v_chapter_id, 'JKKN College of Allied Health', 'medical', 'Komarapalayam', true, 'active', 'through_member', v_om_id, 'JKKN Group - Internal connection'),
  (v_chapter_id, 'JKKN College of Nursing', 'medical', 'Komarapalayam', true, 'active', 'through_member', v_om_id, 'JKKN Group - Internal connection'),
  (v_chapter_id, 'JKKN College of Education', 'other', 'Komarapalayam', true, 'active', 'through_member', v_om_id, 'JKKN Group - Internal connection'),

  -- Nandha Group (6 colleges)
  (v_chapter_id, 'Nandha Engineering College', 'engineering', 'Erode', false, 'prospective', 'through_member', v_hari_id, 'Nandha Group - Hari can take lead'),
  (v_chapter_id, 'Nandha College of Technology', 'engineering', 'Erode', false, 'prospective', 'through_member', v_hari_id, 'Nandha Group'),
  (v_chapter_id, 'Nandha Arts & Science', 'arts_science', 'Erode', false, 'prospective', 'cold', NULL, 'Nandha Group - To Contact'),
  (v_chapter_id, 'Nandha College of Pharmacy', 'medical', 'Erode', false, 'prospective', 'cold', NULL, 'Nandha Group - To Contact'),
  (v_chapter_id, 'Nandha College of Nursing', 'medical', 'Erode', false, 'prospective', 'cold', NULL, 'Nandha Group - To Contact'),
  (v_chapter_id, 'Nandha Polytechnic', 'polytechnic', 'Erode', false, 'prospective', 'cold', NULL, 'Nandha Group - To Contact'),

  -- KSR Group (3 colleges)
  (v_chapter_id, 'KSR College of Engineering', 'engineering', 'Tiruchengode', true, 'active', 'direct', NULL, 'KSR Group'),
  (v_chapter_id, 'KSR College for Women', 'engineering', 'Tiruchengode', true, 'active', 'direct', NULL, 'KSR Group'),
  (v_chapter_id, 'KSR College of Arts & Science', 'arts_science', 'Tiruchengode', true, 'active', 'direct', NULL, 'KSR Group'),

  -- Vellalar Group (2 colleges)
  (v_chapter_id, 'Vellalar College for Women', 'arts_science', 'Erode', false, 'prospective', 'cold', NULL, 'Vellalar Group - Documents requested, renewal pending'),
  (v_chapter_id, 'Vellalar Engineering', 'engineering', 'Erode', false, 'inactive', 'cold', NULL, 'Vellalar Group - Inactive'),

  -- SSM Group (3 colleges)
  (v_chapter_id, 'SSM College of Nursing', 'medical', 'Komarapalayam', true, 'active', 'direct', NULL, 'SSM Group - MOU Signed'),
  (v_chapter_id, 'SSM College of Physiotherapy', 'medical', 'Komarapalayam', true, 'active', 'direct', NULL, 'SSM Group - MOU Signed'),
  (v_chapter_id, 'SSM Polytechnic', 'polytechnic', 'Komarapalayam', true, 'active', 'direct', NULL, 'SSM Group - MOU Signed'),

  -- Kongu Group (2 colleges)
  (v_chapter_id, 'Kongu Engineering College', 'engineering', 'Perundurai', true, 'active', 'through_member', v_haribaskar_id, 'Kongu Group - Management contact: Dr. Karthik'),
  (v_chapter_id, 'Kongu Polytechnic', 'polytechnic', 'Perundurai', true, 'active', 'direct', NULL, 'Kongu Group'),

  -- Individual Colleges (8)
  (v_chapter_id, 'Excel Engineering College', 'engineering', 'Komarapalayam', false, 'prospective', 'cold', NULL, 'Individual - Partial engagement'),
  (v_chapter_id, 'PKR Engineering', 'engineering', 'Erode', true, 'active', 'direct', NULL, 'Individual'),
  (v_chapter_id, 'Gobi Arts & Science', 'arts_science', 'Gobichettipalayam', true, 'active', 'direct', NULL, 'Individual'),
  (v_chapter_id, 'KPR Engineering', 'engineering', 'Coimbatore', true, 'active', 'direct', NULL, 'MOU Signed'),
  (v_chapter_id, 'SNS Engineering', 'engineering', 'Coimbatore', true, 'active', 'direct', NULL, 'MOU Signed'),
  (v_chapter_id, 'Sri Krishna Engineering', 'engineering', 'Coimbatore', true, 'active', 'direct', NULL, 'MOU Signed'),
  (v_chapter_id, 'Navarasam Arts & Science', 'arts_science', 'Erode', false, 'prospective', 'cold', NULL, 'To verify'),

  -- Potential New (2 colleges)
  (v_chapter_id, 'Vivekananda College', 'arts_science', 'Salem', false, 'prospective', 'cold', NULL, 'Potential New - Medium priority'),
  (v_chapter_id, 'Shanmuga Engineering', 'engineering', 'Tiruchengode', false, 'prospective', 'cold', NULL, 'Potential New - Medium priority')

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Imported 41 colleges for Yi Erode chapter';
END $$;

-- Verify import
SELECT
  college_name,
  college_type,
  city,
  has_yuva_chapter,
  status
FROM colleges
WHERE chapter_id = (SELECT id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1)
ORDER BY college_name;
