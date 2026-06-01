-- Phase 7 (Layer 3) — scoped permissions table for the yi_directory permission gate.
--
-- This table is the single source the `can(capability, target)` gate (lib/yi/auth/can.ts)
-- reads to decide what each (app, role) may do, and at what scope. It is additive and
-- idempotent — safe to re-run. It does NOT touch role_assignments or any auth path.
--
-- Per the consolidation plan (docs/yi-directory-consolidation-plan-2026-05-31.md §4, §6 Ph7):
--   scope_type ∈ { global | zone | chapter | edition | self }
--   capability strings are dotted (e.g. 'event.delete'); '*' and 'X.*' / '*.Y' wildcards
--   are interpreted by the gate, not the DB.

CREATE TABLE IF NOT EXISTS yi_directory.role_permissions (
  app         text NOT NULL,
  role        text NOT NULL,
  capability  text NOT NULL,
  scope_type  text NOT NULL CHECK (scope_type IN ('global', 'zone', 'chapter', 'edition', 'self')),
  PRIMARY KEY (app, role, capability, scope_type)
);

-- ⚠️ DRAFT CAPABILITY MAP — REQUIRES DIRECTOR REVIEW. Not security-final.
-- These six rows are a deliberately small, conservative starting set so the machinery can
-- be exercised. The real capability→role→scope map is a human policy decision (plan §8, §9)
-- and must be ratified before any gate relies on it. See docs/permission-capability-map-DRAFT.md.
INSERT INTO yi_directory.role_permissions (app, role, capability, scope_type) VALUES
  ('yip', 'national',       '*',           'global'),
  ('yip', 'super_admin',    '*',           'global'),
  ('yip', 'regional_admin', '*.read',      'zone'),
  ('yip', 'rm',             '*.read',      'zone'),
  ('yip', 'chapter_chair',  'event.manage', 'chapter'),
  ('yip', 'chapter_em',     'event.manage', 'chapter')
ON CONFLICT (app, role, capability, scope_type) DO NOTHING;
