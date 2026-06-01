-- ═══════════════════════════════════════════════════════════════════════
-- Close two LIVE anon data-exposure holes in the `future.*` schema.
-- BUG-SWEEP-2026-06-01 (yi-future)
--
-- 🚨 HUMAN REVIEW REQUIRED BEFORE APPLY. This migration changes anon-role
--    access on a PII-bearing view and on the delegate OTP table. A
--    misjudgement re-opens the leaks or breaks delegate email-OTP login.
--    DO NOT auto-apply. Apply command (later, from monorepo root):
--        supabase db push --linked
--
-- ═══════════════════════════════════════════════════════════════════════
-- LEAK 1 — future.chapters VIEW leaks chair PII to anon
-- ───────────────────────────────────────────────────────────────────────
-- future.chapters is a compatibility/embed-shim VIEW over yi.chapters
-- (created 20260523093000 as `SELECT * FROM yi.chapters`, then recreated
-- 20260525090000_add_finale_dates.sql with an explicit column list that
-- STILL includes chair_name, chair_email, chair_mobile). It was created
-- WITHOUT security_invoker, so it runs with the view-owner's (definer)
-- privileges and BYPASSES RLS on yi.chapters. It is GRANTed SELECT to anon.
--
-- Result (confirmed LIVE against prod with the anon key): an
-- unauthenticated caller can read chair_name + chair_email + chair_mobile
-- for every chapter via:
--   curl ".../rest/v1/chapters?select=name,chair_email,chair_mobile"
--        -H "apikey:<ANON>" -H "Accept-Profile:future"
-- This is the SAME bug class fixed for yi_connect.chapters by
-- 20260524230000_fix_anon_read_leaks.sql + its follow-up
-- 20260524240100_chapters_view_drop_chair_contact.sql.
--
-- ───────────────────────────────────────────────────────────────────────
-- STEP-1 SAFETY FINDINGS (read-only investigation, 2026-06-01)
-- ───────────────────────────────────────────────────────────────────────
-- Every read of future.chapters AND yi.chapters in the entire yi-future
-- app runs via createServiceClient() (service-role, bypasses RLS). NO
-- anon/browser-client path reads chapters:
--   * Public pages join/page.tsx, chapters/page.tsx, join/thank-you/page.tsx
--     all use createServiceClient().schema("yi").from("chapters") and
--     select only safe cols (id,name,city,state,region,logo_url) — except
--     join/thank-you which reads chair_* via .schema("yi") (service-role)
--     gated behind a valid access_code.
--   * The anon delegate sign-in page (app/yi-future/access/page.tsx, the
--     only public page using the browser/anon client) gets chapters via
--     GET /api/yi-future/chapters, a server route that runs as service-role
--     and returns only {id,name}.
--   * lib/yi-future/chapter-context.ts and host-context.ts call the anon
--     client ONLY for auth.getUser(); the chapters(...) embed read runs on
--     createServiceClient().
--   * All chapters(...) PostgREST embeds (me, mentor/scoring, partner,
--     directory, host/*, national/admin/*) run on createServiceClient().
--   * Verified: zero data queries run on the plain anon createClient()
--     (server.ts) — it is used exclusively for auth.getUser().
--
-- WHY security_invoker=on ALONE IS NOT ENOUGH (proven on the sibling view):
--   yi.chapters carries a permissive policy `pub_read_chapters`
--   USING (is_active = true) granted to the `public` role (which INCLUDES
--   anon). 20260524240100 documents that even after security_invoker=on,
--   anon could STILL read chair_email/chair_mobile through yi_connect.chapters
--   because that underlying policy permits the row. So the row-level leak on
--   yi.chapters reaches anon regardless of the view's security mode.
--
-- WHY WE DO NOT DROP chair_email/chair_mobile FROM future.chapters HERE:
--   The ratified sibling fix (20260524240100) dropped those columns from
--   yi_connect.chapters. We canNOT do the same to future.chapters without
--   an APP-CODE edit, which is out of scope for this migration:
--   app/yi-future/national/admin/host-assignments/page.tsx (line ~26)
--   reads chair_email THROUGH the future.chapters view
--   (.schema("future").from("chapters").select("...,chair_email")). Dropping
--   the column from the view would make that national-admin page error
--   (PostgREST: column does not exist). See "RESIDUAL RISK" below for the
--   harder follow-up that drops the columns once that read is repointed to
--   .schema("yi").
--
-- CHOSEN FIX (migration-only, closes the leak, breaks nothing):
--   (1) security_invoker = on  — defense layer 1: the view now honors the
--       CALLER's RLS on yi.chapters and future-proofs against grant drift.
--   (2) REVOKE the anon + authenticated GRANT  — defense layer 2 and the
--       actual leak closer: removes the anon/authenticated REST surface for
--       future.chapters entirely. service_role keeps its grant (re-granted
--       below) and bypasses RLS, so every app consumer — including the
--       host-assignments page that reads chair_email via the view — keeps
--       working untouched. No public/anon flow reads this view (see STEP-1),
--       so revoking anon is safe.
--
-- LEAK 2 — future.email_otps has RLS DISABLED + full anon GRANT
-- ───────────────────────────────────────────────────────────────────────
-- future.email_otps backs the delegate email-OTP login. RLS is DISABLED and
-- anon holds a full GRANT, so any anonymous caller can SELECT/INSERT/UPDATE/
-- DELETE OTP rows (email, code, delegate_id, expires_at) — an auth-bypass
-- path (read a victim's code, or inject/clear codes). Empty today, but open.
--
-- STEP-1 SAFETY FINDING: email_otps is touched ONLY by
-- app/yi-future/actions/email-verify.ts (a "use server" module), and ALL
-- four call sites use createServiceClient() (service-role). No client/
-- browser/anon path reads or writes it. service_role bypasses RLS, so
-- enabling RLS + revoking anon/authenticated does NOT affect the app:
--   * requestEmailOtp(): svc.schema("future").from("email_otps").insert(...)
--   * verifyEmailOtp():  svc...select(...), svc...update(attempts),
--                        svc...update(consumed_at)
--
-- CHOSEN FIX: ENABLE RLS + REVOKE anon, authenticated. With RLS on and no
-- permissive policies, only service_role (bypass) can touch the table —
-- exactly the access pattern the app already uses.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────
-- LEAK 1: future.chapters
-- ───────────────────────────────────────────────────────────────────────

-- Defense layer 1 — make the view honor the CALLER's RLS on yi.chapters
-- instead of running as definer (which bypasses RLS). ALTER VIEW keeps the
-- existing column shape, so no app read that selects chair_* via the view
-- (e.g. national/admin/host-assignments) is affected.
ALTER VIEW future.chapters SET (security_invoker = on);

-- Defense layer 2 (the actual leak closer) — remove the anon + authenticated
-- REST surface for future.chapters. STEP-1 confirmed no public/anon flow
-- reads this view: every app consumer reads it (or yi.chapters) via the
-- service-role client, which is unaffected by this REVOKE.
REVOKE ALL ON future.chapters FROM anon, authenticated;

-- Re-assert the service-role grant explicitly so app server actions /
-- routes that read future.chapters (incl. chair_* selects) keep working
-- regardless of grant history.
GRANT SELECT ON future.chapters TO service_role;

COMMENT ON VIEW future.chapters IS
  'Cross-schema PostgREST embed shim over yi.chapters (lets future.* '
  'PostgREST embeds resolve chapters(...) without app-code change). '
  'BUG-SWEEP-2026-06-01: security_invoker turned ON and the anon + '
  'authenticated SELECT grant REVOKED to close a LIVE anon leak of '
  'chair_name/chair_email/chair_mobile. Only service_role may read this '
  'view now; every app consumer already uses the service-role client. '
  'chair_email/chair_mobile are NOT yet dropped from the column list '
  'because app/yi-future/national/admin/host-assignments/page.tsx reads '
  'chair_email THROUGH this view — repoint that read to .schema("yi") '
  'then drop the columns in a follow-up (mirrors yi_connect.chapters fix '
  '20260524240100).';

-- ───────────────────────────────────────────────────────────────────────
-- LEAK 2: future.email_otps
-- ───────────────────────────────────────────────────────────────────────

-- Turn RLS ON. With no permissive policies present, this denies all
-- anon/authenticated access. service_role bypasses RLS, so the OTP
-- send/verify server actions (which use the service-role client) are
-- unaffected.
ALTER TABLE future.email_otps ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: also strip the table-level GRANT so the anon /
-- authenticated REST surface for email_otps is closed at the privilege
-- layer too, not just behind RLS.
REVOKE ALL ON future.email_otps FROM anon, authenticated;

COMMENT ON TABLE future.email_otps IS
  'Delegate email-OTP login store (email, code, delegate_id, expires_at, '
  'attempts, consumed_at). BUG-SWEEP-2026-06-01: RLS ENABLED and the anon '
  '+ authenticated GRANT REVOKED to close a LIVE auth-bypass hole (RLS was '
  'disabled + anon held a full grant). Touched ONLY by '
  'app/yi-future/actions/email-verify.ts via the service-role client, '
  'which bypasses RLS — so app behaviour is unchanged.';

-- ───────────────────────────────────────────────────────────────────────
-- Force PostgREST to reload its schema cache so the revoked grants and
-- the security_invoker change take effect on the REST surface immediately.
-- ───────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
