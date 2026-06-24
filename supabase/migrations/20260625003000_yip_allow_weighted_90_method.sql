-- Widen yip.scoring_settings.aggregation_method to allow 'weighted_90'.
--
-- Context: the scoring engine (app/yip/actions/results.ts) and the admin Scoring
-- Rules UI (app/yip/dashboard/admin/scoring-config/scoring-config-client.tsx)
-- both already treat 'weighted_90' as a first-class aggregation method
-- ("Weighted average -> /90 + Position /10"), and the AggregationMethod type
-- (app/yip/actions/scoring-settings.ts) includes it. But the CHECK constraint
-- on the column was never updated, so:
--   (a) selecting that option in the admin UI failed with a constraint violation, and
--   (b) flipping the global setting to weighted_90 was blocked.
--
-- Director ruling 2026-06-25 (Erode Chapter Round, July 1-2): use the
-- quality-scaled model (weighted_90) so a delegate scored in fewer sessions is
-- judged on how well they did, not capped by how many slots the agenda gave them.
-- The flip was applied to production via the Management API on 2026-06-25; this
-- migration records the constraint change so a rebuild from migrations does not
-- restore the old constraint and silently break weighted_90.
--
-- Idempotent: drop-if-exists then re-add the widened constraint.

alter table yip.scoring_settings
  drop constraint if exists scoring_settings_method_valid;

alter table yip.scoring_settings
  add constraint scoring_settings_method_valid
  check (aggregation_method = any (array[
    'weighted_average',
    'average',
    'best_n',
    'sum',
    'weighted_90'
  ]));
