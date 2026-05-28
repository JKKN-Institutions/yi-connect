-- Defense-in-depth: auto-derive yip.events.yi_zone_code/zone from
-- yi.chapters.region whenever an event is inserted/updated with a
-- yi_chapter_id but the zone columns are NULL. Also auto-attach all
-- active central topics to newly-created chapter events.
--
-- Why: tonight's session caught two related drifts on yip.events —
--   (1) yi_zone_code NULL on every direct-SQL/Management-API insert,
--       breaking the 3-tier regional-admin visibility gate
--       (`feedback_event_zone_not_auto_set.md`).
--   (2) Mizoram chapter event had ZERO central topics auto-attached
--       because the createEvent server action code path was bypassed.
--
-- The server action (app/yip/actions/events.ts) handles both at the
-- application layer. These triggers are the defense-in-depth backstop
-- so direct-SQL inserts, seed scripts, and the Management API can
-- never recreate the drift.
--
-- Both triggers are idempotent and safe to re-apply: BEFORE-trigger only
-- writes when the column IS NULL, AFTER-trigger uses ON CONFLICT DO NOTHING.

-- ─── BEFORE INSERT/UPDATE: derive zone fields ────────────────────────

CREATE OR REPLACE FUNCTION yip.tg_events_autoderive_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = yip, yi, public
AS $$
DECLARE
  v_region text;
BEGIN
  -- Derive yi_zone_code from yi.chapters.region when missing
  IF NEW.yi_zone_code IS NULL AND NEW.yi_chapter_id IS NOT NULL THEN
    SELECT region INTO v_region
    FROM yi.chapters
    WHERE id = NEW.yi_chapter_id;
    IF v_region IS NOT NULL THEN
      NEW.yi_zone_code := v_region;
    END IF;
  END IF;

  -- Back-compat: mirror yi_zone_code into the older `zone` enum column
  IF NEW.zone IS NULL AND NEW.yi_zone_code IS NOT NULL THEN
    BEGIN
      NEW.zone := NEW.yi_zone_code::public.yi_zone;
    EXCEPTION WHEN invalid_text_representation THEN
      -- yi_zone_code didn't match any enum label; leave zone NULL rather
      -- than abort the insert. The text column still carries the truth.
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_events_autoderive_zone ON yip.events;
CREATE TRIGGER tg_events_autoderive_zone
  BEFORE INSERT OR UPDATE ON yip.events
  FOR EACH ROW
  EXECUTE FUNCTION yip.tg_events_autoderive_zone();

-- ─── AFTER INSERT: auto-attach central topics on chapter events ──────

CREATE OR REPLACE FUNCTION yip.tg_events_attach_central_topics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = yip, public
AS $$
BEGIN
  -- Only chapter-level events with a yi_chapter_id auto-inherit central
  -- topics. Regional/national events curate their own.
  IF NEW.level = 'chapter' AND NEW.yi_chapter_id IS NOT NULL THEN
    INSERT INTO yip.event_topics (event_id, topic_id, is_central)
    SELECT NEW.id, t.id, true
    FROM yip.topics t
    WHERE t.category = 'central' AND t.is_active = true
    ON CONFLICT (event_id, topic_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_events_attach_central_topics ON yip.events;
CREATE TRIGGER tg_events_attach_central_topics
  AFTER INSERT ON yip.events
  FOR EACH ROW
  EXECUTE FUNCTION yip.tg_events_attach_central_topics();

-- ─── Grants ─────────────────────────────────────────────────────────
-- SECURITY DEFINER lets the trigger read yi.chapters / write yip.event_topics
-- even when invoked by an authenticated user whose RLS would otherwise block.
-- No explicit GRANTs needed — the trigger runs in the function owner's role.
