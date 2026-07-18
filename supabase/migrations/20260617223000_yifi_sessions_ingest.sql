-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi session / transcript ingestion
--
-- Adds the manual-entry write path for `yifi.sessions` — the raw stage-session
-- records (keynote / panel / fireside / workshop / tour / peer) that the AI
-- dossier engine filters per attendee. Organisers enter each session here and
-- paste OR link its transcript after the event.
--
-- The `sessions` table already exists; this migration is ADDITIVE:
--   1. Adds `transcript_text` so organisers can paste the raw transcript
--      directly. The generation engine prefers transcript_text and falls back
--      to transcript_url.
--   2. list / upsert / delete RPCs in the `public` schema (PostgREST
--      visibility), SECURITY DEFINER to reach `yifi.*`, mirroring the existing
--      yifi_admin_* admin RPCs.
--
-- Authorisation is enforced at the page + server-action layer
-- (getAdminContext + hasPermission(..., "sessions")) — these functions assume
-- the caller is an already-verified organiser, exactly like the other
-- yifi_admin_* RPCs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Raw transcript paste column ──────────────────────────────────────
ALTER TABLE yifi.sessions ADD COLUMN IF NOT EXISTS transcript_text text;

-- ─── 2. List all sessions for an edition (admin table view) ──────────────
-- Returns every session column. `has_transcript` is a convenience boolean —
-- true when either the pasted text or a transcript URL is present.
CREATE OR REPLACE FUNCTION public.yifi_admin_list_sessions(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', s.id,
      'edition_id', s.edition_id,
      'title', s.title,
      'speaker_name', s.speaker_name,
      'speaker_bio', s.speaker_bio,
      'session_type', s.session_type,
      'start_time', s.start_time,
      'end_time', s.end_time,
      'consent_archiving', s.consent_archiving,
      'transcript_url', s.transcript_url,
      'transcript_text', s.transcript_text,
      'has_transcript', (
        coalesce(nullif(trim(s.transcript_text), ''), nullif(trim(s.transcript_url), '')) IS NOT NULL
      ),
      'themes', s.themes,
      'concepts', s.concepts,
      'created_at', s.created_at
    ) ORDER BY s.start_time NULLS LAST, s.created_at), '[]'::json)
    FROM yifi.sessions s
    WHERE s.edition_id = p_edition_id
  );
END;$function$;

-- ─── 3. Upsert a session (insert when p_id is null, else update) ──────────
-- Returns the affected row id.
CREATE OR REPLACE FUNCTION public.yifi_admin_upsert_session(
  p_id uuid,
  p_edition_id uuid,
  p_title text,
  p_speaker_name text,
  p_speaker_bio text,
  p_session_type text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_consent_archiving boolean,
  p_transcript_url text,
  p_transcript_text text,
  p_themes text[]
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO yifi.sessions (
      edition_id, title, speaker_name, speaker_bio, session_type,
      start_time, end_time, consent_archiving,
      transcript_url, transcript_text, themes
    ) VALUES (
      p_edition_id, p_title, p_speaker_name, p_speaker_bio, p_session_type,
      p_start_time, p_end_time, coalesce(p_consent_archiving, false),
      p_transcript_url, p_transcript_text, p_themes
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE yifi.sessions SET
      title = p_title,
      speaker_name = p_speaker_name,
      speaker_bio = p_speaker_bio,
      session_type = p_session_type,
      start_time = p_start_time,
      end_time = p_end_time,
      consent_archiving = coalesce(p_consent_archiving, false),
      transcript_url = p_transcript_url,
      transcript_text = p_transcript_text,
      themes = p_themes
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;$function$;

-- ─── 4. Delete a session ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.yifi_admin_delete_session(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM yifi.sessions WHERE id = p_id;
END;$function$;

-- ─── Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.yifi_admin_list_sessions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_upsert_session(uuid, uuid, text, text, text, text, timestamptz, timestamptz, boolean, text, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_delete_session(uuid) TO authenticated, service_role;
