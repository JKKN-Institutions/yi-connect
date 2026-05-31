-- Permission-layer hardening — applies the 2026-05-31 Director interview decisions.
-- Additive + idempotent.
--
-- Decision 1 (identity = email OR phone; else create + FLAG): add a review flag so
--   people created with no identifying field are queryable, not silent duplicates.
-- Decision 2 (fail-closed): pre-grant `participant.manage` to chapter admins so the
--   new can()-gated participations flow does not lock them out. national/super_admin
--   already hold '*'@global from the base seed.

ALTER TABLE yi_directory.people
  ADD COLUMN IF NOT EXISTS needs_identity_review boolean NOT NULL DEFAULT false;

INSERT INTO yi_directory.role_permissions (app, role, capability, scope_type) VALUES
  ('yip', 'chapter_chair', 'participant.manage', 'chapter'),
  ('yip', 'chapter_em',    'participant.manage', 'chapter')
ON CONFLICT DO NOTHING;
