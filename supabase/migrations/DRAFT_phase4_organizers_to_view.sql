-- ⚠️ DRAFT — DO NOT APPLY. Irreversible. Needs DB snapshot + Director approval.
--
-- Phase 4 of the tier-1 cutover (see docs/tier1-cutover-runbook.md).
--
-- Converts yip.organizers from a base table (kept in sync by triggers) into a
-- read-only VIEW projected directly from the canonical yi_directory store.
-- After this, yip.organizers can NEVER drift from yi_directory again — there is
-- only one source of truth.
--
-- PRE-FLIGHT (all must be true — see runbook Phase 4 pre-flight):
--   * Phase 2 complete: no app code INSERTs/UPDATEs yip.organizers.
--   * Phase 3 complete through 3b: events.chapter_em_id no longer read by app.
--   * Every remaining .from("organizers").select(...) is a pure read whose
--     columns are all reproducible from the view below.
--
-- IRREVERSIBLE: the sync function + triggers are dropped. Rollback requires
-- restoring the renamed base table AND recreating the triggers/function from
-- the snapshot DDL. The base table is RENAMED (not dropped) for exactly this
-- reason — do not drop yip.organizers_old until at least one release later.
--
-- Filename starts with DRAFT_ (not a timestamp) on purpose so that
-- `supabase db push` SKIPS this file. Run it by hand after approval.

BEGIN;

-- 1. Stop the write-side sync. These triggers fired on yip.organizers writes
--    and pushed changes into yi_directory; with the table becoming a view they
--    are obsolete (and a view cannot carry row triggers anyway).
DROP TRIGGER IF EXISTS trg_yip_organizers_sync_write ON yip.organizers;
DROP TRIGGER IF EXISTS trg_yip_organizers_sync_delete ON yip.organizers;
DROP FUNCTION IF EXISTS yi_directory.sync_from_organizer_profile() CASCADE;

-- 2. Preserve the old base table for rollback. RENAME, do not DROP.
ALTER TABLE yip.organizers RENAME TO organizers_old;

-- 3. Recreate yip.organizers as a VIEW over the canonical store.
--    Column set matches the legacy base-table shape so existing readers
--    (adminListTeam, hierarchy, event-access joins) keep working unchanged.
--    Identity fields come from yi_directory.people; role/scope fields come
--    from the active yip role assignment.
CREATE OR REPLACE VIEW yip.organizers AS
SELECT
  p.id                              AS id,          -- person_id IS the organizer id now
  p.full_name                       AS full_name,
  p.email                           AS email,
  p.photo_url                       AS photo_url,
  p.user_id                         AS user_id,
  p.is_active                       AS is_active,
  ra.role                           AS role,
  ra.yi_chapter                     AS chapter_name,
  ra.yi_zone                        AS zone,
  ra.yi_zone                        AS yi_zone_code,
  ra.title                          AS title,
  p.id                              AS person_id,   -- kept for readers that select it
  NULL::text                        AS login_slug,  -- legacy display-only column
  false                             AS is_mock,     -- directory rows are never mock
  ra.created_at                     AS created_at,
  ra.updated_at                     AS updated_at
FROM yi_directory.people p
JOIN yi_directory.role_assignments ra
  ON ra.person_id = p.id
WHERE ra.app = 'yip'
  AND ra.is_active = true;

COMMIT;

-- ── VERIFY (run after commit) ────────────────────────────────────────────
--   SELECT count(*) FROM yip.organizers;             -- via the new view
--   SELECT id, full_name, email, role, person_id     -- spot-check
--   FROM yip.organizers LIMIT 20;
--   Then click through /yip/dashboard/admin/team and the hierarchy UI; every
--   organizers reader must still render.

-- ── ROLLBACK ─────────────────────────────────────────────────────────────
-- Restore the base table and recreate the sync function + triggers from the
-- snapshot DDL (their bodies are NOT reproduced here — pull from the snapshot):
--
--   BEGIN;
--   DROP VIEW IF EXISTS yip.organizers;
--   ALTER TABLE yip.organizers_old RENAME TO organizers;
--   -- CREATE FUNCTION yi_directory.sync_from_organizer_profile() ... (snapshot)
--   -- CREATE TRIGGER trg_yip_organizers_sync_write  ... (snapshot)
--   -- CREATE TRIGGER trg_yip_organizers_sync_delete ... (snapshot)
--   COMMIT;
--
-- Keep yip.organizers_old for at least one release before dropping it.
