-- Phase 0 — make yi_directory.sync_from_organizer_profile() idempotent.
--
-- BUG: the function matched an existing person only by email, then user_id, then
-- INSERTed. Organizers with NULL email AND NULL user_id (e.g. the 6 RMs) never
-- matched, so every sync created a duplicate yi_directory.people row. It never
-- consulted source_yip_profile_id — the one stable organizer↔person link.
--
-- FIX: add a source_yip_profile_id fallback match before INSERT, and backfill the
-- source link when a person is matched by email/user_id but lacks it. Role upsert
-- was already idempotent and is unchanged.
--
-- ROLLBACK: re-run CREATE OR REPLACE with the previous body (preserved at the
-- bottom of this file).

CREATE OR REPLACE FUNCTION yi_directory.sync_from_organizer_profile()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_person_id uuid;
  v_year int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM yi_directory.role_assignments
    WHERE source_yip_profile_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT year INTO v_year
  FROM yi.years
  WHERE is_active = true
  ORDER BY year DESC
  LIMIT 1;
  v_year := COALESCE(v_year, EXTRACT(year FROM current_date)::int);

  IF NEW.email IS NOT NULL THEN
    SELECT id INTO v_person_id FROM yi_directory.people WHERE email = NEW.email;
  END IF;
  IF v_person_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO v_person_id FROM yi_directory.people WHERE user_id = NEW.user_id;
  END IF;
  -- FIX: stable fallback match by the organizer↔person source link.
  IF v_person_id IS NULL THEN
    SELECT id INTO v_person_id FROM yi_directory.people WHERE source_yip_profile_id = NEW.id;
  END IF;

  IF v_person_id IS NULL THEN
    INSERT INTO yi_directory.people
      (full_name, email, user_id, photo_url, source_yip_profile_id)
    VALUES
      (NEW.full_name, NEW.email, NEW.user_id, NEW.photo_url, NEW.id)
    RETURNING id INTO v_person_id;
  ELSE
    UPDATE yi_directory.people
    SET full_name = COALESCE(NULLIF(NEW.full_name, ''), full_name),
        user_id   = COALESCE(NEW.user_id, user_id),
        photo_url = COALESCE(NEW.photo_url, photo_url),
        -- FIX: backfill the source link so future emailless syncs match.
        source_yip_profile_id = COALESCE(source_yip_profile_id, NEW.id),
        updated_at = now()
    WHERE id = v_person_id;
  END IF;

  NEW.person_id := v_person_id;

  INSERT INTO yi_directory.role_assignments
    (person_id, app, role, yi_chapter, yi_zone, yi_year, title,
     is_active, source_yip_profile_id)
  VALUES
    (v_person_id, 'yip', NEW.role::text, NEW.chapter_name, NEW.zone,
     v_year, NEW.title, NEW.is_active, NEW.id)
  ON CONFLICT (person_id, app, role,
               COALESCE(yi_chapter, ''),
               yi_year)
  DO UPDATE SET
    yi_zone   = EXCLUDED.yi_zone,
    title     = EXCLUDED.title,
    is_active = EXCLUDED.is_active,
    source_yip_profile_id = EXCLUDED.source_yip_profile_id,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- ── ROLLBACK (previous body, for reference) ────────────────────────────────
-- The only differences from the previous version are the two FIX-marked blocks
-- above. To roll back, re-run CREATE OR REPLACE without:
--   1) the "SELECT id ... WHERE source_yip_profile_id = NEW.id" fallback, and
--   2) the "source_yip_profile_id = COALESCE(source_yip_profile_id, NEW.id)" line.
