-- ============================================================================
-- Yi Connect: Add Coordinator and Sub-Chapter Lead roles
-- ============================================================================
--
-- Adds two new roles to support folding the standalone Coordinator portal
-- (/coordinator/*) and Chapter Lead portal (/chapter-lead/*) into the main
-- Yi Connect dashboard with unified Supabase auth.
--
-- Both roles sit at hierarchy_level=1 (same tier as Industry Coordinator).
-- Super Admin / National Admin override is handled by the sidebar's
-- hasAnyRole() helper and by requireRole() in lib/auth.ts.
-- ============================================================================

INSERT INTO yi_connect.roles (id, name, hierarchy_level, permissions)
VALUES
  (
    '00000000-0000-0000-0000-000000000011'::uuid,
    'Coordinator',
    1,
    ARRAY[
      'stakeholder.bookings.read',
      'stakeholder.bookings.write',
      'stakeholder.sessions.read'
    ]
  ),
  (
    '00000000-0000-0000-0000-000000000012'::uuid,
    'Sub-Chapter Lead',
    1,
    ARRAY[
      'subchapter.events.write',
      'subchapter.members.write'
    ]
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  hierarchy_level = EXCLUDED.hierarchy_level,
  permissions = EXCLUDED.permissions;
