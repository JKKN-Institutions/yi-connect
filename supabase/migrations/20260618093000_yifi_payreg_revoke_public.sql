-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: harden YiFi paid-registration RPC grants
--
-- Postgres grants EXECUTE on a newly-created function to PUBLIC by DEFAULT.
-- The register/fee/admin-payment RPCs only GRANTed to specific roles and never
-- REVOKEd PUBLIC, so anon + authenticated could call them directly via
-- PostgREST — letting anyone enumerate the Yi member directory
-- (yifi_resolve_member) or invoke the admin payment mutations, bypassing the
-- page-level hasPermission gate.
--
-- Every one of these RPCs is SECURITY DEFINER and is only ever invoked from
-- server code through the service client, so the correct posture is
-- service_role ONLY (matches the 2026-06-02 hardening of the original YiFi
-- RPCs). The DO-block revokes PUBLIC/anon/authenticated and (re)grants
-- service_role; it skips any function not present, so it is safe in fresh
-- environments.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'yifi_current_fee',
      'yifi_resolve_member',
      'yifi_register_member',
      'yifi_admin_set_fees',
      'yifi_admin_list_payments',
      'yifi_admin_verify_payment',
      'yifi_admin_waive_payment',
      'yifi_admin_manual_add_registrant'
    ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
