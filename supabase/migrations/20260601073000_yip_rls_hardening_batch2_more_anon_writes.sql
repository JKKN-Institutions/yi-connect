-- YIP security remediation — batch 2 (follow-up to 20260601070000).
--
-- A full sweep of ALL 34 yip.* tables (not just the 8 obvious live-event tables
-- covered in batch 1) found 4 MORE tables that still accepted anon/authenticated
-- writes. Applied to prod via the Supabase Management API on 2026-06-01 and
-- verified: 34/34 yip tables now reject anon writes.
--
--   yip.vote_sessions  — anon could open / rig a rogue vote during a live event (CRITICAL)
--   yip.score_audit    — anon could inject / pollute the scoring audit trail
--   yip.bills          — anon could inject fake bills
--   yip.questions      — anon could inject fake questions
--
-- Safe for the app: every write to these tables is in a "use server" service-role
-- action (app/yip/actions/{bills,questions,scoring,voting}.ts); none use the
-- browser/anon client. score_audit is written by scoring.ts, not a trigger.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  yip.bills,
  yip.questions,
  yip.score_audit,
  yip.vote_sessions
  FROM anon, authenticated;

-- Verification 2026-06-01 (anon key, all 34 yip tables):
--   anon INSERT bills / questions / score_audit / vote_sessions ... 42501 denied ✅
--   full sweep .................................................... 34/34 block anon write ✅
