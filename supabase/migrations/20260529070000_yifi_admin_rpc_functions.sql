-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi admin list-all RPC functions
--
-- Powers the admin sub-pages (registrants, census, matches, vows, dossiers).
-- The member-facing RPCs return per-registrant data; these return edition-wide
-- lists + mutations for organisers. All in public schema (PostgREST visibility),
-- SECURITY DEFINER to reach yifi.* tables.
--
-- Authorisation is enforced at the page layer (yifi_check_organiser) — these
-- functions assume the caller is already a verified organiser.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Registrants ────────────────────────────────────────────────────────
-- Full registrant list for an edition (admin table view).
CREATE OR REPLACE FUNCTION public.yifi_admin_list_registrants(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', r.id,
      'full_name', r.full_name,
      'email', r.email,
      'phone', r.phone,
      'organisation', r.organisation,
      'designation', r.designation,
      'sector', r.sector,
      'city', r.city,
      'member_category', r.member_category,
      'access_code', r.access_code,
      'census_complete', r.census_complete,
      'checked_in', r.checked_in,
      'checked_in_at', r.checked_in_at,
      'cluster_colour', r.cluster_colour,
      'is_couple', r.is_couple,
      'created_at', r.created_at
    ) ORDER BY r.full_name), '[]'::json)
    FROM yifi.registrants r
    WHERE r.edition_id = p_edition_id
  );
END;$function$;

-- Toggle a registrant's check-in status (sets checked_in_at on check-in).
CREATE OR REPLACE FUNCTION public.yifi_admin_toggle_checkin(p_registrant_id uuid, p_checked_in boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result json;
BEGIN
  UPDATE yifi.registrants
  SET checked_in = p_checked_in,
      checked_in_at = CASE WHEN p_checked_in THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_registrant_id
  RETURNING json_build_object('id', id, 'checked_in', checked_in, 'checked_in_at', checked_in_at) INTO result;
  RETURN result;
END;$function$;

-- ─── Census monitor ─────────────────────────────────────────────────────
-- Completion rate, per-sector breakdown, and the list of incomplete registrants.
CREATE OR REPLACE FUNCTION public.yifi_admin_census_summary(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_total int;
  v_complete int;
  v_by_sector json;
  v_incomplete json;
BEGIN
  SELECT count(*) INTO v_total FROM yifi.registrants WHERE edition_id = p_edition_id;
  SELECT count(*) INTO v_complete FROM yifi.registrants WHERE edition_id = p_edition_id AND census_complete = true;

  SELECT coalesce(json_agg(json_build_object('sector', sector, 'count', cnt) ORDER BY cnt DESC), '[]'::json)
  INTO v_by_sector
  FROM (
    SELECT coalesce(nullif(trim(sector), ''), 'Unspecified') AS sector, count(*) AS cnt
    FROM yifi.registrants
    WHERE edition_id = p_edition_id AND census_complete = true
    GROUP BY 1
  ) s;

  SELECT coalesce(json_agg(json_build_object(
    'id', r.id,
    'full_name', r.full_name,
    'email', r.email,
    'phone', r.phone,
    'organisation', r.organisation
  ) ORDER BY r.full_name), '[]'::json)
  INTO v_incomplete
  FROM yifi.registrants r
  WHERE r.edition_id = p_edition_id AND coalesce(r.census_complete, false) = false;

  RETURN json_build_object(
    'total', v_total,
    'complete', v_complete,
    'incomplete', v_total - v_complete,
    'completion_rate', CASE WHEN v_total > 0 THEN round((v_complete::numeric / v_total) * 100, 1) ELSE 0 END,
    'by_sector', v_by_sector,
    'incomplete_list', v_incomplete
  );
END;$function$;

-- ─── Match curation ─────────────────────────────────────────────────────
-- All matches for an edition, with both registrants' display info.
CREATE OR REPLACE FUNCTION public.yifi_admin_list_matches(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', m.id,
      'match_reason', m.match_reason,
      'match_score', m.match_score,
      'slot_time', m.slot_time,
      'table_number', m.table_number,
      'is_walkup', m.is_walkup,
      'a_confirmed', m.a_confirmed,
      'b_confirmed', m.b_confirmed,
      'meeting_happened', m.meeting_happened,
      'registrant_a', json_build_object('id', ra.id, 'full_name', ra.full_name, 'organisation', ra.organisation, 'sector', ra.sector),
      'registrant_b', json_build_object('id', rb.id, 'full_name', rb.full_name, 'organisation', rb.organisation, 'sector', rb.sector)
    ) ORDER BY m.slot_time NULLS LAST, m.created_at), '[]'::json)
    FROM yifi.matches m
    JOIN yifi.registrants ra ON ra.id = m.registrant_a
    JOIN yifi.registrants rb ON rb.id = m.registrant_b
    WHERE m.edition_id = p_edition_id
  );
