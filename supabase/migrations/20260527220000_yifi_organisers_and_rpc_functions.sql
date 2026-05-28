-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi organisers table + 13 RPC functions
--
-- These were created in the live database during the YiFi build session
-- (2026-05-25) but never captured in a migration file.
--
-- Verified against live Supabase project bkmpbcoxbjyafieabxao on 2026-05-27
-- by calling each RPC endpoint and confirming return shapes match.
--
-- All functions are in the PUBLIC schema because PostgREST cannot introspect
-- the yifi schema (PGRST002). They use SECURITY DEFINER to read yifi.* tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Missing column: yifi.editions.event_id ─────────────────────────────
-- Links YiFi edition to the yi_connect events table for cross-module integration.
-- Added in live DB during build session but not in original migration.
ALTER TABLE yifi.editions ADD COLUMN IF NOT EXISTS event_id uuid;

-- ─── Missing table: yifi.organisers ─────────────────────────────────────
-- Not in the original 20260525 migration but exists in live DB.
-- Stores per-edition organiser roles with granular permissions.
CREATE TABLE IF NOT EXISTS yifi.organisers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id  uuid NOT NULL REFERENCES yifi.editions(id),
  email       text NOT NULL,
  full_name   text NOT NULL,
  role        text NOT NULL,  -- architect, host_chair, national_ent_chair, national_admin, chapter_ent_chair
  permissions text[] NOT NULL DEFAULT '{}',
  chapter_name text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, email)
);

CREATE INDEX IF NOT EXISTS idx_organisers_edition ON yifi.organisers(edition_id);
CREATE INDEX IF NOT EXISTS idx_organisers_email ON yifi.organisers(email);

-- ─── Seed data: YiFi Madurai 2026 edition ───────────────────────────────
INSERT INTO yifi.editions (id, slug, name, tagline, theme, host_chapter_id, event_date, venue, city, expected_attendance, status, event_id)
VALUES (
  'bf63448f-a552-44e7-8d03-c35243cf232b',
  'madurai-2026',
  'YiFi Madurai 2026',
  'Built for Generations',
  'Meenakshi temple',
  '7b5e1abf-9c33-4c85-b9b3-9e6a313f0632',
  '2026-07-17',
  'Madurai Convention Centre',
  'Madurai',
  500,
  'registration',
  '1e5b7f53-9570-404f-b70e-2baa0bb7bac1'
) ON CONFLICT (id) DO NOTHING;

-- ─── Seed data: YiFi Madurai 2026 event_stats ──────────────────────────
INSERT INTO yifi.event_stats (edition_id, total_registrants, total_capacity_cr, problem_clusters, sectors, introductions_made, meetings_happened, vows_made, witnesses_named)
VALUES (
  'bf63448f-a552-44e7-8d03-c35243cf232b',
  5, 12.50, 8, 4, 12, 0, 0, 0
) ON CONFLICT (edition_id) DO NOTHING;

-- ─── Seed data: YiFi Madurai 2026 organisers ────────────────────────────
-- These 6 organisers were inserted during the build session.
-- edition_id bf63448f-... = YiFi Madurai 2026
INSERT INTO yifi.organisers (id, edition_id, email, full_name, role, permissions, chapter_name, is_active)
VALUES
  ('ffb32cd9-c39f-4a7d-bcc5-f0e5863308f5', 'bf63448f-a552-44e7-8d03-c35243cf232b',
   'aidental@jkkn.ac.in', 'Ommsharravana', 'architect',
   ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], 'Erode', true),
  ('1750228c-8ad0-49a2-93ce-6d9f88d7677e', 'bf63448f-a552-44e7-8d03-c35243cf232b',
   'namrata@yi.cii.in', 'Namrata Bhatt', 'national_ent_chair',
   ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], null, true),
  ('587b8023-5fce-4fbb-a123-a2a4100e2747', 'bf63448f-a552-44e7-8d03-c35243cf232b',
   'piyush.garg@powertekengg.com', 'Piyush Garg', 'national_admin',
   ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], null, true),
  ('211283d5-45de-467e-b130-bdfc7375242d', 'bf63448f-a552-44e7-8d03-c35243cf232b',
   'director@jkkn.ac.in', 'Director', 'national_admin',
   ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], null, true),
  ('8b0b3a32-5421-4c31-9094-160e259c3381', 'bf63448f-a552-44e7-8d03-c35243cf232b',
   'Vikranth@avenuesads.com', 'Vikranth Karmegam', 'host_chair',
   ARRAY['registrants','stats','census','vows','reveal'], 'Madurai', true),
  ('1a636e48-a15b-49d9-8e8e-549ad05f41d6', 'bf63448f-a552-44e7-8d03-c35243cf232b',
   'mohan@erode.yi', 'Mohandinesh', 'chapter_ent_chair',
   ARRAY['registrants','matches','census'], 'Erode', true)
