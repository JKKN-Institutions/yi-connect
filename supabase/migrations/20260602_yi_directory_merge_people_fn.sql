-- yi_directory merge-people + lineage — 2026-06-02
-- APPLIED to prod (bkmpbcoxbjyafieabxao) via the Management API; committed here
-- as the history/greppability artifact. No CI auto-applies it.
--
-- Atomic merge of a duplicate person (source) into a canonical one (target):
-- re-points every FK referencer of yi_directory.people.id (verified live),
-- dedupes colliding role rows, resolves the auth login, soft-deletes the source.

ALTER TABLE yi_directory.people
  ADD COLUMN IF NOT EXISTS merged_into uuid NULL REFERENCES yi_directory.people(id);
COMMENT ON COLUMN yi_directory.people.merged_into IS
  'If set, this person was merged INTO that canonical person (soft-deleted source). NULL = not merged.';

CREATE OR REPLACE FUNCTION public.merge_directory_people(
  p_source uuid, p_target uuid, p_prefer_source_auth boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_src record; v_tgt record;
  v_ra_repointed int := 0; v_ra_deduped int := 0;
  v_cct int := 0; v_prof int := 0; v_orole int := 0; v_org int := 0; v_part int := 0;
  v_orphan_auth uuid := NULL; v_auth_action text := 'none';
BEGIN
  IF p_source = p_target THEN RAISE EXCEPTION 'cannot merge a person into itself'; END IF;
  SELECT * INTO v_src FROM yi_directory.people WHERE id = p_source FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'source % not found', p_source; END IF;
  SELECT * INTO v_tgt FROM yi_directory.people WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'target % not found', p_target; END IF;

  WITH src AS (
    SELECT s.id, s.app, s.role, COALESCE(s.yi_chapter,'') ch, s.yi_year, s.is_active, s.is_primary, s.title, s.yi_zone, s.yi_edition_id
    FROM yi_directory.role_assignments s WHERE s.person_id = p_source
  ), coll AS (
    SELECT s.*, t.id AS tgt_id FROM src s
    JOIN yi_directory.role_assignments t ON t.person_id = p_target AND t.app = s.app AND t.role = s.role AND COALESCE(t.yi_chapter,'') = s.ch AND t.yi_year = s.yi_year
  ), upd AS (
    UPDATE yi_directory.role_assignments t SET is_active = t.is_active OR c.is_active, is_primary = t.is_primary OR c.is_primary,
      title = COALESCE(t.title, c.title), yi_zone = COALESCE(t.yi_zone, c.yi_zone), yi_edition_id = COALESCE(t.yi_edition_id, c.yi_edition_id), updated_at = now()
    FROM coll c WHERE t.id = c.tgt_id RETURNING 1
  ), del AS (
    DELETE FROM yi_directory.role_assignments d USING coll c WHERE d.id = c.id RETURNING 1
  )
  SELECT count(*) INTO v_ra_deduped FROM del;

  UPDATE yi_directory.role_assignments SET person_id = p_target, updated_at = now() WHERE person_id = p_source;
  GET DIAGNOSTICS v_ra_repointed = ROW_COUNT;
  UPDATE future.chapter_core_team SET person_id = p_target WHERE person_id = p_source; GET DIAGNOSTICS v_cct = ROW_COUNT;
  UPDATE yi_connect.profiles SET person_id = p_target WHERE person_id = p_source; GET DIAGNOSTICS v_prof = ROW_COUNT;
  UPDATE yifi.organiser_roles SET person_id = p_target WHERE person_id = p_source; GET DIAGNOSTICS v_orole = ROW_COUNT;
  UPDATE yip.organizers SET person_id = p_target, updated_at = now() WHERE person_id = p_source; GET DIAGNOSTICS v_org = ROW_COUNT;
  UPDATE yip.participations SET person_id = p_target, updated_at = now() WHERE person_id = p_source; GET DIAGNOSTICS v_part = ROW_COUNT;

  IF v_src.user_id IS NOT NULL AND v_tgt.user_id IS NULL THEN
    UPDATE yi_directory.people SET user_id = NULL, updated_at = now() WHERE id = p_source;
    UPDATE yi_directory.people SET user_id = v_src.user_id, updated_at = now() WHERE id = p_target;
    v_auth_action := 'moved_source_to_target';
  ELSIF v_src.user_id IS NOT NULL AND v_tgt.user_id IS NOT NULL AND v_src.user_id <> v_tgt.user_id THEN
    IF p_prefer_source_auth THEN
      UPDATE yi_directory.people SET user_id = NULL, updated_at = now() WHERE id = p_target;
      UPDATE yi_directory.people SET user_id = NULL, updated_at = now() WHERE id = p_source;
      UPDATE yi_directory.people SET user_id = v_src.user_id, updated_at = now() WHERE id = p_target;
      v_orphan_auth := v_tgt.user_id; v_auth_action := 'kept_source_orphaned_target';
    ELSE
      UPDATE yi_directory.people SET user_id = NULL, updated_at = now() WHERE id = p_source;
      v_orphan_auth := v_src.user_id; v_auth_action := 'kept_target_orphaned_source';
    END IF;
  END IF;

  UPDATE yi_directory.people SET is_active = false, merged_into = p_target,
    needs_identity_review = (v_orphan_auth IS NOT NULL) OR needs_identity_review, updated_at = now() WHERE id = p_source;

  RETURN jsonb_build_object('source_id', p_source, 'target_id', p_target,
    'role_assignments_repointed', v_ra_repointed, 'role_assignments_deduped', v_ra_deduped,
    'chapter_core_team', v_cct, 'yc_profiles', v_prof, 'organiser_roles', v_orole,
    'organizers', v_org, 'participations', v_part, 'auth_action', v_auth_action, 'orphaned_auth_user_id', v_orphan_auth);
END $$;

REVOKE ALL ON FUNCTION public.merge_directory_people(uuid,uuid,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_directory_people(uuid,uuid,boolean) TO service_role;

-- FK referencers covered (verified via pg_constraint): role_assignments,
-- future.chapter_core_team, yi_connect.profiles, yifi.organiser_roles,
-- yip.organizers, yip.participations. EXCLUDED: yip.participants.person_id
-- (FK→contestants, name collision), yifi.registrants.person_id (no FK, 0 rows).
-- Orphaned auth.users rows are surfaced (needs_identity_review), never hard-deleted.
