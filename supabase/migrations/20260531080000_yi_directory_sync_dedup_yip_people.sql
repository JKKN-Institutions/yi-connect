-- yi_directory_sync_dedup_yip_people
-- Integrity cleanup (2026-05-31).
--
-- PROBLEM (root cause confirmed):
--   The yip -> yi_directory people sync (app/yip/actions/admin-team.ts:176) uses a raw
--   .insert() with NO onConflict, writing rows with email = NULL. The only uniqueness
--   guard on yi_directory.people is UNIQUE(email), which Postgres does NOT enforce across
--   NULLs. Result: every sync run created a fresh person row. The auth-link path later made
--   a THIRD row carrying the real email + user_id, never reconciled to source_yip_profile_id.
--
--   6 humans (regional admins) each exist as 3 person rows:
--     row A  yip-sync 2026-05-21  source set, email NULL, role yip/rm
--     row B  yip-sync 2026-05-25  SAME source,  email NULL, role yip/rm        <- pure dup
--     row C  auth     2026-05-28  source NULL, email+user_id set, role yip/regional_admin
--
-- NOTE: yi_directory.role_assignments already has UNIQUE uq_role_assignment_scope
--   (person_id, app, role, COALESCE(yi_chapter,''), yi_year). Duplicate roles therefore
--   exist only ACROSS person_ids. When we merge person rows we must DELETE colliding
--   duplicate roles, not re-point them (re-pointing would violate that constraint).
--
-- STRATEGY (atomic; aborts with zero changes if the count assertion fails):
--   STEP 1  Collapse rows sharing source_yip_profile_id (same person by definition).
--   STEP 2  Merge surviving sync row INTO the auth row (canonical = has user_id),
--           backfilling source_yip_profile_id onto it. Scoped to the 6 known names.
--   STEP 3  Remove the "Sandbox" test-chapter role (leave its auth user intact).
--   STEP 4  Add the people source-id UNIQUE indexes that prevent recurrence.
--
-- Expected post-state: people 98 -> 86 ; role_assignments 99 -> 92.
-- Pre-change backup: backups/yd_*_2026-05-31.json.

BEGIN;

DO $$
DECLARE p_before int; r_before int;
BEGIN
  SELECT count(*) INTO p_before FROM yi_directory.people;
  SELECT count(*) INTO r_before FROM yi_directory.role_assignments;
  RAISE NOTICE 'BEFORE: people=%, role_assignments=%', p_before, r_before;
END $$;

-- ── STEP 1: collapse duplicate yip-syncs (same source_yip_profile_id) ──────
-- 1a: re-point roles to the keeper ONLY where the keeper lacks an equivalent role.
WITH ranked AS (
  SELECT id, source_yip_profile_id,
         row_number() OVER (PARTITION BY source_yip_profile_id
                            ORDER BY created_at ASC, id ASC) AS rn
  FROM yi_directory.people WHERE source_yip_profile_id IS NOT NULL
),
keep AS (SELECT source_yip_profile_id, id AS keep_id FROM ranked WHERE rn = 1),
dropped AS (
  SELECT r.id AS drop_id, k.keep_id
  FROM ranked r JOIN keep k USING (source_yip_profile_id) WHERE r.rn > 1
)
UPDATE yi_directory.role_assignments ra
SET person_id = d.keep_id
FROM dropped d
WHERE ra.person_id = d.drop_id
  AND NOT EXISTS (
    SELECT 1 FROM yi_directory.role_assignments k
    WHERE k.person_id = d.keep_id AND k.app = ra.app AND k.role = ra.role
      AND COALESCE(k.yi_chapter,'') = COALESCE(ra.yi_chapter,'') AND k.yi_year = ra.yi_year
  );

-- 1b: delete the now-redundant colliding roles still attached to drop rows.
WITH ranked AS (
  SELECT id, source_yip_profile_id,
         row_number() OVER (PARTITION BY source_yip_profile_id
                            ORDER BY created_at ASC, id ASC) AS rn
  FROM yi_directory.people WHERE source_yip_profile_id IS NOT NULL
),
dropped AS (SELECT id AS drop_id FROM ranked WHERE rn > 1)
DELETE FROM yi_directory.role_assignments ra USING dropped d WHERE ra.person_id = d.drop_id;

-- 1c: delete the drop person rows.
WITH ranked AS (
  SELECT id, source_yip_profile_id,
         row_number() OVER (PARTITION BY source_yip_profile_id
                            ORDER BY created_at ASC, id ASC) AS rn
  FROM yi_directory.people WHERE source_yip_profile_id IS NOT NULL
)
DELETE FROM yi_directory.people p USING ranked r WHERE p.id = r.id AND r.rn > 1;

