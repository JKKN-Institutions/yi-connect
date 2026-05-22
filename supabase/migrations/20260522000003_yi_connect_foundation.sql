-- ═══════════════════════════════════════════════════════════════════════
-- Migration: yi_connect foundation — profiles, user_roles, trigger fn
-- Phase A Batch 1
--
-- Lifts the remaining pieces of public's initial_schema:
--   - update_updated_at_column() function
--   - profiles table (FK to yi.chapters + NEW person_id → yi_directory.people)
--   - user_roles junction table
--   - indexes, RLS, policies, triggers
--
-- Defers handle_new_user trigger — that needs cross-app coordination
-- because YIP and YiFuture also create profiles on auth.users insert.
-- We'll wire that up in a later step after deciding the trigger order.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 0. Required extension (idempotent) ──────────────────────────────────
-- pg_trgm needed for gin trigram indexes on full_name (fuzzy search).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ── 1. Utility function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION yi_connect.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. profiles table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS yi_connect.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  -- FK to canonical chapter list (shared with YIP & YiFuture)
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE SET NULL,
  -- Cross-app identity link (new; not in original yi-connect schema)
  person_id UUID REFERENCES yi_directory.people(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE yi_connect.profiles IS
  'yi-connect user profiles. Extends auth.users with chapter assignment '
  'and cross-app identity link via person_id → yi_directory.people.';
COMMENT ON COLUMN yi_connect.profiles.person_id IS
  'Cross-app identity FK. The same person may appear in YIP profiles '
  'and YiFuture core_team via the same yi_directory.people row.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_yc_profiles_email ON yi_connect.profiles(email);
CREATE INDEX IF NOT EXISTS idx_yc_profiles_chapter_id ON yi_connect.profiles(chapter_id);
CREATE INDEX IF NOT EXISTS idx_yc_profiles_person_id ON yi_connect.profiles(person_id);
CREATE INDEX IF NOT EXISTS idx_yc_profiles_full_name_trgm
  ON yi_connect.profiles USING gin (full_name extensions.gin_trgm_ops);

-- RLS
ALTER TABLE yi_connect.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yc_profiles_read_authenticated"
  ON yi_connect.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "yc_profiles_insert_own"
  ON yi_connect.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "yc_profiles_update_own"
  ON yi_connect.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- updated_at trigger
CREATE TRIGGER trg_yc_profiles_updated_at
  BEFORE UPDATE ON yi_connect.profiles
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- ── 3. user_roles junction ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS yi_connect.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES yi_connect.profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES yi_connect.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

COMMENT ON TABLE yi_connect.user_roles IS
  'Assigns yi_connect.roles to yi_connect.profiles. Many-to-many.';

CREATE INDEX IF NOT EXISTS idx_yc_user_roles_user_id ON yi_connect.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_yc_user_roles_role_id ON yi_connect.user_roles(role_id);

ALTER TABLE yi_connect.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yc_user_roles_read_authenticated"
  ON yi_connect.user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Executives (hierarchy_level >= 5) can manage user_roles
CREATE POLICY "yc_user_roles_manage_executives"
  ON yi_connect.user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5
    )
    OR
    -- National admins can always manage (bootstrap path)
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
