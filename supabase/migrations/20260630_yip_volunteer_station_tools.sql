-- 20260630_yip_volunteer_station_tools.sql
--
-- Tool B — per-station volunteer tools. Adds two new volunteer stations and a
-- task feed for runner / organiser_helper volunteers.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block and the
-- new value cannot be used in the same transaction. Apply each statement
-- individually (the Management API runs each as its own autocommit txn).

-- 1) Two new stations on the existing public.volunteer_station enum.
--    jury_support     — supports the jury bench (read-only schedule + progress).
--    organiser_helper — general organiser runner (shares the runner task feed).
ALTER TYPE public.volunteer_station ADD VALUE IF NOT EXISTS 'jury_support';
ALTER TYPE public.volunteer_station ADD VALUE IF NOT EXISTS 'organiser_helper';

-- 2) Runner / organiser-helper task feed. Organisers (canManage) post short
--    tasks; runner + organiser_helper volunteers see the open feed and mark
--    tasks done. Event-wide (no per-station targeting in v1).
CREATE TABLE IF NOT EXISTS yip.volunteer_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open',          -- 'open' | 'done'
  created_by_name text,                          -- organiser who posted it (audit)
  completed_by_volunteer_id uuid REFERENCES yip.volunteers(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_tasks_event
  ON yip.volunteer_tasks(event_id, status, created_at DESC);

-- Service-role only: no RLS policies. Every read/write goes through the
-- event-/station-gated server actions (same lock as yip.yuva_assignments and
-- yip.vote_audit). authenticated/anon get nothing.
ALTER TABLE yip.volunteer_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yip.volunteer_tasks FROM anon, authenticated;
