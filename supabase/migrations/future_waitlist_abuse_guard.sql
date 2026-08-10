-- Yi-Future: make the public registration waitlist rate-limitable.
--
-- Context: on 2026-08-07 (16:56–19:10 UTC) a script inserted 2,358,427
-- faker.js addresses into future.registration_waitlist at ~440 rows/second.
-- The table was 99.99% synthetic (2,358,610 rows, 183 genuine). The fake rows
-- were deleted on 2026-08-10; this migration adds what the guard needs so it
-- cannot happen again.
--
-- `ip` records the caller address so the per-IP cap in
-- lib/yi-future/waitlist-guard.ts is durable across serverless invocations,
-- and so there is a forensic trail if this recurs. It is nullable: rows
-- written before this migration have none, and a request arriving without
-- x-forwarded-for still gets to sign up (the burst breaker still applies).
--
-- Applied to production 2026-08-10 via the Management API.

alter table future.registration_waitlist
  add column if not exists ip text;

-- Per-IP cap: 200 sign-ups / rolling 24h.
create index if not exists idx_waitlist_ip_created
  on future.registration_waitlist (ip, created_at desc);

-- Platform-wide burst breaker: 60 sign-ups / rolling 5 min, scoped to edition.
create index if not exists idx_waitlist_edition_created
  on future.registration_waitlist (edition_id, created_at desc);
