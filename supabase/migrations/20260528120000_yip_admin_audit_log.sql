-- Phase 19 / B — Admin audit log (2026-05-28)
--
-- Captures every destructive / mutation action across YIP admin surfaces:
-- "Database — which mobile number entered, who did the changes, who logged in,
--  what has happened." (Yi National team meeting, 2026-05-27)
--
-- Beyond the existing yip.score_audit (scoring-only), this is the org-wide
-- audit trail. Inserts come from lib/yip/audit/log-action.ts via the service
-- client (bypasses RLS) so audit failures never block the user's action.

CREATE TABLE IF NOT EXISTS yip.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,           -- 'create' | 'update' | 'delete' | 'login' | 'wipe' | 'import' | 'export'
  target_table text NOT NULL,          -- 'participants', 'parties', 'events', 'jury_assignments', 'scores', 'auth' (for logins), etc.
  target_id text,                       -- UUID of affected row (text to allow non-UUID like email)
  target_event_id uuid REFERENCES yip.events(id) ON DELETE SET NULL,
  performed_by_user_id uuid,            -- auth.users.id (organizer login)
  performed_by_organizer_id uuid,       -- yip.organizers.id
  performed_by_email text,              -- denormalized for fast lookup + jury login (no organizer row)
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yip_admin_audit_log_event_idx ON yip.admin_audit_log(target_event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS yip_admin_audit_log_org_idx ON yip.admin_audit_log(performed_by_organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS yip_admin_audit_log_action_idx ON yip.admin_audit_log(action_type, target_table, created_at DESC);
