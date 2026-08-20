-- Awards that can differ by ROUND LEVEL (chapter / regional / national).
--
-- THE PROBLEM
-- yip.award_definitions is ONE global set of 15 awards shared by every round.
-- The regional award set is genuinely different from the chapter one (Director,
-- 2026-08-18): about half the awards overlap, the rest are regional-only, and
-- both sets must coexist. Today the only way to run a regional round with its
-- own awards is to edit the shared 15 — which silently re-awards every chapter
-- round too, because results are recomputed on demand.
--
-- THE SHAPE (same pattern as yip_session_parameters_round_level.sql; see the
-- four-step recipe at the top of lib/yip/round-level.ts)
--   levels IS NULL                -> applies to EVERY level (what all 15 rows mean today)
--   levels = '{regional}'         -> regional rounds only
--   levels = '{chapter,regional}' -> one award serving two levels, no duplicate row
-- Reusing public.event_level (rather than text + a CHECK list) keeps ONE
-- definition of "what a level is", shared with yip.events.level.
--
-- ZERO BEHAVIOUR CHANGE FOR CHAPTER ROUNDS
-- The column is added with no default and left NULL on all 15 existing rows.
-- NULL means "every level", which is exactly how those rows behave today. The
-- resolver (pickByLevel) prefers level-scoped rows and falls back to the global
-- tier, so a chapter event still resolves the same 15 rows, with the same keys,
-- labels, recipient counts, eligibility, rank_mode and rank_keys. No existing
-- row is modified by this migration and no result is recomputed.
--
-- WHY THE KEY MOVES (and why the primary key becomes a surrogate id)
-- Seven of the regional awards are the SAME award as a chapter one and keep the
-- same award_key (best_parliamentarian, best_speaker, best_debater,
-- leadership_excellence, best_member_ruling, best_member_opposition,
-- exemplary_decorum) so that per-event overrides (yip.event_award_config) and
-- per-zone qualification config (yip.zone_award_config) — both keyed by
-- award_key — keep meaning the same award at either level. That makes award_key
-- non-unique, so it can no longer be the primary key. A surrogate `id` becomes
-- the row identity and uniqueness moves to (award_key, levels) NULLS NOT
-- DISTINCT — which preserves the old guarantee exactly: still at most ONE global
-- row per award_key. The new index is created BEFORE the old constraint is
-- dropped and it all runs in one transaction, so uniqueness is never unguarded.
--
-- THE FOREIGN KEY THAT HAS TO GO
-- yip.event_award_config.award_key REFERENCES yip.award_definitions(award_key)
-- ON DELETE CASCADE. A foreign key must point at a UNIQUE column, and award_key
-- stops being unique here, so the constraint is dropped. In practice it was
-- already unreachable: the app has NO delete path for award definitions (see
-- app/yip/actions/admin-awards.ts — list + update only; rows are seeded by
-- migration), so the cascade could never fire. This also makes the two
-- award_key-referencing tables consistent — yip.zone_award_config has never had
-- an FK on award_key. After this migration award_key is a shared VOCABULARY term
-- that three tables speak, not a pointer to one definition row.
--
-- SAFE ON A LIVE ROUND
-- Additive apart from the key swap: two new columns, one new unique index, the
-- primary key moved to a surrogate id, one unreachable FK dropped, 15 new rows
-- inserted. No column is dropped, no existing row is rewritten, no NOT NULL is
-- added to an existing column. The table holds 15 rows, so the brief ACCESS
-- EXCLUSIVE lock is instantaneous. Idempotent.

BEGIN;

-- 1. Row identity. Existing rows each get a fresh uuid; the column is only
--    promoted to primary key in step 5, after the wider unique key exists.
ALTER TABLE yip.award_definitions
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

-- 2. The scope column. No DEFAULT: existing rows stay NULL = "every level".
ALTER TABLE yip.award_definitions
  ADD COLUMN IF NOT EXISTS levels public.event_level[];

COMMENT ON COLUMN yip.award_definitions.levels IS
  'Round levels this award applies to. NULL = every level (the default, and how all pre-2026-08 rows behave). Resolution takes the level-scoped SET when one exists and falls back to the NULL-scoped set; an award scoped to a DIFFERENT level is never used.';

-- 3. Shape guard: an EMPTY array would be ambiguous against NULL, so forbid it.
--    Valid values are already constrained by the enum type itself.
ALTER TABLE yip.award_definitions
  DROP CONSTRAINT IF EXISTS award_definitions_levels_not_empty;
ALTER TABLE yip.award_definitions
  ADD CONSTRAINT award_definitions_levels_not_empty
  CHECK (levels IS NULL OR array_length(levels, 1) >= 1);

-- 4. Widen the uniqueness key, new index FIRST so no window is left unguarded.
CREATE UNIQUE INDEX IF NOT EXISTS award_definitions_award_key_levels_key
  ON yip.award_definitions (award_key, levels) NULLS NOT DISTINCT;

