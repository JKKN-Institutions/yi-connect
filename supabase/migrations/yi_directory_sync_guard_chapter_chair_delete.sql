-- yi_directory_sync_guard_chapter_chair_delete
-- 2026-06-20 — Guard the future.chapter_core_team DELETE-sync so removing a
-- member on the Yi Future platform can NO LONGER cascade-delete a chapter-wide
-- chair/co-chair from yi_directory. The chapter chair is canonical in
-- yi_directory; only the directory admin removes it. (Other core-team roles
-- still delete-cascade as before.)
--
-- Incident: Hyderabad's chair (Poonam Agarwal) was wiped when her core-team row
-- was deleted on the Yi Future team screen → the AFTER DELETE trigger cascaded
-- and removed her yi_directory chapter_chair, locking the chapter out. Restored
-- by recreating the core-team row; this migration prevents a recurrence.
--
-- This file captures the FULL current function definition (the trigger has been
-- managed live; this version-controls it for the first time). Idempotent.

CREATE OR REPLACE FUNCTION yi_directory.sync_from_chapter_core_team()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_person_id uuid;
  v_chapter_name text;
  v_display_name text;
  v_year int;
  v_edition_kickoff date;
  v_app text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM yi_directory.role_assignments
    WHERE source_future_team_id = OLD.id
      -- GUARD (2026-06-20): a chapter-wide chair/co-chair is canonical in
      -- yi_directory; removing a member on the Yi Future platform must NOT
      -- delete it. Only the directory admin can remove the chair role.
      AND role NOT IN ('chapter_chair', 'chapter_co_chair');
    RETURN OLD;
  END IF;

  v_display_name := CASE
    WHEN NEW.full_name IS NULL OR NEW.full_name = NEW.email
      THEN COALESCE(NEW.full_name, NEW.email, 'Unknown')
    ELSE NEW.full_name
  END;

  IF NEW.chapter_id IS NOT NULL THEN
    SELECT name INTO v_chapter_name FROM yi.chapters WHERE id = NEW.chapter_id;
  END IF;

  IF NEW.edition_id IS NOT NULL THEN
    SELECT kickoff_date INTO v_edition_kickoff
    FROM future.editions WHERE id = NEW.edition_id;
  END IF;
  v_year := COALESCE(
    EXTRACT(year FROM v_edition_kickoff)::int,
    EXTRACT(year FROM current_date)::int
  );

  IF NEW.email IS NOT NULL THEN
    SELECT id INTO v_person_id FROM yi_directory.people WHERE email = NEW.email;
  END IF;
  IF v_person_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO v_person_id FROM yi_directory.people WHERE user_id = NEW.user_id;
  END IF;
  IF v_person_id IS NULL THEN
    INSERT INTO yi_directory.people
      (full_name, email, phone, user_id, source_future_team_id)
    VALUES
      (v_display_name, NEW.email, NEW.phone, NEW.user_id, NEW.id)
    RETURNING id INTO v_person_id;
  ELSE
    UPDATE yi_directory.people
    SET full_name = COALESCE(NULLIF(v_display_name, ''), full_name),
        phone     = COALESCE(NEW.phone, phone),
        user_id   = COALESCE(NEW.user_id, user_id),
        updated_at = now()
    WHERE id = v_person_id;
  END IF;

  NEW.person_id := v_person_id;

  -- Chapter-wide chairs (chapter_chair / chapter_co_chair) lead the WHOLE
  -- chapter across every vertical, so they are tagged with the chapter-wide
  -- app='yi', not the Yi-Future-specific app='future'. All other core-team
  -- roles (chapter_event_lead, etc.) stay app='future'.
  -- (2026-06-14, see project_chapter_chair_is_chapter_wide.)
  v_app := CASE
    WHEN NEW.role::text IN ('chapter_chair', 'chapter_co_chair') THEN 'yi'
    ELSE 'future'
  END;

  INSERT INTO yi_directory.role_assignments
    (person_id, app, role, yi_chapter, yi_year, yi_edition_id,
     is_active, source_future_team_id)
  VALUES
    (v_person_id, v_app, NEW.role::text, v_chapter_name, v_year,
     NEW.edition_id, NEW.is_active, NEW.id)
  ON CONFLICT (person_id, app, role,
               COALESCE(yi_chapter, ''),
               yi_year)
  DO UPDATE SET
    yi_edition_id = EXCLUDED.yi_edition_id,
    is_active     = EXCLUDED.is_active,
    source_future_team_id = EXCLUDED.source_future_team_id,
    updated_at    = now();

  RETURN NEW;
END;
$function$
;
