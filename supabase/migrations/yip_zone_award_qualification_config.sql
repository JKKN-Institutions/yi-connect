-- Per-zone award→qualification config for the Regional qualification screen.
-- Advancement is AWARD-BASED: each QUALIFYING award's chosen advancer moves to
-- the next round. This table lets a zone mark specific awards as RECOGNITION-ONLY
-- (awarded + shown on results, but do NOT advance). Default (no row) = qualifies.
--
-- SRTN (includes the real Erode chapter) is seeded so Team Spirit, Community
-- Impact, and Independent Voice of the House are recognition-only → the other 12
-- awards' winners advance.
--
-- SECURITY: this is a yip.* table. New yip.* tables ship anon-readable unless
-- locked. We enable RLS with ZERO policies and revoke anon/authenticated, so only
-- the service role (which bypasses RLS) can read/write it — reads go through the
-- server actions in app/yip/actions/qualification.ts.

create table if not exists yip.zone_award_config (
  yi_zone_code text   not null,
  award_key    text   not null,
  qualifies    boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (yi_zone_code, award_key)
);

alter table yip.zone_award_config enable row level security;
-- No policies: with RLS on and zero policies, anon/authenticated get nothing.
revoke all on yip.zone_award_config from anon, authenticated;

-- SRTN recognition-only carve-out (Director ruling 2026-06-25).
insert into yip.zone_award_config (yi_zone_code, award_key, qualifies) values
  ('SRTN', 'team_spirit',       false),
  ('SRTN', 'community_impact',  false),
  ('SRTN', 'independent_voice', false)
on conflict (yi_zone_code, award_key) do update
  set qualifies = excluded.qualifies, updated_at = now();
