-- ⚠️ DRAFT — DO NOT APPLY. Irreversible. Needs DB snapshot + Director approval.
--
-- Phase 3 of the tier-1 cutover (see docs/tier1-cutover-runbook.md).
--
-- Repoints yip.events away from yip.organizers and onto the canonical
-- yi_directory.people identity store.
--
--   BEFORE: yip.events.chapter_em_id  -> yip.organizers(id)
--           yip.organizers.person_id  -> yi_directory.people(id)
--   AFTER:  yip.events.chapter_em_person_id -> yi_directory.people(id)   [direct]
--
-- ORDERING: deploy the code that writes/reads chapter_em_person_id BEFORE
-- running this file (Phase 3a in the runbook). Run only the ADD + BACKFILL
-- below; leave the DROP COLUMN commented out until a later, separate window.
--
-- Filename starts with DRAFT_ (not a timestamp) on purpose so that
-- `supabase db push` SKIPS this file. Run it by hand after approval.

BEGIN;

-- 1. New direct FK column onto the canonical identity store.
ALTER TABLE yip.events
  ADD COLUMN IF NOT EXISTS chapter_em_person_id uuid
  REFERENCES yi_directory.people(id);

-- 2. Backfill from the existing chapter_em_id -> organizers.person_id mapping.
--    Only touch rows that actually have a chapter EM assigned and whose
--    organizer carries a person_id (it may be null for un-synced legacy rows).
UPDATE yip.events e
SET chapter_em_person_id = o.person_id
FROM yip.organizers o
WHERE e.chapter_em_id = o.id
  AND e.chapter_em_id IS NOT NULL
  AND o.person_id IS NOT NULL
  AND e.chapter_em_person_id IS DISTINCT FROM o.person_id;

-- 3. Helpful index for the new FK (matches the access pattern of the old col).
CREATE INDEX IF NOT EXISTS idx_yip_events_chapter_em_person_id
  ON yip.events (chapter_em_person_id);

-- 4. VERIFY before committing — this SELECT must return ZERO rows. Every event
--    that had a chapter EM should now have a person_id matching the organizer's.
--    Run it manually inside the transaction; if it returns rows, ROLLBACK.
--
--    SELECT e.id, e.chapter_em_id, e.chapter_em_person_id, o.person_id
--    FROM yip.events e
--    JOIN yip.organizers o ON o.id = e.chapter_em_id
--    WHERE e.chapter_em_id IS NOT NULL
--      AND o.person_id IS NOT NULL
--      AND e.chapter_em_person_id IS DISTINCT FROM o.person_id;

-- 5. IRREVERSIBLE — DO NOT RUN IN THE SAME WINDOW AS 1–3.
--    Only after the app has run on chapter_em_person_id for a full release
--    cycle with zero errors (Phase 3c in the runbook). Rollback after this
--    point requires the DB snapshot. Uncomment, get Director sign-off, run.
--
-- ALTER TABLE yip.events DROP COLUMN chapter_em_id;

COMMIT;

-- ── ROLLBACK (before the DROP COLUMN step) ───────────────────────────────
-- Safe and reversible because the old chapter_em_id column is untouched:
--
--   BEGIN;
--   DROP INDEX IF EXISTS yip.idx_yip_events_chapter_em_person_id;
--   ALTER TABLE yip.events DROP COLUMN IF EXISTS chapter_em_person_id;
--   COMMIT;
