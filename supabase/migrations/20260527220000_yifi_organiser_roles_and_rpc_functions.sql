-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi organiser_roles table + edition_id column + 13 RPC functions
--
-- These were created in the live database during the YiFi build session
-- (2026-05-25) but never captured in a migration file.
--
-- AUTHORITATIVE: function bodies below are pulled verbatim from the live
-- Supabase project bkmpbcoxbjyafieabxao via pg_get_functiondef() on 2026-05-29.
-- (An earlier reconstruction guessed wrong — invented a yifi.organisers table
-- and queried yi_connect.user_roles. The real source is yifi.organiser_roles
-- + yi_directory.role_assignments. This file replaces that guess.)
--
-- All functions live in the PUBLIC schema because PostgREST cannot introspect
-- the yifi schema (PGRST002). They use SECURITY DEFINER to reach yifi.* tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Missing column: yifi.editions.event_id ─────────────────────────────
-- Links a YiFi edition to the yi_connect events row. Added live, not in the
-- original 20260525 schema migration.
ALTER TABLE yifi.editions ADD COLUMN IF NOT EXISTS event_id uuid;

-- ─── Missing table: yifi.organiser_roles ────────────────────────────────
-- Per-edition organiser identities with granular permission arrays.
-- Read by yifi_check_organiser (login gate) and yifi_list_organisers (admin).
CREATE TABLE IF NOT EXISTS yifi.organiser_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id  uuid NOT NULL REFERENCES yifi.editions(id),
  person_id   uuid,                       -- optional FK to yi_directory.people
  email       text NOT NULL,
  full_name   text NOT NULL,
  phone       text,
  chapter_id  uuid,                        -- optional FK to yi.chapters
  role        text NOT NULL,               -- architect, national_ent_chair, national_admin,
                                           -- host_chair, host_team, chapter_ent_chair,
                                           -- curation_team, av_team
  permissions text[] NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, email, role)
);

CREATE INDEX IF NOT EXISTS idx_organiser_roles_edition ON yifi.organiser_roles(edition_id);
CREATE INDEX IF NOT EXISTS idx_organiser_roles_email ON yifi.organiser_roles(email);

GRANT SELECT ON yifi.organiser_roles TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed data (idempotent) — YiFi Madurai 2026
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO yifi.editions (id, slug, name, tagline, theme, host_chapter_id, event_date, venue, city, expected_attendance, status, event_id)
VALUES (
  'bf63448f-a552-44e7-8d03-c35243cf232b', 'madurai-2026', 'YiFi Madurai 2026',
  'Built for Generations', 'Meenakshi temple', '7b5e1abf-9c33-4c85-b9b3-9e6a313f0632',
  '2026-07-17', 'Madurai Convention Centre', 'Madurai', 500, 'registration',
  '1e5b7f53-9570-404f-b70e-2baa0bb7bac1'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO yifi.event_stats (edition_id, total_registrants, total_capacity_cr, problem_clusters, sectors, introductions_made, meetings_happened, vows_made, witnesses_named)
VALUES ('bf63448f-a552-44e7-8d03-c35243cf232b', 5, 12.50, 8, 4, 12, 0, 0, 0)
ON CONFLICT (edition_id) DO NOTHING;

-- 6 organiser_roles (NOTE: emails stored as-entered; yifi_check_organiser
-- normalises with lower(trim()) at query time).
INSERT INTO yifi.organiser_roles (id, edition_id, person_id, email, full_name, phone, chapter_id, role, permissions, is_active)
VALUES
  ('ffb32cd9-c39f-4a7d-bcc5-f0e5863308f5', 'bf63448f-a552-44e7-8d03-c35243cf232b', null,
   'aidental@jkkn.ac.in', 'Ommsharravana', '+919876543210', 'fe71c429-2647-4262-b35b-e356c960903d',
   'architect', ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], true),
  ('8b0b3a32-5421-4c31-9094-160e259c3381', 'bf63448f-a552-44e7-8d03-c35243cf232b', null,
   'Vikranth@avenuesads.com', 'Vikranth Karmegam', '9944733334', '7b5e1abf-9c33-4c85-b9b3-9e6a313f0632',
   'host_chair', ARRAY['registrants','stats','census','vows','reveal'], true),
  ('1750228c-8ad0-49a2-93ce-6d9f88d7677e', 'bf63448f-a552-44e7-8d03-c35243cf232b', null,
   'namrata@yi.cii.in', 'Namrata Bhatt', null, null,
   'national_ent_chair', ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], true),
  ('1a636e48-a15b-49d9-8e8e-549ad05f41d6', 'bf63448f-a552-44e7-8d03-c35243cf232b', null,
   'mohan@erode.yi', 'Mohandinesh', null, 'fe71c429-2647-4262-b35b-e356c960903d',
   'chapter_ent_chair', ARRAY['registrants','matches','census'], true),
  ('211283d5-45de-467e-b130-bdfc7375242d', 'bf63448f-a552-44e7-8d03-c35243cf232b', null,
   'director@jkkn.ac.in', 'Director', null, null,
   'national_admin', ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], true),
  ('587b8023-5fce-4fbb-a123-a2a4100e2747', 'bf63448f-a552-44e7-8d03-c35243cf232b', null,
   'piyush.garg@powertekengg.com', 'Piyush Garg', null, null,
   'national_admin', ARRAY['matches','census','vows','reveal','dossiers','registrants','stats'], true)
