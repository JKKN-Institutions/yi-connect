-- YIP bill — align to the OFFICIAL national "Mock Parliament Bill Template".
--
-- The official template has 9 sections: Title, Preamble, Definitions,
-- Objectives (2-4), Key Provisions, Implementation Plan, Funding/Budget,
-- Expected Impact, Conclusion/Call to Action. The app previously captured only
-- Title, Objective (single), Problem Statement, Provisions, Expected Impact,
-- Implementation. This adds the missing sections.
--
-- Mapping decisions (director sign-off 2026-06-27):
--   • Problem Statement folds INTO the Preamble (the template has no separate
--     problem field) — backfilled here; the legacy column is kept and mirrored
--     by the app so existing readers keep working.
--   • Objective (single) becomes Objectives (a 2-4 list of {id,text}). The
--     single column is kept and mirrored (joined) for legacy readers.
--
-- Additive + idempotent. Applied to prod (bkmpbcoxbjyafieabxao) via the
-- Management API; this file is the record.

ALTER TABLE yip.bills
  ADD COLUMN IF NOT EXISTS preamble      text,
  ADD COLUMN IF NOT EXISTS definitions   text,
  ADD COLUMN IF NOT EXISTS funding_budget text,
  ADD COLUMN IF NOT EXISTS conclusion    text,
  ADD COLUMN IF NOT EXISTS objectives    jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill the Preamble from the old Problem Statement (only when empty).
UPDATE yip.bills
SET preamble = problem_statement
WHERE (preamble IS NULL OR btrim(preamble) = '')
  AND problem_statement IS NOT NULL
  AND btrim(problem_statement) <> '';

-- Backfill Objectives (the {id,text}[] list) from the old single Objective.
UPDATE yip.bills
SET objectives = jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'text', objective)
    )
WHERE (objectives IS NULL OR objectives = '[]'::jsonb)
  AND objective IS NOT NULL
  AND btrim(objective) <> '';
