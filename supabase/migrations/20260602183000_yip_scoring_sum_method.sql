-- Allow the additive 'sum' aggregation method (Yi 2026 Evaluation Workbook
-- realignment). Final score = 6 juror components (sum 90) + auto Position
-- Points (max 10) = 100, summed rather than averaged.
--
-- The live production constraint was widened directly via the Management API;
-- this migration converges any environment that already applied
-- 20260602130000_yip_scoring_settings.sql with the original 3-value check.
-- Idempotent.

alter table yip.scoring_settings
  drop constraint if exists scoring_settings_method_valid;

alter table yip.scoring_settings
  add constraint scoring_settings_method_valid
  check (aggregation_method in ('weighted_average', 'average', 'best_n', 'sum'));