ON CONFLICT (edition_id, email, role) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS — verbatim from live DB (pg_get_functiondef), 2026-05-29
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.yifi_check_organiser(p_email text, p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_normalized text := lower(trim(p_email));
  v_super_admin boolean;
  v_result json;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM yi_directory.role_assignments ra
    JOIN yi_directory.people p ON p.id = ra.person_id
    WHERE lower(trim(p.email)) = v_normalized
      AND ra.role = 'super_admin'
      AND ra.is_active = true
  ) INTO v_super_admin;

  SELECT json_agg(json_build_object(
    'role', r.role,
    'permissions', r.permissions,
    'chapter_id', r.chapter_id
  )) INTO v_result
  FROM yifi.organiser_roles r
  WHERE r.email = v_normalized
    AND r.edition_id = p_edition_id
    AND r.is_active = true;

  IF v_super_admin THEN
    RETURN COALESCE(v_result, '[]'::json)::jsonb || '[{"role":"super_admin","permissions":["*"],"chapter_id":null}]'::jsonb;
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.yifi_create_vow(p_edition_id uuid, p_registrant_id uuid, p_category text, p_vow_text text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ DECLARE result json; BEGIN INSERT INTO yifi.vows (edition_id, registrant_id, category, vow_text, status) VALUES (p_edition_id, p_registrant_id, p_category, p_vow_text, 'active') RETURNING json_build_object('id', id, 'category', category, 'vow_text', vow_text) INTO result; RETURN result; EXCEPTION WHEN unique_violation THEN RETURN json_build_object('error', 'duplicate'); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_current_edition()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT row_to_json(e) FROM yifi.editions e WHERE e.status != 'archived' ORDER BY e.event_date ASC LIMIT 1); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_find_by_email(p_email text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT row_to_json(r)
    FROM yifi.registrants r
    WHERE lower(r.email) = lower(trim(p_email))
    ORDER BY r.created_at DESC
    LIMIT 1
  );
END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_get_dossier(p_registrant_id uuid, p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT row_to_json(d) FROM yifi.dossiers d WHERE d.registrant_id = p_registrant_id AND d.edition_id = p_edition_id LIMIT 1); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_get_edition(p_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT row_to_json(e) FROM yifi.editions e WHERE e.slug = p_slug LIMIT 1); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_get_matches(p_registrant_id uuid, p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT coalesce(json_agg(match_row), '[]'::json) FROM (SELECT m.id, m.match_reason, m.match_score, m.slot_time, m.table_number, m.is_walkup, m.meeting_happened, m.registrant_a, m.registrant_b, json_build_object('id', rp.id, 'full_name', rp.full_name, 'organisation', rp.organisation, 'city', rp.city, 'sector', rp.sector, 'photo_url', rp.photo_url, 'phone', rp.phone) as matched_person FROM yifi.matches m JOIN yifi.registrants rp ON rp.id = CASE WHEN m.registrant_a = p_registrant_id THEN m.registrant_b ELSE m.registrant_a END WHERE m.edition_id = p_edition_id AND (m.registrant_a = p_registrant_id OR m.registrant_b = p_registrant_id) ORDER BY m.slot_time NULLS LAST) match_row); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_get_registrant_by_id(p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT row_to_json(r) FROM yifi.registrants r WHERE r.id = p_id LIMIT 1); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_get_stats(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT row_to_json(s) FROM yifi.event_stats s WHERE s.edition_id = p_edition_id LIMIT 1); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_get_vows(p_registrant_id uuid, p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT coalesce(json_agg(v), '[]'::json) FROM yifi.vows v WHERE v.registrant_id = p_registrant_id AND v.edition_id = p_edition_id); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_list_organisers(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', r.id,
      'email', r.email,
      'full_name', r.full_name,
      'role', r.role,
      'permissions', r.permissions,
      'chapter_name', c.name,
      'is_active', r.is_active
    ) ORDER BY
      CASE r.role
        WHEN 'architect' THEN 1
        WHEN 'national_ent_chair' THEN 2
        WHEN 'national_admin' THEN 3
        WHEN 'host_chair' THEN 4
        WHEN 'host_team' THEN 5
        WHEN 'chapter_ent_chair' THEN 6
        WHEN 'curation_team' THEN 7
        WHEN 'av_team' THEN 8
      END
    ), '[]'::json)
    FROM yifi.organiser_roles r
    LEFT JOIN yi.chapters c ON c.id = r.chapter_id
    WHERE r.edition_id = p_edition_id
  );
END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_lookup_registrant(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$ BEGIN RETURN (SELECT row_to_json(r) FROM yifi.registrants r WHERE r.access_code = upper(trim(p_code)) LIMIT 1); END;$function$;

CREATE OR REPLACE FUNCTION public.yifi_update_census(p_registrant_id uuid, p_sector text, p_organisation text, p_designation text, p_city text, p_challenges text[], p_can_offer jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ DECLARE result json; BEGIN UPDATE yifi.registrants SET sector = p_sector, organisation = p_organisation, designation = p_designation, city = p_city, challenges = p_challenges, can_offer = p_can_offer, census_complete = (array_length(p_challenges, 1) >= 1 AND p_sector IS NOT NULL AND p_sector != ''), updated_at = now() WHERE id = p_registrant_id RETURNING json_build_object('id', id, 'census_complete', census_complete) INTO result; RETURN result; END;$function$;

-- ─── Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.yifi_check_organiser(text, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_create_vow(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_current_edition() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_find_by_email(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_dossier(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_edition(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_matches(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_registrant_by_id(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_stats(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_vows(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_list_organisers(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_lookup_registrant(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_update_census(uuid, text, text, text, text, text[], jsonb) TO authenticated, service_role;
