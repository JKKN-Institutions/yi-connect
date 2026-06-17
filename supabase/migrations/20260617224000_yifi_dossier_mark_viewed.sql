-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi dossier view tracking (member-facing)
--
-- Adds `public.yifi_mark_dossier_viewed(p_registrant_id, p_edition_id)`.
-- Called fire-and-forget by the member dossier reader (app/yifi/me/dossier)
-- when a ready/delivered dossier is opened. Bumps view_count, stamps the
-- first-view timestamp (idempotent via coalesce), and promotes a ready/
-- delivered dossier to 'viewed'. Other statuses are left untouched.
--
-- Additive only — no schema/column changes. SECURITY DEFINER to reach yifi.*.
-- Authorisation is enforced at the page layer (yifi_session cookie → registrant
-- ownership); this function assumes the caller passes their own registrant id.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.yifi_mark_dossier_viewed(p_registrant_id uuid, p_edition_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.dossiers
  SET view_count = coalesce(view_count, 0) + 1,
      viewed_at = coalesce(viewed_at, now()),
      status = CASE WHEN status IN ('ready', 'delivered') THEN 'viewed' ELSE status END
  WHERE registrant_id = p_registrant_id
    AND edition_id = p_edition_id;
END;$function$;

GRANT EXECUTE ON FUNCTION public.yifi_mark_dossier_viewed(uuid, uuid) TO authenticated, anon, service_role;
