-- yi_directory_sync_dedup_yip_people
-- Integrity cleanup (2026-05-31) — DRAFT, review before applying.
--
-- PROBLEM (root cause confirmed):
--   The yip -> yi_directory people sync (app/yip/actions/admin-team.ts:176) uses a raw
--   .insert() with NO onConflict, and writes rows with email = NULL. The only uniqueness
--   guard on yi_directory.people is UNIQUE(email), which Postgres does NOT enforce across
--   NULLs. Result: every sync run created a fresh person row. The auth-link path later made
--   a THIRD row carrying the real email + user_id, never reconciled to source_yip_profile_id.
--
--   Net effect: 6 humans (regional admins) each exist as 3 person rows:
--     row A  yip-sync  2026-05-21  source_yip_profile_id set, email NULL, role yip/rm
--     row B  yip-sync  2026-05-25  SAME source_yip_profile_id, email NULL, role yip/rm   <- pure dup
--     row C  auth      2026-05-28  source NULL, email+user_id set,        role yip/regional_admin
--
-- STRATEGY (safe -> riskier, all inside one transaction with count assertions):
--   STEP 1  Collapse rows sharing source_yip_profile_id (definitionally the same person).
--   STEP 2  Merge surviving sync row INTO the auth row (canonical = the one with user_id),
--           backfilling source_yip_profile_id onto it. Scoped to the 6 known names + 1:1 guard.
--   STEP 3  De-duplicate role_assignments (keep earliest per natural key).
--   STEP 4  Remove the "Sandbox" test-chapter role (leave its auth user intact).
--   STEP 5  Add the UNIQUE indexes that prevent recurrence.
--
-- Expected post-state: people 98 -> 86 ; role_assignments 99 -> 92.
-- A backup of both tables (pre-change) lives in backups/yd_*_2026-05-31.json.

BEGIN;

-- ── Pre-flight snapshot of counts ─────────────────────────────────────────
DO $$
DECLARE p_before int; r_before int;
BEGIN
  SELECT count(*) INTO p_before FROM yi_directory.people;
  SELECT count(*) INTO r_before FROM yi_directory.role_assignments;
  RAISE NOTICE 'BEFORE: people=%, role_assignments=%', p_before, r_before;
END $$;

-- ── STEP 1: collapse duplicate yip-syncs (same source_yip_profile_id) ──────
WITH ranked AS (
  SELECT id, source_yip_profile_id,
         row_number() OVER (PARTITION BY source_yip_profile_id
                            ORDER BY created_at ASC, id ASC) AS rn
  FROM yi_directory.people
  WHERE source_yip_profile_id IS NOT NULL
),
keep AS (SELECT source_yip_profile_id, id AS keep_id FROM ranked WHERE rn = 1),
dropped AS (
  SELECT r.id AS drop_id, k.keep_id
  FROM ranked r JOIN keep k USING (source_yip_profile_id)
  WHERE r.rn > 1
)
UPDATE yi_directory.role_assignments ra
SET person_id = d.keep_id
FROM dropped d
WHERE ra.person_id = d.drop_id;

WITH ranked AS (
  SELECT id, source_yip_profile_id,
         row_number() OVER (PARTITION BY source_yip_profile_id
                            ORDER BY created_at ASC, id ASC) AS rn
  FROM yi_directory.people
  WHERE source_yip_profile_id IS NOT NULL
)
DELETE FROM yi_directory.people p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- ── STEP 2: merge surviving sync row into the auth (canonical) row ─────────
-- Canonical = the row that already carries user_id (the real login identity).
-- Scoped to the 6 known duplicate names, with a strict 1-synced + 1-auth guard.
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
  SELECT p.id, p.full_name
  FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.user_id IS NOT NULL AND p.source_yip_profile_id IS NULL
),
pair AS (
  SELECT s.full_name, s.id AS synced_id, a.id AS auth_id, s.source_yip_profile_id
  FROM synced s JOIN authrow a USING (full_name)
  WHERE (SELECT count(*) FROM synced s2  WHERE s2.full_name = s.full_name) = 1
    AND (SELECT count(*) FROM authrow a2 WHERE a2.full_name = s.full_name) = 1
)
-- 2a: backfill the source link onto the canonical auth row
UPDATE yi_directory.people p
SET source_yip_profile_id = pr.source_yip_profile_id,
    updated_at = now()
