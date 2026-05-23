-- Enforce 6-character access codes at DB level.
--
-- The unlock UI uses a 6-slot input that truncates to 6 chars via slice(0,6).
-- Without this constraint, admin-side seeding (manual INSERT, CSV import,
-- console queries) can write longer codes that the UI then silently rejects.
-- Caught by Agent J on 2026-05-23 when seeding test jury data with a 10-char
-- code TESTJURY01 — the unlock form truncated to TESTJU and login failed
-- without any helpful error.
--
-- All 4 role tables (delegates, mentors, jury_assignments, corporate_partners)
-- under future schema get the same constraint. NULL is allowed (some flows
-- create rows before issuing a code).
--
-- Already applied live via Supabase Management API; this file persists the
-- change for fresh DB rebuilds.

ALTER TABLE future.delegates
  ADD CONSTRAINT delegates_access_code_len_chk
  CHECK (access_code IS NULL OR length(access_code) = 6);

ALTER TABLE future.mentors
  ADD CONSTRAINT mentors_access_code_len_chk
  CHECK (access_code IS NULL OR length(access_code) = 6);

ALTER TABLE future.jury_assignments
  ADD CONSTRAINT jury_assignments_access_code_len_chk
  CHECK (access_code IS NULL OR length(access_code) = 6);

ALTER TABLE future.corporate_partners
  ADD CONSTRAINT corporate_partners_access_code_len_chk
  CHECK (access_code IS NULL OR length(access_code) = 6);
