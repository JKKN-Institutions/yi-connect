-- Yi Youth Academy — seed: ONE placeholder draft program template.
-- The Director's program-template document content gets entered by National via the UI
-- (decision 2026-06-10: single template format, National-only authoring). Idempotent.

INSERT INTO yuva.programs (title, category, objective, summary, status)
SELECT
  '[Program template — awaiting content from National]',
  'entrepreneurship',
  NULL,
  'Placeholder draft seeded at launch. National admins: edit this program (or create new ones) using the Program Creation Template — Part A overview, session plan with names, durations, learning objectives and session documents.',
  'draft'
WHERE NOT EXISTS (SELECT 1 FROM yuva.programs);
