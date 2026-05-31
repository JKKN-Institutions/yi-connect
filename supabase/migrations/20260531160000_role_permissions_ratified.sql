-- Ratified capability map — 2026-05-31 Director interview.
-- Replaces the DRAFT yip seed with the ratified set.
--
-- Decisions:
--   * Manage includes delete  → chapter roles get event.* / participant.* (incl delete).
--   * RM view + edit in zone   → regional_admin/rm get *.read + event.* + participant.* @ zone.
--   * Chair = EM (same powers) → chapter_chair and chapter_em are identical.
--   * super_admin = cross-app root → enforced in lib/yi/auth/can.ts (this row documents intent).
--   * platform_admin = per-app    → '*'@global within each app, granted explicitly per app.
--
-- NOTE: finance / member-admin WRITES are intentionally NOT granted to RMs here —
-- "edit in zone" is scoped to operational data (events, participants). The
-- finance/sensitive-data carve-out is the agreed follow-up refinement.

BEGIN;

DELETE FROM yi_directory.role_permissions WHERE app = 'yip';

INSERT INTO yi_directory.role_permissions (app, role, capability, scope_type) VALUES
  -- yi-connect root super-admin (cross-app enforced in can.ts; documented here)
  ('yip', 'super_admin',    '*',             'global'),
  -- per-app full admins (granted explicitly per app)
  ('yip', 'platform_admin', '*',             'global'),
  ('yip', 'national',       '*',             'global'),
  -- regional mentor / regional admin: view everything + edit events & participants in their ZONE
  ('yip', 'regional_admin', '*.read',        'zone'),
  ('yip', 'regional_admin', 'event.*',       'zone'),
  ('yip', 'regional_admin', 'participant.*', 'zone'),
  ('yip', 'rm',             '*.read',        'zone'),
  ('yip', 'rm',             'event.*',       'zone'),
  ('yip', 'rm',             'participant.*', 'zone'),
  -- chapter chair == chapter em (same powers): full events & participants in their CHAPTER (incl delete)
  ('yip', 'chapter_chair',  'event.*',       'chapter'),
  ('yip', 'chapter_chair',  'participant.*', 'chapter'),
  ('yip', 'chapter_em',     'event.*',       'chapter'),
  ('yip', 'chapter_em',     'participant.*', 'chapter')
ON CONFLICT DO NOTHING;

COMMIT;
