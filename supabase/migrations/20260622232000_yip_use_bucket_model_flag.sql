-- Cutover flag: when true, the results engine scores on the configurable
-- scoring_buckets model instead of the legacy per-session sum. Default false
-- so the new engine is INERT until a super-admin flips it (per-platform, global).
alter table yip.scoring_settings add column if not exists use_bucket_model boolean not null default false;
