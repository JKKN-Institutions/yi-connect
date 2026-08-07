-- ═══════════════════════════════════════════════════════════════════════
-- Yi-Future — durable per-IP rate limiting for the public registration form.
--
-- Context: on 2026-08-07 an unattributed script inserted ~65,000 fake
-- delegates through /yi-future/join in 3h17m. The form had no rate limit,
-- so the only way to stop it was closing registration platform-wide.
--
-- future.delegates had no IP column, so there was nothing to count per-caller
-- and no forensic trail. This adds both.
--
-- Safe to apply while registration is live: the column is nullable, nothing
-- reads it until lib/yi-future/registration-guard.ts ships, and existing rows
-- keep NULL (they simply do not count toward any IP's quota).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE future.delegates
  ADD COLUMN IF NOT EXISTS registration_ip text;

COMMENT ON COLUMN future.delegates.registration_ip IS
  'Caller IP (first hop of x-forwarded-for) captured at public registration. '
  'Powers the per-IP abuse cap in lib/yi-future/registration-guard.ts. '
  'NULL for rows created before 2026-08-07 and for chapter-admin-created rows.';

-- Supports the rolling-24h per-IP count. Partial: only rows that have an IP.
CREATE INDEX IF NOT EXISTS idx_delegates_registration_ip
  ON future.delegates (registration_ip, registered_at)
  WHERE registration_ip IS NOT NULL;
