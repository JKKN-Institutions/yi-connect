-- Allow the new `weighted_pct_90` aggregation method. Uniform model: every
-- session is scored on its own rubric (shown /100 in the jury UI), normalised to
-- a fraction of its own max, then weighted by the session's configured
-- session_weight (the weightage table — not the rubric size), scaled to /90.
-- Implemented in app/yip/actions/results.ts (computeResults).
alter table yip.scoring_settings drop constraint if exists scoring_settings_method_valid;
alter table yip.scoring_settings add constraint scoring_settings_method_valid
  check (aggregation_method = any (array['weighted_average','average','best_n','sum','weighted_90','weighted_pct_90']));
