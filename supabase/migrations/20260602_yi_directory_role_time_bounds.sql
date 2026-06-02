-- yi_directory role time-bounds (valid_from / valid_until) — 2026-06-02
-- APPLIED to prod (bkmpbcoxbjyafieabxao) via the Management API; this file is
-- the committed artifact for history/greppability. No CI auto-applies it.
--
-- Effective-active = stored is_active AND now() within [valid_from, valid_until].
-- NO defaults / NO backfill: existing rows get NULL/NULL = open window =
-- unchanged behaviour. Fail-closed: a malformed/inverted window denies.

ALTER TABLE yi_directory.role_assignments
  ADD COLUMN IF NOT EXISTS valid_from  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz NULL;

COMMENT ON COLUMN yi_directory.role_assignments.valid_from  IS
  'Inclusive lower bound; NULL = active from creation. Effective-active requires now() >= valid_from.';
COMMENT ON COLUMN yi_directory.role_assignments.valid_until IS
  'Inclusive upper bound; NULL = no expiry. Effective-active requires now() <= valid_until.';

ALTER TABLE yi_directory.role_assignments
  ADD CONSTRAINT role_assignments_valid_window_ck
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until >= valid_from);

CREATE INDEX IF NOT EXISTS idx_role_assignments_valid_until
  ON yi_directory.role_assignments (valid_until)
  WHERE is_active = true AND valid_until IS NOT NULL;

-- SQL-plane enforcement: the same window predicate was AND-ed into the 4
-- SECURITY DEFINER auth functions that read role_assignments OUTSIDE the TS
-- funnel, so both planes agree:
--   • public.yifi_check_organiser
--   • yi_connect.get_user_roles
--   • yi_connect.get_user_roles_detailed
--   • yi_directory.current_user_can_see
-- Predicate added beside their existing `ra.is_active` filter:
--   AND (valid_from IS NULL OR now() >= valid_from)
--   AND (valid_until IS NULL OR now() <= valid_until)
--
-- FLAG (pre-existing, NOT changed here): get_user_roles / get_user_roles_detailed
-- / current_user_can_see still match LEGACY role names (super_admin / national /
-- platform_admin) retired by the 2026-06-01 rename — a separate drift to fix.
