-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Varnam Vizha — varnam_tasks (E1 Command Centre)
--
-- The organisers' #1 hour-sink is chasing follow-ups: the 2025 committee ran
-- on a 30-item meeting-minutes list of "X follows up with Y", and 2026
-- planning once stalled 4 months because nobody chased. This table is that
-- list, structured: tasks (follow-ups) + milestones (master calendar), each
-- with a free-text owner (committee members and forum contacts often are NOT
-- platform users), an optional event link, and a due date.
--
-- kind:   'task' (follow-up) | 'milestone' (master-calendar date)
-- status: 'open' | 'done' (completed_at stamped by the app on toggle)
--
-- Access: committee-only data. RLS is ENABLED with NO anon/authenticated
-- policies — closed by default. All reads/writes flow through the admin
-- (service-role) client inside server actions, which re-check the caller's
-- varnam role (yi_directory.role_assignments, app='varnam') in app-layer auth.
--
-- Seed: the 2026 master-calendar milestones (edition slug 'varnam-vizha-2026'),
-- idempotent — each row guarded by (edition, title) WHERE NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yi_connect.varnam_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id   uuid NOT NULL REFERENCES yi_connect.festival_editions(id) ON DELETE CASCADE,
  event_id     uuid REFERENCES yi_connect.events(id) ON DELETE SET NULL,
  kind         text NOT NULL DEFAULT 'task'
                 CHECK (kind IN ('task','milestone')),
  title        text NOT NULL
                 CHECK (char_length(title) BETWEEN 1 AND 200),
  details      text,
  owner_name   text,                    -- free text: owners often aren't platform users
  due_date     date,
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','done')),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE yi_connect.varnam_tasks IS
  'Varnam Vizha command centre: follow-up tasks + master-calendar milestones per festival edition. owner_name is free text (owners are often not platform users). Committee-only; RLS closed, access via service client + app-layer varnam roles.';

CREATE INDEX IF NOT EXISTS idx_varnam_tasks_edition
  ON yi_connect.varnam_tasks (edition_id);
CREATE INDEX IF NOT EXISTS idx_varnam_tasks_event
  ON yi_connect.varnam_tasks (event_id);
CREATE INDEX IF NOT EXISTS idx_varnam_tasks_due_date
  ON yi_connect.varnam_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_varnam_tasks_status
  ON yi_connect.varnam_tasks (status);

-- ── RLS ────────────────────────────────────────────────────────────────
-- Closed by default: no anon/authenticated policies. Committee data flows
-- through the admin client in server actions (app-layer role checks).
ALTER TABLE yi_connect.varnam_tasks ENABLE ROW LEVEL SECURITY;

-- ── Seed: 2026 master-calendar milestones ──────────────────────────────
-- Idempotent: each milestone guarded by (edition, title). No-op if the
-- 'varnam-vizha-2026' edition doesn't exist yet.
INSERT INTO yi_connect.varnam_tasks (edition_id, kind, title, due_date, status)
SELECT e.id, 'milestone', m.title, m.due_date, 'open'
FROM yi_connect.festival_editions e
CROSS JOIN (
  VALUES
    (DATE '2026-07-20', 'Sponsor deck finalised and sent to all targets'),
    (DATE '2026-07-25', 'Government meetings — lock the Collector for festival dates'),
    (DATE '2026-08-01', 'All permission letters submitted (Collector / Police / Corporation)'),
    (DATE '2026-08-08', 'Branding production complete for anchor events'),
    (DATE '2026-08-15', 'Teaser launch (Independence Day amplification)'),
    (DATE '2026-08-25', 'Volunteer rosters locked for all events'),
    (DATE '2026-09-01', 'Press meet with the Collector'),
    (DATE '2026-09-05', 'Festival week begins'),
    (DATE '2026-09-16', 'Valedictory on Erode Day')
) AS m(due_date, title)
WHERE e.slug = 'varnam-vizha-2026'
  AND NOT EXISTS (
    SELECT 1
    FROM yi_connect.varnam_tasks t
    WHERE t.edition_id = e.id
      AND t.title = m.title
  );

-- updated_at is maintained by the application layer (server actions set it on write).