FROM pair pr WHERE p.id = pr.auth_id;

WITH names(full_name) AS (
  VALUES ('Poornima Venkatesh'), ('Punit Singhal'), ('Sakshi Agarwal'),
         ('Shenher Lal'), ('Shivani Loya'), ('Shruti Sarawagi')
),
synced AS (
  SELECT p.id, p.full_name FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.user_id IS NULL
    AND p.id NOT IN (SELECT id FROM yi_directory.people WHERE user_id IS NOT NULL)
),
authrow AS (
  SELECT p.id, p.full_name FROM yi_directory.people p JOIN names n USING (full_name)
  WHERE p.user_id IS NOT NULL
),
pair AS (SELECT s.id AS synced_id, a.id AS auth_id FROM synced s JOIN authrow a USING (full_name))
-- 2b: re-point the synced row's roles to the canonical auth row
UPDATE yi_directory.role_assignments ra
SET person_id = pr.auth_id
FROM pair pr WHERE ra.person_id = pr.synced_id;

WITH names(full_name) AS (
  VALUES ('Poornima Venkatesh'), ('Punit Singhal'), ('Sakshi Agarwal'),
         ('Shenher Lal'), ('Shivani Loya'), ('Shruti Sarawagi')
)
-- 2c: delete the now-emptied synced rows (name-matched, no user_id, no roles left)
DELETE FROM yi_directory.people p
USING names n
WHERE p.full_name = n.full_name
  AND p.user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM yi_directory.role_assignments ra WHERE ra.person_id = p.id);

-- ── STEP 3: de-duplicate role_assignments (keep earliest per natural key) ──
WITH ranked AS (
  SELECT id, row_number() OVER (
           PARTITION BY person_id, app, role, yi_year,
                        COALESCE(yi_chapter, ''), COALESCE(yi_zone, '')
           ORDER BY created_at ASC, id ASC) AS rn
  FROM yi_directory.role_assignments
)
DELETE FROM yi_directory.role_assignments ra
USING ranked r
WHERE ra.id = r.id AND r.rn > 1;

-- ── STEP 4: remove the Sandbox test-chapter role (keep its auth user) ──────
DELETE FROM yi_directory.role_assignments
WHERE yi_chapter ILIKE '%sandbox%';

-- ── Post-change count assertion (fails the txn if unexpected) ──────────────
DO $$
DECLARE p_after int; r_after int;
BEGIN
  SELECT count(*) INTO p_after FROM yi_directory.people;
  SELECT count(*) INTO r_after FROM yi_directory.role_assignments;
  RAISE NOTICE 'AFTER: people=%, role_assignments=%', p_after, r_after;
  IF p_after <> 86 THEN
    RAISE EXCEPTION 'people count = % (expected 86) — aborting', p_after;
  END IF;
  IF r_after <> 92 THEN
    RAISE EXCEPTION 'role_assignments count = % (expected 92) — aborting', r_after;
  END IF;
END $$;

-- ── STEP 5: prevent recurrence ────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS people_source_yip_profile_uq
  ON yi_directory.people (source_yip_profile_id)
  WHERE source_yip_profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_source_future_team_uq
  ON yi_directory.people (source_future_team_id)
  WHERE source_future_team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS role_assignments_natural_uq
  ON yi_directory.role_assignments
     (person_id, app, role, yi_year, (COALESCE(yi_chapter, '')), (COALESCE(yi_zone, '')));

COMMIT;

-- ── FOLLOW-UP (code, separate change — NOT in this migration) ──────────────
-- app/yip/actions/admin-team.ts:176  must change from .insert() to
--   .upsert({...}, { onConflict: 'source_yip_profile_id' })
-- otherwise the next sync re-creates duplicates despite the new index
-- (the index would instead start throwing 23505 errors — also a signal, but
--  an upsert is the correct fix).