END;$function$;

-- Update a match's slot time and/or table number (curation).
CREATE OR REPLACE FUNCTION public.yifi_admin_update_match(p_match_id uuid, p_slot_time timestamptz, p_table_number int)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result json;
BEGIN
  UPDATE yifi.matches
  SET slot_time = p_slot_time,
      table_number = p_table_number
  WHERE id = p_match_id
  RETURNING json_build_object('id', id, 'slot_time', slot_time, 'table_number', table_number) INTO result;
  RETURN result;
END;$function$;

-- ─── Vow wall ───────────────────────────────────────────────────────────
-- All vows for an edition, with the vow-maker's name and tile status.
CREATE OR REPLACE FUNCTION public.yifi_admin_list_vows(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', v.id,
      'category', v.category,
      'vow_text', v.vow_text,
      'status', v.status,
      'witness_accepted', v.witness_accepted,
      'tile_engraved', v.tile_engraved,
      'tile_placed', v.tile_placed,
      'tile_reclaimed', v.tile_reclaimed,
      'completion_date', v.completion_date,
      'created_at', v.created_at,
      'registrant', json_build_object('id', r.id, 'full_name', r.full_name, 'organisation', r.organisation)
    ) ORDER BY v.created_at DESC), '[]'::json)
    FROM yifi.vows v
    JOIN yifi.registrants r ON r.id = v.registrant_id
    WHERE v.edition_id = p_edition_id
  );
END;$function$;

-- Update a vow's tile engraving / placement status.
CREATE OR REPLACE FUNCTION public.yifi_admin_update_vow(p_vow_id uuid, p_tile_engraved boolean, p_tile_placed boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE result json;
BEGIN
  UPDATE yifi.vows
  SET tile_engraved = p_tile_engraved,
      tile_placed = p_tile_placed,
      updated_at = now()
  WHERE id = p_vow_id
  RETURNING json_build_object('id', id, 'tile_engraved', tile_engraved, 'tile_placed', tile_placed) INTO result;
  RETURN result;
END;$function$;

-- ─── Dossier pipeline ───────────────────────────────────────────────────
-- All dossiers for an edition, with the registrant's name and delivery status.
CREATE OR REPLACE FUNCTION public.yifi_admin_list_dossiers(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', d.id,
      'status', d.status,
      'delivered_at', d.delivered_at,
      'viewed_at', d.viewed_at,
      'view_count', d.view_count,
      'created_at', d.created_at,
      'registrant', json_build_object('id', r.id, 'full_name', r.full_name, 'email', r.email, 'organisation', r.organisation)
    ) ORDER BY d.created_at DESC), '[]'::json)
    FROM yifi.dossiers d
    JOIN yifi.registrants r ON r.id = d.registrant_id
    WHERE d.edition_id = p_edition_id
  );
END;$function$;

-- ─── Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.yifi_admin_list_registrants(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_toggle_checkin(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_census_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_list_matches(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_update_match(uuid, timestamptz, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_list_vows(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_update_vow(uuid, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_list_dossiers(uuid) TO authenticated, service_role;
