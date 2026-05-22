-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Create `yi_connect` schema in shared Supabase
--
-- Context
-- ───────
-- yi-connect is moving from its own dedicated Supabase project
-- (jxvbjpkypzedtrqewesc) into the shared cross-app Supabase project
-- (bkmpbcoxbjyafieabxao) which already hosts YIP (public.*) and
-- YiFuture (future.*). yi-connect's tables will live under
-- `yi_connect.*` to avoid colliding with YIP's `public.*` namespace.
--
-- This migration creates ONLY the schema and grants. No tables. No
-- policies. No data. Subsequent migrations will lift yi-connect's
-- 39 existing migrations into this schema one at a time, with
-- schema-qualification of every table, FK, function, and policy.
--
-- The cross-app identity layer (yi.chapters, yi_directory.people,
-- yi.national_admins) is already in place. yi-connect will plug
-- into it in subsequent migrations rather than re-creating it.
--
-- Strictly additive. Rollback: DROP SCHEMA yi_connect CASCADE;
-- (safe at this point because schema is empty)
-- ═══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS yi_connect;

COMMENT ON SCHEMA yi_connect IS
  'Yi Connect — chapter operations & management platform. '
  'Sibling to public.* (YIP) and future.* (YiFuture) in the shared Yi DB. '
  'Plugs into yi_directory.people and yi.chapters for cross-app identity.';

-- Grants mirroring how YIP set up yi_directory (migration 023) and
-- YiFuture set up yi (migration 128).
GRANT USAGE ON SCHEMA yi_connect TO authenticated, anon, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA yi_connect
  GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA yi_connect
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA yi_connect
  GRANT ALL ON SEQUENCES TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