ON CONFLICT (edition_id, email) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS (all in public schema for PostgREST visibility)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. yifi_lookup_registrant — access code login
CREATE OR REPLACE FUNCTION public.yifi_lookup_registrant(p_code text)
RETURNS json AS $$
  SELECT row_to_json(r.*)
  FROM yifi.registrants r
  WHERE r.access_code = p_code
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 2. yifi_find_by_email — OAuth auto-login cookie
CREATE OR REPLACE FUNCTION public.yifi_find_by_email(p_email text)
RETURNS json AS $$
  SELECT row_to_json(r.*)
  FROM yifi.registrants r
  WHERE r.email = p_email
  ORDER BY r.created_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 3. yifi_get_registrant_by_id — full profile for /yifi/me
CREATE OR REPLACE FUNCTION public.yifi_get_registrant_by_id(p_id uuid)
RETURNS json AS $$
  SELECT row_to_json(r.*)
  FROM yifi.registrants r
  WHERE r.id = p_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 4. yifi_current_edition — active/upcoming edition
CREATE OR REPLACE FUNCTION public.yifi_current_edition()
RETURNS json AS $$
  SELECT row_to_json(e.*)
  FROM yifi.editions e
  WHERE e.status IN ('registration', 'live')
     OR e.event_date >= CURRENT_DATE
  ORDER BY e.event_date ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 5. yifi_get_edition — edition by slug
CREATE OR REPLACE FUNCTION public.yifi_get_edition(p_slug text)
RETURNS json AS $$
  SELECT row_to_json(e.*)
  FROM yifi.editions e
  WHERE e.slug = p_slug
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 6. yifi_update_census — save registrant census data
CREATE OR REPLACE FUNCTION public.yifi_update_census(
  p_registrant_id uuid,
  p_sector text,
  p_organisation text,
  p_designation text,
  p_city text,
  p_challenges text[],
  p_can_offer jsonb
)
RETURNS void AS $$
BEGIN
  UPDATE yifi.registrants
  SET
    sector = p_sector,
    organisation = p_organisation,
    designation = p_designation,
    city = p_city,
    challenges = p_challenges,
    can_offer = p_can_offer,
    census_complete = true,
    updated_at = now()
  WHERE id = p_registrant_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = yifi, public;

-- 7. yifi_create_vow — insert vow with duplicate guard
CREATE OR REPLACE FUNCTION public.yifi_create_vow(
  p_edition_id uuid,
  p_registrant_id uuid,
  p_category text,
  p_vow_text text
)
RETURNS jsonb AS $$
DECLARE
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing
  FROM yifi.vows
  WHERE edition_id = p_edition_id
    AND registrant_id = p_registrant_id
    AND category = p_category
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'duplicate');
  END IF;

  INSERT INTO yifi.vows (edition_id, registrant_id, category, vow_text, status)
  VALUES (p_edition_id, p_registrant_id, p_category, p_vow_text, 'active');

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = yifi, public;