-- 5. Move the primary key off award_key. The dependent FK must go first (see
--    "THE FOREIGN KEY THAT HAS TO GO" above).
ALTER TABLE yip.event_award_config
  DROP CONSTRAINT IF EXISTS event_award_config_award_key_fkey;

ALTER TABLE yip.award_definitions
  DROP CONSTRAINT IF EXISTS award_definitions_pkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'yip'
      AND t.relname = 'award_definitions'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE yip.award_definitions ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 6. The REGIONAL award set (Director, 2026-08-18). Scoped '{regional}', so the
--    15 global rows above are untouched and chapter rounds resolve exactly as
--    before. Seven rows deliberately REUSE a chapter award_key (same award,
--    different level) — that is what the widened unique key above is for.
--
--    eligibility / rank_mode / rank_keys use the same vocabulary the existing
--    rows use (lib/yip/award-formula.ts); results.ts buildSpec() interprets them.
--    Two awards have NO derivable automatic basis and are seeded INACTIVE and
--    inert (rank_keys '{}' scores 0 for everyone, and the engine never awards on
--    a zero) so nothing is auto-assigned on a guess; the chair picks the winner
--    by hand from the event's Results page, which the manual-override final pass
--    applies regardless of is_active.
INSERT INTO yip.award_definitions
  (award_key, label, basis_description, is_team, is_active, display_order, eligibility, rank_mode, rank_keys, levels)
VALUES
  ('best_parliamentarian','Best Parliamentarian','Strongest overall parliamentarian across the two days — leadership, research, debate, parliamentary conduct and contribution to the House.',false,true,1,'all','overall_total','{}','{regional}'),
  ('best_speaker','Best Speaker','Impartial and confident conduct of proceedings — command of procedure, discipline, and effective management of the House.',false,true,2,'speaker','overall_total','{}','{regional}'),
  ('leadership_excellence','Parliamentary Leadership','Outstanding leadership through strategic thinking, collaboration, decision-making and guiding others to meaningful outcomes.',false,true,3,'leadership','leadership_blend','{}','{regional}'),
  ('best_member_ruling','Best Treasury Bench Member','The ruling-bench member who most effectively presents and defends Government positions.',false,true,4,'ruling','family_sum','{pol,qh,bill}','{regional}'),
  ('best_member_opposition','Best Opposition Member','The opposition member who most effectively holds the Government accountable.',false,true,5,'opposition','family_sum','{qh,zero,pol}','{regional}'),
  ('best_debater','Outstanding Parliamentary Debater','Exceptional argumentation, logic, articulation and rebuttal, engaging opposing viewpoints.',false,true,6,'all','family_sum','{pol,qh}','{regional}'),
  ('political_strategist','Political Strategist','Coalition-building, negotiation, floor strategy, alliances, vote mobilisation and political judgement.',false,true,7,'all','family_sum','{pol}','{regional}'),
  ('exemplary_decorum','Excellence in Parliamentary Conduct','Exemplary decorum, discipline, ethics and respect for parliamentary traditions.',false,true,8,'no_disciplinary','family_sum','{mupi.conduct,zero.conduct,bill.conduct}','{regional}'),
  ('best_parliamentary_journalist','Best Parliamentary Journalist','Strongest, most accurate and engaging coverage of proceedings. Chosen by hand — no scored session measures press coverage, so this award is never auto-assigned; pin the winner from the event''s Results page.',false,false,9,'all','family_sum','{}','{regional}'),
  ('best_parliamentary_administrator','Best Parliamentary Administrator','Exceptional organisation, impartiality, documentation and procedural coordination. Chosen by hand — no scored session measures secretariat work, so this award is never auto-assigned; pin the winner from the event''s Results page.',false,false,10,'all','family_sum','{}','{regional}'),
  ('best_private_members_bill','Best Private Member''s Bill','Strongest Private Member''s Bill on relevance, originality, legislative quality, practicality and research.',false,true,11,'all','family_sum','{bill}','{regional}'),
  ('best_zero_hour','Best Zero-Hour Parliamentarian','Responds most effectively to unforeseen national developments — presence of mind, clarity and practicality.',false,true,12,'all','family_sum','{zero}','{regional}'),
  ('best_question_hour','Best Question-Hour Parliamentarian','Strongest quality of questions, research and supplementary questioning, extracting accountability.',false,true,13,'all','family_sum','{qh}','{regional}'),
  ('best_minister','Best Minister','Presents and defends Government bills, responds during Zero Hour and answers during Question Hour — judged on cumulative participation.',false,true,14,'leadership','family_sum','{bill,zero,qh}','{regional}'),
  ('outstanding_committee_member','Outstanding Committee Member','Exceptional contribution to the Parliamentary Committee — research, deliberation, collaborative thinking and policy analysis.',false,true,15,'all','family_sum','{cmte}','{regional}')
ON CONFLICT (award_key, levels) DO NOTHING;

COMMIT;
