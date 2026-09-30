-- Fix: the serial_no trigger on yip.participants referenced the table by its bare
-- name ("participants"), so it only resolved when the caller's search_path
-- happened to include the yip schema.
--
-- The app's inserts go through PostgREST with Content-Profile: yip, which puts yip
-- on the search_path, so they worked. A direct database load (Management API,
-- psql, a script) runs with search_path = "$user", public, extensions — there is
-- no public.participants, so every such insert failed with
--   relation "participants" does not exist
-- Hit on 2026-09-30 loading the Mizoram regional roster; worked around by setting
-- the search_path by hand (memory: feedback_direct_db_roster_load_two_traps).
--
-- The function lives in the public schema; only the trigger on yip.participants
-- uses it. We keep its name and schema so the trigger binding is unchanged, qualify
-- the table, and pin search_path so the lookup can no longer depend on the caller.
-- Mirrors yip.set_participant_constituency_number, which already qualifies it.
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.set_participant_serial_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.serial_no IS NULL AND NEW.event_id IS NOT NULL THEN
    SELECT COALESCE(MAX(serial_no), 0) + 1
      INTO NEW.serial_no
      FROM yip.participants
      WHERE event_id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;
