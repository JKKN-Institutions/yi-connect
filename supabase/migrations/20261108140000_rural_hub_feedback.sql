-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Yi Rural Hub — village feedback on the Anumanpalli road map
--
-- WHY: the Anumanpalli road map (Attavanai + Mugasi Anumanpalli, one hub,
-- launched 2 Oct 2026) ends in questions with choices. The Director asked for
-- it on a Yi Connect link he can share, with every answer stored. One row per
-- person who sends the form.
--
-- Shape: the questions live in code (lib/rural-hub/anumanpalli-survey.ts);
-- answers are a jsonb map { question_key: option_key | option_key[] , ... }
-- validated by the server action before insert. survey_key lets a second
-- village reuse the table later.
--
-- Abuse: public, no login, so the writer is guarded (per-IP + platform burst,
-- see lib/rural-hub/guard.ts). `ip` is what makes the per-IP cap durable and is
-- the forensic trail; the two indexes below are what those counts ride on.
--
-- Access: RLS ENABLED with NO policies. anon/authenticated can neither read
-- nor write; the public form inserts and the committee results page reads via
-- the service-role client, gated in the app (getVarnamAccess for results).
--
-- Add-only: one new table, nothing existing changed. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yi_connect.rural_hub_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_key       text NOT NULL CHECK (char_length(survey_key) BETWEEN 1 AND 64),
  respondent_name  text NOT NULL CHECK (char_length(btrim(respondent_name)) BETWEEN 1 AND 120),
  panchayat        text NOT NULL CHECK (panchayat IN ('attavanai', 'mugasi', 'other')),
  phone            text CHECK (phone IS NULL OR phone ~ '^[0-9+ -]{6,20}$'),
  answers          jsonb NOT NULL DEFAULT '{}'::jsonb
                     CHECK (jsonb_typeof(answers) = 'object' AND pg_column_size(answers) < 16000),
  comment          text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  ip               text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE yi_connect.rural_hub_feedback IS
  'Yi Rural Hub village feedback (one row per form sent). Questions defined in lib/rural-hub/*-survey.ts; answers jsonb keyed by question. Public writer is rate-guarded; RLS closed, service role only.';

CREATE INDEX IF NOT EXISTS idx_rural_hub_feedback_survey_created
  ON yi_connect.rural_hub_feedback (survey_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rural_hub_feedback_ip_created
  ON yi_connect.rural_hub_feedback (ip, created_at DESC);

ALTER TABLE yi_connect.rural_hub_feedback ENABLE ROW LEVEL SECURITY;

-- Explicit grant: tables created through the Management API get no default
-- grants, and a missing grant makes the service client fail (reads silently
-- empty). Service role only, on purpose.
GRANT SELECT, INSERT ON yi_connect.rural_hub_feedback TO service_role;
