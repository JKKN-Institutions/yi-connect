-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: harden YiFi dossier-pipeline RPC grants
--
-- Postgres grants EXECUTE on a newly-created function to PUBLIC by DEFAULT.
-- The dossier ingestion / generation / delivery / reader RPCs only GRANTed to
-- specific roles and never REVOKEd PUBLIC, so anon + authenticated could call
-- them directly via PostgREST — bypassing the page-level hasPermission gate
-- (e.g. write arbitrary dossiers, read the registrant/census export).
--
-- Every one of these RPCs is SECURITY DEFINER and is only ever invoked from
-- server code through the service client, so the correct posture is
-- service_role ONLY (matches the 2026-06-02 hardening of the original YiFi
-- RPCs and the paid-registration hardening). The DO-block skips any function
-- not present, so it is safe in fresh environments.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'yifi_admin_list_sessions',
      'yifi_admin_upsert_session',
      'yifi_admin_delete_session',
      'yifi_get_edition_sessions',
      'yifi_get_registrants_for_dossier',
      'yifi_admin_upsert_dossier',
      'yifi_admin_set_dossier_status',
      'yifi_admin_mark_dossier_delivered',
      'yifi_mark_dossier_viewed'
    ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
