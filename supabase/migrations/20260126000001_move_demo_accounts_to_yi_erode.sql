/**
 * Move Demo Accounts to Yi Erode Chapter
 *
 * Updates demo accounts (demo-chair, demo-cochair, demo-ec) to be members of
 * Yi Erode chapter instead of Yi DemoChapter for real-world testing.
 */

DO $$
DECLARE
  v_erode_chapter_id UUID;
  v_demo_emails TEXT[] := ARRAY[
    'demo-chair@yi-demo.com',
    'demo-cochair@yi-demo.com',
    'demo-ec@yi-demo.com'
  ];
  v_updated_count INTEGER := 0;
BEGIN
  -- Find Yi Erode chapter ID
  SELECT id INTO v_erode_chapter_id
  FROM public.chapters
  WHERE name ILIKE '%erode%'
  LIMIT 1;

  IF v_erode_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Yi Erode chapter not found. Please create chapter first.';
  END IF;

  RAISE NOTICE 'Found Yi Erode chapter: %', v_erode_chapter_id;

  -- 1. Update approved_emails to use Yi Erode chapter
  UPDATE public.approved_emails
  SET assigned_chapter_id = v_erode_chapter_id
  WHERE email = ANY(v_demo_emails);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % approved_emails records', v_updated_count;

  -- 2. Update existing profiles (if demo users have logged in)
  UPDATE public.profiles
  SET chapter_id = v_erode_chapter_id
  WHERE email = ANY(v_demo_emails);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % profile records', v_updated_count;

  -- 3. Update existing members (if demo users have logged in)
  UPDATE public.members m
  SET chapter_id = v_erode_chapter_id
  FROM public.profiles p
  WHERE m.id = p.id
    AND p.email = ANY(v_demo_emails);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % member records', v_updated_count;

  -- 4. Create member records if they don't exist but profiles do
  INSERT INTO public.members (
    id,
    chapter_id,
    membership_status,
    member_since,
    is_active
  )
  SELECT
    p.id,
    v_erode_chapter_id,
    'active',
    CURRENT_DATE,
    TRUE
  FROM public.profiles p
  WHERE p.email = ANY(v_demo_emails)
    AND NOT EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = p.id
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Created % new member records', v_updated_count;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Demo accounts moved to Yi Erode chapter!';
  RAISE NOTICE '';
  RAISE NOTICE 'Demo accounts now belong to Yi Erode:';
  RAISE NOTICE '  • demo-chair@yi-demo.com (Chair)';
  RAISE NOTICE '  • demo-cochair@yi-demo.com (Co-Chair)';
  RAISE NOTICE '  • demo-ec@yi-demo.com (EC Member)';
END $$;
