-- ═════════════════════════════════════════════════════════════════════════
-- yi_directory seed: make yi_directory the SINGLE source for Yi-Future admin
-- authorization, with ZERO change to anyone's access.
--
-- Context
-- ───────
-- Two sources disagreed about who is a Yi-Future admin:
--   • yi.national_admins  — 11 rows; is_super_admin (1), is_platform_admin (3).
--     The Admins page listed it and its buttons wrote it.
--   • yi_directory.role_assignments — the declared mother source (CLAUDE.md,
--     2026-05-28); already read by requirePlatformAdmin() and the
--     /national/admin view gate.
--
-- The application change in this PR repoints EVERY Yi-Future gate at
-- yi_directory. Two gates previously read yi.national_admins columns, so
-- their yi_directory equivalents must admit exactly the same people — not
-- one more, not one fewer. This migration performs that backfill.
--
-- What this migration does — 3 rows touched, all additive
-- ──────────────────────────────────────────────────────
--   A. Activate 2 existing app='future' role='platform_admin' rows
--      (director@jkkn.ac.in, piyush.garg@powertekengg.com) which sat
--      is_active = false. vedant@wrs.energy's row is already active.
--      => the "Platform" tier becomes exactly the same 3 people that
--         yi.national_admins.is_platform_admin listed.
--
--   B. Insert 1 app='future' role='allowlist_owner' row for
--      director@jkkn.ac.in, the sole holder of
--      yi.national_admins.is_super_admin.
--      => the "Super admin" tier becomes exactly the same 1 person.
--
-- Why 'allowlist_owner' is a NEW role value rather than a reuse
-- ────────────────────────────────────────────────────────────
-- The cross-app role 'platform_super_admin' has exactly one holder
-- (director), so reusing it would have matched the headcount. It was
-- rejected: the Yi-Future "Promote super" button writes whatever role backs
-- that gate, and platform_super_admin short-circuits YIP, YiFi and Yuva's
-- gates too. A new app='future' value keeps every button's blast radius
-- inside Yi-Future.
--
-- Headcount proof (measured live 2026-08-11, before and after in a
-- ROLLBACKed transaction — see the PR body for the full email lists)
-- ──────────────────────────────────────────────────────────────────
--   requireSuperAdmin()                1  ->  1   (director)
--   isPlatformAdminEmail()             3  ->  3   (director, piyush, vedant)
--   requirePlatformAdmin() STRICT      6  ->  6   (unchanged: A only
--                                                  re-activates roles for
--                                                  people who already passed
--                                                  via other roles, and
--                                                  'allowlist_owner' is not
--                                                  in the STRICT set)
--   /national/admin view gate BROAD   13  -> 13   (same reasoning)
--
-- NOT APPLIED TO PRODUCTION by this PR. Ship the code and this file
-- together: applying the migration alone is harmless (it only activates
-- roles for people who already hold equal-or-greater power), but merging
-- the code WITHOUT this migration would drop director and piyush out of the
-- platform tier and director out of the super tier.
-- ═════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A. Activate the two dormant platform_admin rows ──────────────────────
-- Scoped by email so this is a no-op if the rows are already active or the
-- people rows have moved. Expected: 2 rows.
UPDATE yi_directory.role_assignments r
   SET is_active  = true,
       updated_at = now()
  FROM yi_directory.people p
 WHERE p.id = r.person_id
   AND r.app  = 'future'
   AND r.role = 'platform_admin'
   AND r.is_active IS DISTINCT FROM true
   AND lower(p.email) IN (
         'director@jkkn.ac.in',
         'piyush.garg@powertekengg.com'
       );

-- ── B. Grant allowlist_owner to the single super admin ───────────────────
-- Idempotent via NOT EXISTS: uq_role_assignment_scope is built on an
-- expression (COALESCE(yi_chapter,'')), which ON CONFLICT cannot target.
-- Expected: 1 row.
INSERT INTO yi_directory.role_assignments
       (person_id, app, role, yi_year, is_active, is_primary, title)
SELECT p.id,
       'future',
       'allowlist_owner',
       2026,
       true,
       false,
       'Yi-Future admin allow-list owner (migrated from yi.national_admins.is_super_admin)'
  FROM yi_directory.people p
 WHERE lower(p.email) = 'director@jkkn.ac.in'
   AND NOT EXISTS (
         SELECT 1
           FROM yi_directory.role_assignments r
          WHERE r.person_id = p.id
            AND r.app       = 'future'
            AND r.role      = 'allowlist_owner'
            AND r.yi_year   = 2026
       );

-- Re-activate rather than duplicate if a deactivated row already exists.
UPDATE yi_directory.role_assignments r
   SET is_active  = true,
       updated_at = now()
  FROM yi_directory.people p
 WHERE p.id = r.person_id
   AND r.app  = 'future'
   AND r.role = 'allowlist_owner'
   AND r.is_active IS DISTINCT FROM true
   AND lower(p.email) = 'director@jkkn.ac.in';

-- ── Guard: refuse to commit if the headcounts moved ──────────────────────
-- The whole point of this migration is that nobody gains or loses access.
-- If either tier is not exactly its pre-migration size, abort.
DO $$
DECLARE
  owners   integer;
  platform integer;
BEGIN
  SELECT count(DISTINCT r.person_id) INTO owners
    FROM yi_directory.role_assignments r
   WHERE r.app = 'future' AND r.role = 'allowlist_owner' AND r.is_active;

  SELECT count(DISTINCT r.person_id) INTO platform
    FROM yi_directory.role_assignments r
   WHERE r.app = 'future' AND r.role = 'platform_admin' AND r.is_active;

  RAISE NOTICE 'allowlist_owner holders: %  (expected 1)', owners;
  RAISE NOTICE 'platform_admin holders:  %  (expected 3)', platform;

  IF owners <> 1 THEN
    RAISE EXCEPTION
      'Aborting: expected exactly 1 allowlist_owner, found %. '
      'yi.national_admins.is_super_admin had 1 row. Investigate before applying.',
      owners;
  END IF;

  IF platform <> 3 THEN
    RAISE EXCEPTION
      'Aborting: expected exactly 3 platform_admin holders, found %. '
      'yi.national_admins.is_platform_admin had 3 rows. Investigate before applying.',
      platform;
  END IF;
END $$;

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- BEGIN;
--   UPDATE yi_directory.role_assignments r SET is_active = false
--     FROM yi_directory.people p
--    WHERE p.id = r.person_id AND r.app = 'future'
--      AND r.role = 'allowlist_owner' AND lower(p.email) = 'director@jkkn.ac.in';
--   UPDATE yi_directory.role_assignments r SET is_active = false
--     FROM yi_directory.people p
--    WHERE p.id = r.person_id AND r.app = 'future' AND r.role = 'platform_admin'
--      AND lower(p.email) IN ('director@jkkn.ac.in','piyush.garg@powertekengg.com');
-- COMMIT;
--
-- NOTE: the rollback only makes sense while the OLD code (reading
-- yi.national_admins) is deployed. Rolling this back under the new code
-- locks director out of the Admins page.
