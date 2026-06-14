-- YIP: two-day check-in (YA2). A YIP event runs over two days; attendance must
-- be tracked per day, not as a single boolean.
--
-- Adds checked_in_day1 / checked_in_day2 (+ _at). The legacy `checked_in` is
-- KEPT and maintained by the actions as a derived "present on at least one day"
-- flag (= day1 OR day2), so every existing reader (voting eligibility, the
-- control-panel attendance count, scoring) keeps working unchanged.
--
-- New columns added to yip.participants get NO grant to anon/authenticated (the
-- table's grants are column-scoped after 20260609000000) → service-role only,
-- which is what we want: all check-in reads/writes already go through the
-- service client behind getYipEventAccess / a desk-scope guard.

ALTER TABLE yip.participants
  ADD COLUMN IF NOT EXISTS checked_in_day1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_day2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_day1_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_day2_at timestamptz;

-- Backfill: any legacy check-in is treated as Day 1 presence (preserves history).
UPDATE yip.participants
   SET checked_in_day1 = true,
       checked_in_day1_at = COALESCE(checked_in_at, now())
 WHERE checked_in = true
   AND checked_in_day1 = false;

COMMENT ON COLUMN yip.participants.checked_in_day1 IS 'Present on Day 1. checked_in = day1 OR day2 (maintained by the check-in actions).';
COMMENT ON COLUMN yip.participants.checked_in_day2 IS 'Present on Day 2. checked_in = day1 OR day2 (maintained by the check-in actions).';
