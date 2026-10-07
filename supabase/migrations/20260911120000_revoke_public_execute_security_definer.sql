-- ═══════════════════════════════════════════════════════════════════════════
-- Close anonymous EXECUTE on SECURITY DEFINER helper functions
-- (schemas yi_connect, yuva, future, yi_directory)
--
-- WHAT WAS WRONG
--   Postgres grants EXECUTE on every new function to PUBLIC, and PUBLIC
--   includes the `anon` role. So anyone holding the public anon key could call
--   the functions below directly over the REST API, where a SECURITY DEFINER
--   function runs with its owner's rights and skips row-level security.
--   The 2026-06-19 hardening (20260619110000_org_wide_rpc_grant_hardening)
--   locked the service-only and admin RPCs but left these helpers untouched.
--   Many answer a question about the calling user (auth.uid()) and give an
--   anonymous caller false or null. Others take an id and read or write data
--   with no caller check (for example calculate_engagement_score,
--   calculate_event_impact, ensure_chapter_settings, increment_template_usage,
--   get_skill_gaps, get_sync_health_status). No misuse has been observed; this
--   is clean-up of a door that should not be open.
--
-- WHAT THIS DOES
--   For each of the 34 functions listed below:
--     REVOKE EXECUTE ... FROM PUBLIC, anon;
--     GRANT  EXECUTE ... TO authenticated, service_role;
--   The explicit authenticated grant is essential. Today `authenticated` holds
--   EXECUTE on most of these ONLY through PUBLIC, so revoking PUBLIC alone would
--   silently lock out signed-in users. yi_connect server actions run as
--   `authenticated` (cookie client), and the yuva / future / yi_connect RLS
--   policies that call these helpers are written for `authenticated`.
--
-- WHY THESE 34 ARE SAFE TO CLOSE (checked against production on 2026-09-11)
--   * Every RLS policy that calls the function applies only to `authenticated`
--     (or no policy calls it), so `anon` never evaluates it. For yuva, anon has
--     no USAGE on the schema at all.
--   * Every app call goes through a signed-in user's cookie or browser client:
--     dashboard pages, /m pages, or a server action that checks the user first.
--     Several have no app caller.
--   * No trigger, view, column default or anon-reachable function depends on
--     it. The functions that call a listed function are SECURITY DEFINER (they
--     run as the owner), except the trigger yi_connect.validate_trainer_assignment,
--     which is fired by signed-in users, who keep EXECUTE.
--
-- DELIBERATELY NOT TOUCHED — anon must keep EXECUTE:
--   yi_connect.get_invitation_by_token(text)          public accept-invite page
--   yi_connect.get_rsvp_event_members(text)           public RSVP page (explicit anon grant)
--   yi_connect.get_user_hierarchy_level(uuid)         called by 49 policies written TO public
--   yi_connect.user_belongs_to_chapter(uuid)          called by 58 policies written TO public
--   yi_connect.is_vertical_chair(uuid,uuid)           called by 7 policies written TO public
--   yi_connect.is_sub_chapter_lead(uuid,uuid)         called by 5 policies written TO public
--   yi_connect.get_coordinator_stakeholder_id(uuid)   called by 5 policies written TO public
--   yi_connect.has_active_mou(uuid)                   called by 2 policies written TO public
--   Postgres evaluates those policies for anon on tables anon holds privileges
--   on, so taking anon's EXECUTE away would turn ordinary anonymous queries into
--   "permission denied for function" errors. Closing them needs those policies
--   narrowed to TO authenticated first — a separate, tested change.
--   Trigger functions are also left alone: they cannot be called directly.
--   SECURITY INVOKER functions are out of scope: they run with the caller's own
--   rights and RLS.
--
-- Idempotent: REVOKE/GRANT can be re-run, and a listed function that does not
-- exist (or is no longer SECURITY DEFINER) is skipped and named in a NOTICE.
-- Signatures are matched exactly, so other overloads with the same name are
-- never widened.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_close_anon text[] := ARRAY[
    -- future
    'future.is_chapter_admin(uuid)',
    -- yi_directory
    'yi_directory.current_user_can_see(text,text,text)',
    -- yuva
    'yuva.can_see(text)',
    'yuva.current_person_id()',
    'yuva.is_academy_coordinator(uuid)',
    'yuva.is_run_mentor(uuid)',
    'yuva.is_yuva_national()',
    -- yi_connect: RLS helpers used only by policies written TO authenticated
    'yi_connect.is_national_admin(uuid)',
    -- yi_connect: called by signed-in users through the cookie/browser client
    'yi_connect.accept_chapter_invitation(text)',
    'yi_connect.calculate_engagement_score(uuid)',
    'yi_connect.calculate_event_impact(uuid)',
    'yi_connect.calculate_event_trainer_score(uuid,uuid,text)',
    'yi_connect.calculate_leadership_readiness(uuid)',
    'yi_connect.calculate_opportunity_match_score(uuid,uuid)',
    'yi_connect.can_manage_role(uuid,uuid)',
    'yi_connect.check_materials_approval_status(uuid)',
    'yi_connect.cleanup_expired_oauth_states()',
    'yi_connect.ensure_chapter_settings(uuid)',
    'yi_connect.get_booking_restrictions(text)',
    'yi_connect.get_chapter_settings(uuid)',
    'yi_connect.get_skill_gaps(uuid)',
    'yi_connect.get_sync_health_status(uuid)',
    'yi_connect.get_trainer_session_count(uuid,integer,integer)',
    'yi_connect.increment_template_usage(uuid)',
    'yi_connect.validate_booking_request(uuid,text,date,time without time zone,time without time zone)',
    'yi_connect.validate_materials_deadline(uuid)',
    'yi_connect.validate_trainer_workload(uuid,date,integer)',
    -- yi_connect: no caller in the app, no policy, no trigger
    'yi_connect.check_venue_availability(uuid,timestamp with time zone,timestamp with time zone,uuid)',
    'yi_connect.get_chapter_features(uuid)',
    'yi_connect.get_user_sub_chapters(uuid)',
    'yi_connect.get_user_verticals(uuid)',
    'yi_connect.has_permission(text,uuid)',
    'yi_connect.is_coordinator_for_stakeholder(uuid,uuid)',
    'yi_connect.is_feature_enabled(uuid,yi_connect.feature_name)'
  ];
  v_saved_path text := current_setting('search_path');
  v_sig text;
  v_oid oid;
  v_done integer := 0;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  -- Pin search_path so every signature prints fully schema-qualified while matching.
  PERFORM set_config('search_path', 'pg_catalog', true);

  FOREACH v_sig IN ARRAY v_close_anon LOOP
    SELECT p.oid INTO v_oid
      FROM pg_proc p
     WHERE p.oid::regprocedure::text = v_sig
       AND p.prosecdef;

    IF v_oid IS NULL THEN
      v_missing := v_missing || v_sig;
      CONTINUE;
    END IF;

    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_oid::regprocedure);
    v_done := v_done + 1;
  END LOOP;

  PERFORM set_config('search_path', v_saved_path, true);
  RAISE NOTICE 'closed anonymous EXECUTE on % function(s); skipped (not found): %', v_done, v_missing;
END $$;