-- 8. yifi_get_vows — registrant's vows for an edition
CREATE OR REPLACE FUNCTION public.yifi_get_vows(
  p_registrant_id uuid,
  p_edition_id uuid
)
RETURNS json AS $$
  SELECT coalesce(json_agg(row_to_json(v.*) ORDER BY v.created_at DESC), '[]'::json)
  FROM yifi.vows v
  WHERE v.registrant_id = p_registrant_id
    AND v.edition_id = p_edition_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 9. yifi_check_organiser — check organiser role for email + edition
CREATE OR REPLACE FUNCTION public.yifi_check_organiser(
  p_email text,
  p_edition_id uuid
)
RETURNS json AS $$
  SELECT coalesce(json_agg(json_build_object(
    'role', o.role,
    'permissions', o.permissions,
    'chapter_id', null
  )), '[]'::json)
  FROM yifi.organisers o
  WHERE o.email = p_email
    AND o.edition_id = p_edition_id
    AND o.is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 10. yifi_list_organisers — all organisers for an edition
CREATE OR REPLACE FUNCTION public.yifi_list_organisers(p_edition_id uuid)
RETURNS json AS $$
  SELECT coalesce(json_agg(json_build_object(
    'id', o.id,
    'email', o.email,
    'full_name', o.full_name,
    'role', o.role,
    'permissions', o.permissions,
    'chapter_name', o.chapter_name,
    'is_active', o.is_active
  )), '[]'::json)
  FROM yifi.organisers o
  WHERE o.edition_id = p_edition_id
    AND o.is_active = true
  ORDER BY o.role ASC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 11. yifi_get_stats — live event counters
CREATE OR REPLACE FUNCTION public.yifi_get_stats(p_edition_id uuid)
RETURNS json AS $$
  SELECT row_to_json(es.*)
  FROM yifi.event_stats es
  WHERE es.edition_id = p_edition_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 12. yifi_get_matches — routing matches with partner details
CREATE OR REPLACE FUNCTION public.yifi_get_matches(
  p_registrant_id uuid,
  p_edition_id uuid
)
RETURNS json AS $$
  SELECT coalesce(json_agg(json_build_object(
    'id', m.id,
    'slot_time', m.slot_time,
    'table_number', m.table_number,
    'is_walkup', m.is_walkup,
    'a_confirmed', m.a_confirmed,
    'b_confirmed', m.b_confirmed,
    'matched_person_id', CASE
      WHEN m.registrant_a = p_registrant_id THEN m.registrant_b
      ELSE m.registrant_a
    END,
    'matched_person_full_name', CASE
      WHEN m.registrant_a = p_registrant_id THEN rb.full_name
      ELSE ra.full_name
    END,
    'match_reason', m.match_reason,
    'match_score', m.match_score,
    'meeting_happened', m.meeting_happened,
    'notes_a', m.notes_a,
    'notes_b', m.notes_b
  ) ORDER BY m.slot_time ASC NULLS LAST, m.created_at ASC), '[]'::json)
  FROM yifi.matches m
  LEFT JOIN yifi.registrants ra ON m.registrant_a = ra.id
  LEFT JOIN yifi.registrants rb ON m.registrant_b = rb.id
  WHERE m.edition_id = p_edition_id
    AND (m.registrant_a = p_registrant_id OR m.registrant_b = p_registrant_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;

-- 13. yifi_get_dossier — personalised dossier for a registrant
CREATE OR REPLACE FUNCTION public.yifi_get_dossier(
  p_registrant_id uuid,
  p_edition_id uuid
)
RETURNS json AS $$
  SELECT row_to_json(d.*)
  FROM yifi.dossiers d
  WHERE d.registrant_id = p_registrant_id
    AND d.edition_id = p_edition_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yifi, public;


-- ═══════════════════════════════════════════════════════════════════════════
-- Grant execute to all roles (service_role for server actions,
-- authenticated/anon for PostgREST access)
-- ═══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.yifi_lookup_registrant(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_find_by_email(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_registrant_by_id(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_current_edition() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_edition(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_update_census(uuid, text, text, text, text, text[], jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_create_vow(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_vows(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_check_organiser(text, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_list_organisers(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_stats(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_matches(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_dossier(uuid, uuid) TO authenticated, anon, service_role;
