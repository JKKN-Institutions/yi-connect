-- Yi Youth Academy — absorb YUVA colleges into the canonical institution master.
-- yi.institutions is the designed master (source_future_college_id backlink column exists
-- for exactly this). Approved, unmerged future.colleges rows not yet mapped get a
-- yi.institutions counterpart so the academy/application institution pickers see the full
-- YUVA network. Idempotent: NOT EXISTS guard on the backlink.

INSERT INTO yi.institutions
  (name, city, state, type, has_yuva_chapter, is_active, source_future_college_id, notes)
SELECT
  c.name,
  c.city,
  c.state,
  'college',
  true,
  true,
  c.id,
  'backfilled from future.colleges for Youth Academy (2026-06-10)'
FROM future.colleges c
WHERE c.is_approved
  AND c.merged_into IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM yi.institutions i WHERE i.source_future_college_id = c.id
  );
