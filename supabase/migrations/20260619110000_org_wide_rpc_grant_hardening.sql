-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: org-wide SECURITY DEFINER RPC grant hardening
--
-- Vulnerability class (found 2026-06-18/19 via a per-app security sweep):
-- Postgres grants EXECUTE on every new function to PUBLIC by default. A
-- SECURITY DEFINER function whose only authorization is an APP-LAYER gate is
-- therefore callable directly through PostgREST by anyone holding the public
-- anon key — bypassing the app entirely. The first case found was the YiFi
-- RPCs (e.g. yifi_admin_list_registrants returned rows incl. access_code to
-- anon = mass account-takeover of the member base).
--
-- A four-agent audit classified every anon/authenticated-reachable SECURITY
-- DEFINER function across yi_connect / public / yuva / future / yip /
-- yi_directory into:
--   LOCK  — privileged AND only ever called server-side via the SERVICE-ROLE
--           client (or zero/edge callers). Safe to lock to service_role.
--   FLAG  — privileged AND reachable/called by the AUTHENTICATED role with no
--           internal auth.uid() check. We close the *unauthenticated* vector
--           here (revoke PUBLIC/anon) and KEEP authenticated so live flows work;
--           the residual authenticated-IDOR needs an internal check added to the
--           function body (tracked separately — see FLAG list below).
--   KEEP  — RLS-policy helpers, self-scoped auth.uid() helpers, non-sensitive
--           config reads, and trigger functions. NOT touched (revoking would
--           break RLS / features).
--
-- IMPORTANT nuance baked in here: yi_connect server actions run as the
-- `authenticated` role (cookie JWT), NOT service_role. `has_function_privilege`
-- reads TRUE through PUBLIC, so REVOKE FROM PUBLIC silently strips authenticated
-- unless it is re-granted directly. The FLAG block therefore always GRANTs
-- authenticated explicitly.
--
-- Idempotent + order-safe: each block joins pg_proc and only acts on functions
-- that exist, so re-runs and fresh environments are safe.
--
-- FLAG follow-up (residual authenticated-IDOR — needs internal auth.uid() checks,
-- NOT a grant change; do with a tested change):
--   HIGH: yi_connect.start_impersonation / end_impersonation /
--         log_impersonation_action  (session + audit forgery by any logged-in user)
--   HIGH: yi_connect.set_default_payment_method  (cross-chapter payment tampering)
--   MED:  yi_connect.get_active_impersonation / get_recent_impersonations  (PII)
--   MED:  yi_connect.get_user_roles_detailed / get_user_roles,
--         public.get_user_roles  (role enumeration by arbitrary user id)
--   MED:  public.yifi_find_by_email  (registrant row incl access_code by email)
--   LOW:  yi_connect.can_impersonate_user  (recon)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── LOCK set: revoke PUBLIC/anon/authenticated, grant service_role ──────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN (VALUES
      -- public: YiFi (original + dossier + paid-registration RPCs)
      ('public','yifi_admin_list_sessions'),('public','yifi_admin_upsert_session'),
      ('public','yifi_admin_delete_session'),('public','yifi_get_edition_sessions'),
      ('public','yifi_get_registrants_for_dossier'),('public','yifi_admin_upsert_dossier'),
      ('public','yifi_admin_set_dossier_status'),('public','yifi_admin_mark_dossier_delivered'),
      ('public','yifi_mark_dossier_viewed'),('public','yifi_current_fee'),
      ('public','yifi_resolve_member'),('public','yifi_register_member'),
      ('public','yifi_admin_set_fees'),('public','yifi_admin_list_payments'),
      ('public','yifi_admin_verify_payment'),('public','yifi_admin_waive_payment'),
      ('public','yifi_admin_manual_add_registrant'),
      ('public','yifi_lookup_registrant'),('public','yifi_get_registrant_by_id'),
      ('public','yifi_get_matches'),('public','yifi_get_vows'),('public','yifi_get_dossier'),
      ('public','yifi_check_organiser'),('public','yifi_list_organisers'),
      ('public','yifi_current_edition'),('public','yifi_get_edition'),('public','yifi_get_stats'),
      ('public','yifi_create_vow'),('public','yifi_update_census'),
      ('public','yifi_admin_toggle_checkin'),('public','yifi_admin_update_match'),
      ('public','yifi_admin_update_vow'),('public','yifi_admin_list_registrants'),
      ('public','yifi_admin_census_summary'),('public','yifi_admin_list_matches'),
      ('public','yifi_admin_list_vows'),('public','yifi_admin_list_dossiers'),
      -- public: directory + succession
      ('public','merge_directory_people'),('public','bulk_calculate_cycle_eligibility'),
      ('public','calculate_member_eligibility'),
      -- yuva / future / yip / yi_directory
      ('yuva','next_certificate_no'),
      ('future','leaderboard_track'),('future','leaderboard_institution'),
      ('future','leaderboard_chapter'),('future','leaderboard_problem'),
      ('yip','tg_events_attach_central_topics'),('yip','tg_events_autoderive_zone'),
      ('yi_directory','sync_from_chapter_core_team'),
      -- yi_connect: service/edge/zero-caller only
      ('yi_connect','get_pending_scheduled_reports'),('yi_connect','initialize_chapter_features'),
      ('yi_connect','increment_impersonation_page_visit')
    ) AS t(sch, fn) ON n.nspname = t.sch AND p.proname = t.fn
    WHERE p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ─── FLAG set: revoke PUBLIC/anon, KEEP authenticated (+ service_role) ────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN (VALUES
      ('public','get_user_roles'),('public','yifi_find_by_email'),
      ('yi_connect','start_impersonation'),('yi_connect','end_impersonation'),
      ('yi_connect','log_impersonation_action'),('yi_connect','set_default_payment_method'),
      ('yi_connect','get_active_impersonation'),('yi_connect','get_recent_impersonations'),
      ('yi_connect','can_impersonate_user'),('yi_connect','get_user_roles_detailed'),
      ('yi_connect','get_user_roles')
    ) AS t(sch, fn) ON n.nspname = t.sch AND p.proname = t.fn
    WHERE p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
