-- ═══════════════════════════════════════════════════════════════════════
-- 2026-06-02: Drop chair_email / chair_mobile from the future.chapters view
--             (chair-PII hardening, defense-in-depth on top of #277).
--
-- future.chapters is a security_invoker VIEW over yi.chapters. #277 locked it
-- down so anon REST returns 401 (the view is GRANTed to service_role ONLY —
-- anon/authenticated have no grant). The chair_email/chair_mobile columns are
-- still *present* in the view; this removes them from the future surface so
-- they can never be exposed even if grants regress.
--
-- CREATE OR REPLACE VIEW cannot drop columns (Postgres 42P16) → DROP + CREATE,
-- replaying the EXACT prior state: security_invoker=on, GRANT to service_role
-- ONLY (NO anon/authenticated — that is what keeps anon at 401).
--
-- Safe because:
--   • No objects depend on future.chapters (verified via pg_depend 2026-06-02).
--   • The only future-side reader of chair_email via this view
--     (app/yi-future/national/admin/host-assignments/page.tsx) is repointed to
--     .schema("yi").from("chapters") in the SAME PR. Every other chair reader
--     (csv, thank-you, national/admin/page, whatsapp-outreach) already reads
--     yi.chapters directly with a service-role client.
--
-- APPLY SURGICALLY via the Supabase Management API (/database/query), NOT via
-- `supabase db push` — the migrations dir has drift and a blind push would
-- sweep other teams' pending migrations.
-- ═══════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS future.chapters;

CREATE VIEW future.chapters
WITH (security_invoker = on)
AS
SELECT
  id,
  yi_chapter_id,
  name,
  city,
  state,
  region,
  logo_url,
  is_active,
  created_at,
  programme_duration_days,
  finale_region,
  is_finale_host,
  chair_name,
  -- chair_email  DROPPED 2026-06-02 — read from yi.chapters directly (service role)
  -- chair_mobile DROPPED 2026-06-02 — read from yi.chapters directly (service role)
  finale_start_date,
  finale_end_date
FROM yi.chapters;

-- Replay the #277 lockdown: service_role ONLY. Do NOT grant anon/authenticated.
GRANT ALL ON future.chapters TO service_role;

-- Reload PostgREST schema cache so the dropped columns vanish from REST now.
NOTIFY pgrst, 'reload schema';
