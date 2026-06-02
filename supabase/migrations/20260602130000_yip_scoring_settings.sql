-- Global scoring rule settings (BUG-385 follow-up) — singleton, super-admin set.
--
-- Pulls the last hardcoded scoring decisions into the UI so the super-admin
-- controls every knob:
--   aggregation_method    how a delegate's per-session scores combine
--                         ('weighted_average' | 'average' | 'best_n')
--   normalize_per_session whether each session score is converted to a % of its
--                         own max before combining (fair when sessions have
--                         different parameter sets / maxes — the BUG-385 case)
--   best_n                N for the 'best_n' method (kept for flexibility)
--
-- Singleton via boolean PK (id = true), same pattern as position_bonus_config.
-- Additive + inert until the results engine reads it.

create table if not exists yip.scoring_settings (
  id                    boolean primary key default true,
  aggregation_method    text not null default 'weighted_average',
  normalize_per_session boolean not null default true,
  best_n                integer not null default 3,
  updated_at            timestamptz not null default now(),
  constraint scoring_settings_singleton check (id),
  constraint scoring_settings_method_valid
    check (aggregation_method in ('weighted_average', 'average', 'best_n', 'sum'))
);

alter table yip.scoring_settings enable row level security;
revoke all on yip.scoring_settings from anon, authenticated;
grant all on yip.scoring_settings to service_role;

-- Seed the singleton with handbook-aligned defaults.
insert into yip.scoring_settings (id) values (true) on conflict (id) do nothing;
