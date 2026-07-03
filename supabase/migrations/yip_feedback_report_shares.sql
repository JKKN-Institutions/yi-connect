-- yip_feedback_report_shares
--
-- Public, no-login share links for a feedback report. A row maps an
-- unguessable token to one event; opening /yip/r/[token] renders the report
-- with respondent names/emails stripped (in getPublicFeedbackReport()).
--
-- Access is service-client only: the organizer actions (create/revoke/get) are
-- canManage-gated in app code, and the public route reads via the service
-- client (the token is the authorization). RLS is enabled with NO policies so
-- anon/authenticated cannot read the token table directly via PostgREST — only
-- the service role (which bypasses RLS) can.

CREATE TABLE IF NOT EXISTS yip.feedback_report_shares (
  token       text PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_feedback_report_shares_event
  ON yip.feedback_report_shares (event_id) WHERE revoked_at IS NULL;

ALTER TABLE yip.feedback_report_shares ENABLE ROW LEVEL SECURITY;

-- Belt to the RLS suspenders: no direct grants to the API roles.
REVOKE ALL ON yip.feedback_report_shares FROM anon, authenticated;
