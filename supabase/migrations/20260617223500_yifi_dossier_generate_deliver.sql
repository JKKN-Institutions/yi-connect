-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi dossier generation + delivery engine RPCs
--
-- Powers the dossier engine (lib/yifi/dossier/*) + the admin generate/deliver
-- controls on /yifi/admin/dossiers. Additive only — does not touch existing
-- yifi_admin_list_dossiers or any table DDL.
--
-- The engine needs three reads and three writes:
--   reads  : edition sessions (raw material) + census-complete registrants
--   writes : upsert a generated dossier, set status, mark delivered
--
-- All functions live in the public schema (PostgREST visibility) and are
-- SECURITY DEFINER so they can reach the yifi.* tables. Authorisation is
-- enforced at the page/action layer (getAdminContext + hasPermission) — these
-- functions assume the caller is an already-verified organiser.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Read: edition sessions (raw material for the prompt) ────────────────
-- All sessions for the edition, including transcript_text (added by the
-- sessions-transcript migration). The engine reads transcript_text and falls
-- back to a transcript_url note when the text is empty.
CREATE OR REPLACE FUNCTION public.yifi_get_edition_sessions(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', s.id,
      'title', s.title,
      'speaker_name', s.speaker_name,
      'session_type', s.session_type,
      'themes', s.themes,
      'concepts', s.concepts,
      'transcript_url', s.transcript_url,
      'transcript_text', s.transcript_text
    ) ORDER BY s.title), '[]'::json)
    FROM yifi.sessions s
    WHERE s.edition_id = p_edition_id
  );
END;$function$;

-- ─── Read: census-complete registrants (the census vector) ───────────────
-- One row per registrant the engine can personalise a dossier for.
CREATE OR REPLACE FUNCTION public.yifi_get_registrants_for_dossier(p_edition_id uuid)
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
      'sector', r.sector,
      'organisation', r.organisation,
      'designation', r.designation,
      'city', r.city,
      'challenges', r.challenges,
      'can_offer', r.can_offer,
      'census_complete', r.census_complete
    ) ORDER BY r.full_name), '[]'::json)
    FROM yifi.registrants r
    WHERE r.edition_id = p_edition_id
  );
END;$function$;

-- ─── Write: upsert a generated dossier ───────────────────────────────────
-- UPSERT on the (edition_id, registrant_id) unique constraint. Returns the
-- dossier id so the engine can log it. Sets updated_at on every write.
CREATE OR REPLACE FUNCTION public.yifi_admin_upsert_dossier(
  p_edition_id uuid,
  p_registrant_id uuid,
  p_top_quotes jsonb,
  p_takeaways jsonb,
  p_speaker_ranking jsonb,
  p_action_plan jsonb,
  p_tour_cards jsonb,
  p_status text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO yifi.dossiers (
    edition_id, registrant_id,
    top_quotes, takeaways, speaker_ranking, action_plan, tour_cards,
    status, updated_at
  )
  VALUES (
    p_edition_id, p_registrant_id,
    coalesce(p_top_quotes, '[]'::jsonb),
    coalesce(p_takeaways, '[]'::jsonb),
    coalesce(p_speaker_ranking, '[]'::jsonb),
    coalesce(p_action_plan, '[]'::jsonb),
    coalesce(p_tour_cards, '[]'::jsonb),
    coalesce(p_status, 'ready'),
    now()
  )
  ON CONFLICT (edition_id, registrant_id) DO UPDATE
  SET top_quotes = excluded.top_quotes,
      takeaways = excluded.takeaways,
      speaker_ranking = excluded.speaker_ranking,
      action_plan = excluded.action_plan,
      tour_cards = excluded.tour_cards,
      status = excluded.status,
      updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;$function$;

-- ─── Write: set a dossier's status ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.yifi_admin_set_dossier_status(p_dossier_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.dossiers
  SET status = p_status,
      updated_at = now()
  WHERE id = p_dossier_id;
END;$function$;

-- ─── Write: mark a dossier delivered ─────────────────────────────────────
-- Invoked only after a successful, explicit, manual WhatsApp send.
CREATE OR REPLACE FUNCTION public.yifi_admin_mark_dossier_delivered(p_dossier_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.dossiers
  SET status = 'delivered',
      delivered_at = now(),
      updated_at = now()
  WHERE id = p_dossier_id;
END;$function$;

-- ─── Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.yifi_get_edition_sessions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_get_registrants_for_dossier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_upsert_dossier(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_set_dossier_status(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_mark_dossier_delivered(uuid) TO authenticated, service_role;
