-- =====================================================================
-- recognitions_07_rm_two_regions — one Regional Mentor, two regions.
--
-- Director, 5 Nov 2026 18:55: one person can be the Regional Mentor (RM)
-- for TWO regions on the same recognition. Real case: Koushik Modi is the
-- Yuva RM for both ER and NER and has one working email.
--
-- Until now recognition_evaluators had UNIQUE (award_id, person_id, layer),
-- so a person got one RM row, and so one region, per recognition. This
-- swaps it for a unique index that also keys on the region:
--   RM   one row per (recognition, person, region). Each region is its own
--        duty with its own scoring sheet, so "100% RM submitted" still
--        counts every region separately.
--   NMT  region is always NULL (recognition_evaluators_region_ck), so
--        coalesce(region, '') is '' for every NMT row: still exactly one
--        NMT row per person per recognition, as today.
-- The region is compared trimmed and upper-cased so 'ER' and ' er' can't
-- both exist.
--
-- DDL only. No row is changed. The second region is added afterwards from
-- the control room (Evaluators page).
-- =====================================================================

alter table yi_connect.recognition_evaluators
  drop constraint if exists recognition_evaluators_award_id_person_id_layer_key;

create unique index if not exists recognition_evaluators_one_duty_per_region
  on yi_connect.recognition_evaluators
     (award_id, person_id, layer, (coalesce(upper(btrim(region)), '')));
