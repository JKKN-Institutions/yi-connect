-- yi_directory_sync_dedup_yip_people
-- Integrity cleanup (2026-05-31).
--
-- PROBLEM (root cause confirmed):
--   The yip -> yi_directory people sync (app/yip/actions/admin-team.ts:176) uses a raw
--   .insert() with NO onConflict, writing rows with email = NULL. The only uniqueness
--   guard on yi_directory.people is UNIQUE(email), which Postgres does NOT enforce across
--   NULLs, so every sync run created a fresh person row. The auth-link path later made a
--   THIRD row carrying the real email + user_id, never reconciled to source_yip_profile_id.
--
--   6 humans (regional admins) each exist as 3 person rows:
--     2x yip-sync  (same source_yip_profile_id, email NULL, role yip/rm)
--     1x auth      (source NULL, email+user_id set, role yip/regional_admin)
--
-- FACTS verified before writing this:
--   * role_assignments_person_id_fkey is ON DELETE CASCADE — deleting a person auto-removes
--     its role_assignments. Other person FKs (yip.organizers, yip.participants, profiles,
--     future.chapter_core_team) are SET NULL; yifi.organiser_roles is NO ACTION (none of the
--     6 merged people appear there).
--   * role_assignments already has UNIQUE uq_role_assignment_scope
--     (person_id, app, role, COALESCE(yi_chapter,''), yi_year).
--
-- STRATEGY (single transaction):
--   1  Backfill source_yip_profile_id onto the canonical auth row (so the next sync matches).
--   2  Move ONE yip/rm role per cluster onto the auth row (preserve the org role; the auth
--      row already holds yip/regional_admin). DISTINCT ON picks exactly one to avoid the
--      uq_role_assignment_scope collision.
--   3  Delete the 12 duplicate synced person rows; CASCADE clears their remaining roles.
--   4  Remove the "Sandbox" test-chapter role (its auth user is left intact).
--   5  Add the people source-id UNIQUE indexes that prevent recurrence.
--
-- Expected post-state: people 98 -> 86 ; role_assignments 99 -> 92.
-- Verified post-commit in a separate query (this MCP path has unreliable in-txn read
-- visibility, so no in-transaction count assertion is used). Backup: backups/yd_*_2026-05-31.json.

BEGIN;

-- 1: backfill the source link onto the canonical auth rows
UPDATE yi_directory.people a
SET source_yip_profile_id = s.src, updated_at = now()
FROM (
  SELECT full_name, max(source_yip_profile_id::text)::uuid AS src
  FROM yi_directory.people
  WHERE user_id IS NULL AND source_yip_profile_id IS NOT NULL
    AND full_name IN ('Poornima Venkatesh','Punit Singhal','Sakshi Agarwal',
                      'Shenher Lal','Shivani Loya','Shruti Sarawagi')
  GROUP BY full_name
) s
WHERE a.full_name = s.full_name AND a.user_id IS NOT NULL AND a.source_yip_profile_id IS NULL;

-- 2: move exactly ONE yip/rm role per cluster onto the auth row
WITH auth AS (
  SELECT id, full_name FROM yi_directory.people
  WHERE user_id IS NOT NULL
    AND full_name IN ('Poornima Venkatesh','Punit Singhal','Sakshi Agarwal',
                      'Shenher Lal','Shivani Loya','Shruti Sarawagi')
),
pick AS (
  SELECT DISTINCT ON (a.id) ra.id AS role_id, a.id AS auth_id
  FROM auth a
  JOIN yi_directory.people s ON s.full_name = a.full_name AND s.user_id IS NULL
  JOIN yi_directory.role_assignments ra
       ON ra.person_id = s.id AND ra.app = 'yip' AND ra.role = 'rm'
  WHERE NOT EXISTS (
    SELECT 1 FROM yi_directory.role_assignments k
    WHERE k.person_id = a.id AND k.app = 'yip' AND k.role = 'rm'
      AND COALESCE(k.yi_chapter,'') = COALESCE(ra.yi_chapter,'') AND k.yi_year = ra.yi_year
  )
  ORDER BY a.id, ra.created_at ASC, ra.id ASC
)
UPDATE yi_directory.role_assignments ra
SET person_id = p.auth_id
FROM pick p WHERE ra.id = p.role_id;

-- 3: delete the duplicate synced person rows (CASCADE clears their leftover roles)
DELETE FROM yi_directory.people
WHERE user_id IS NULL AND source_yip_profile_id IS NOT NULL
  AND full_name IN ('Poornima Venkatesh','Punit Singhal','Sakshi Agarwal',
                    'Shenher Lal','Shivani Loya','Shruti Sarawagi');

-- 4: remove the Sandbox test-chapter role (keep its auth user)
DELETE FROM yi_directory.role_assignments WHERE yi_chapter ILIKE '%sandbox%';

-- 5: prevent recurrence (the genuinely-missing guards)
CREATE UNIQUE INDEX IF NOT EXISTS people_source_yip_profile_uq
  ON yi_directory.people (source_yip_profile_id) WHERE source_yip_profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS people_source_future_team_uq
  ON yi_directory.people (source_future_team_id) WHERE source_future_team_id IS NOT NULL;

COMMIT;

-- ── FOLLOW-UP (code, separate change — NOT in this migration) ──────────────
-- app/yip/actions/admin-team.ts:176  change .insert() ->
--   .upsert({...}, { onConflict: 'source_yip_profile_id' })
-- so the next sync updates the existing row instead of erroring on people_source_yip_profile_uq.