-- ── STEP 2: merge surviving sync row into the auth (canonical) row ─────────
-- 2a: backfill the source link onto the canonical auth row.
WITH names(full_name) AS (
  VALUES ('Poornima Venkatesh'), ('Punit Singhal'), ('Sakshi Agarwal'),
         ('Shenher Lal'), ('Shivani Loya'), ('Shruti Sarawagi')
),
synced AS (
  SELECT p.id, p.full_name, p.source_yip_profile_id
  FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.source_yip_profile_id IS NOT NULL AND p.user_id IS NULL
),
authrow AS (
  SELECT p.id, p.full_name FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.user_id IS NOT NULL AND p.source_yip_profile_id IS NULL
),
pair AS (
  SELECT s.full_name, s.id AS synced_id, a.id AS auth_id, s.source_yip_profile_id
  FROM synced s JOIN authrow a USING (full_name)
  WHERE (SELECT count(*) FROM synced s2  WHERE s2.full_name = s.full_name) = 1
    AND (SELECT count(*) FROM authrow a2 WHERE a2.full_name = s.full_name) = 1
)
UPDATE yi_directory.people p
SET source_yip_profile_id = pr.source_yip_profile_id, updated_at = now()
FROM pair pr WHERE p.id = pr.auth_id;

-- 2b: re-point the synced row's roles to the canonical auth row (collision-guarded).
WITH names(full_name) AS (
  VALUES ('Poornima Venkatesh'), ('Punit Singhal'), ('Sakshi Agarwal'),
         ('Shenher Lal'), ('Shivani Loya'), ('Shruti Sarawagi')
),
synced AS (
  SELECT p.id, p.full_name FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.user_id IS NULL AND p.source_yip_profile_id IS NOT NULL
),
authrow AS (
  SELECT p.id, p.full_name FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.user_id IS NOT NULL
),
pair AS (SELECT s.id AS synced_id, a.id AS auth_id FROM synced s JOIN authrow a USING (full_name))
UPDATE yi_directory.role_assignments ra
SET person_id = pr.auth_id
FROM pair pr
WHERE ra.person_id = pr.synced_id
  AND NOT EXISTS (
    SELECT 1 FROM yi_directory.role_assignments k
    WHERE k.person_id = pr.auth_id AND k.app = ra.app AND k.role = ra.role
      AND COALESCE(k.yi_chapter,'') = COALESCE(ra.yi_chapter,'') AND k.yi_year = ra.yi_year
  );

-- 2c: delete any leftover colliding roles on synced rows, then the synced rows.
WITH names(full_name) AS (
  VALUES ('Poornima Venkatesh'), ('Punit Singhal'), ('Sakshi Agarwal'),
         ('Shenher Lal'), ('Shivani Loya'), ('Shruti Sarawagi')
),
synced AS (
  SELECT p.id FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.user_id IS NULL AND p.source_yip_profile_id IS NOT NULL
)
DELETE FROM yi_directory.role_assignments ra USING synced s WHERE ra.person_id = s.id;

WITH names(full_name) AS (
  VALUES ('Poornima Venkatesh'), ('Punit Singhal'), ('Sakshi Agarwal'),
         ('Shenher Lal'), ('Shivani Loya'), ('Shruti Sarawagi')
)
DELETE FROM yi_directory.people p
USING names n
WHERE p.full_name = n.full_name
  AND p.user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM yi_directory.role_assignments ra WHERE ra.person_id = p.id);

-- ── STEP 3: remove the Sandbox test-chapter role (keep its auth user) ──────
DELETE FROM yi_directory.role_assignments WHERE yi_chapter ILIKE '%sandbox%';

-- ── Post-change count assertion (rolls back the whole txn if unexpected) ───
DO $$
DECLARE p_after int; r_after int;
BEGIN
  SELECT count(*) INTO p_after FROM yi_directory.people;
  SELECT count(*) INTO r_after FROM yi_directory.role_assignments;
  RAISE NOTICE 'AFTER: people=%, role_assignments=%', p_after, r_after;
  IF p_after <> 86 THEN RAISE EXCEPTION 'people=% (expected 86) — aborting', p_after; END IF;
  IF r_after <> 92 THEN RAISE EXCEPTION 'role_assignments=% (expected 92) — aborting', r_after; END IF;
END $$;

-- ── STEP 4: prevent recurrence (the genuinely-missing guards) ──────────────
CREATE UNIQUE INDEX IF NOT EXISTS people_source_yip_profile_uq
  ON yi_directory.people (source_yip_profile_id)
  WHERE source_yip_profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_source_future_team_uq
  ON yi_directory.people (source_future_team_id)
  WHERE source_future_team_id IS NOT NULL;

COMMIT;

-- ── FOLLOW-UP (code, separate change — NOT in this migration) ──────────────
-- app/yip/actions/admin-team.ts:176  change .insert() ->
--   .upsert({...}, { onConflict: 'source_yip_profile_id' })
-- so the next sync updates the existing row instead of erroring on the new index.
