-- Repair the Best Parliamentarian award definition. A QA/admin-editor test save
-- (2026-06-24) corrupted the GLOBAL yip.award_definitions row: eligibility was set
-- to 'leadership' (should be open to ALL) and rank_keys to ['qa.test'] (a nonexistent
-- criterion family), so its rank metric was 0 for everyone → the flagship award
-- silently produced ZERO winners and ZERO contenders on every event. Restore it to
-- the documented formula (matches its own basis_description "Highest overall score"
-- and the in-code AWARD_REGISTRY in app/yip/actions/results.ts). Idempotent.
update yip.award_definitions
   set eligibility = 'all',
       rank_mode   = 'overall_total',
       rank_keys   = '{}'::text[],
       updated_at  = now()
 where award_key = 'best_parliamentarian';
