-- Yi Youth Academy — configurable per-academy certificate signatories
-- (decision 2026-06-11: "choose later in the UI" — no longer hardcoded
--  Chapter Chair / Institution Coordinator).
--
-- Stores an ordered array of signature blocks for the e-certificate, e.g.
--   [{"label":"Chapter Chair","name":"R. Kumar"},
--    {"label":"Faculty Coordinator","name":"Dr. S. Iyer"}]
-- `label` is required per entry; `name` is optional (line stays blank).
-- Empty array → the renderer falls back to the two generic blocks
-- (Chapter Chair / Institution Coordinator) so nothing regresses.
ALTER TABLE yuva.academies
  ADD COLUMN signatories jsonb NOT NULL DEFAULT '[]'::jsonb;
