-- Yi Youth Academy — seed: the 7 launch academies (Director + national stakeholder, 2026-06-10).
-- Chapter names VALIDATED against the live DB canonical spellings (yi.chapters /
-- yi_directory.role_assignments.yi_chapter): note "Nashik" (canonical), not "Nasik" (email).
-- institution_id NULL (partner institutions not yet known — attachable later);
-- logo_storage_path NULL until the Director sends real logos (UI renders a fallback).
-- Idempotent per chapter.

INSERT INTO yuva.academies (chapter, display_name, is_active, capacity_norm)
SELECT v.chapter, 'Yi ' || v.chapter || ' Youth Academy', true, 50
FROM (VALUES
  ('Dehradun'),
  ('Kolkata'),
  ('Chennai'),
  ('Coimbatore'),
  ('Erode'),
  ('Nashik'),
  ('Bengaluru')
) AS v(chapter)
WHERE NOT EXISTS (
  SELECT 1 FROM yuva.academies a WHERE a.chapter = v.chapter
);
