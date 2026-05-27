-- Phase 19 / D: Frictionless jury login
-- Add optional `email` column to yip.jury_assignments to support
-- email-based jury login (Speaker 3 / Yi National team meeting 2026-05-27).
--
-- The column is NULLABLE so existing access-code-only rows continue to work.
-- Uniqueness is enforced PER EVENT (a single email cannot be assigned twice
-- to the same event, but the same person CAN jury multiple events).
-- Email is stored lowercase to make matching case-insensitive.

ALTER TABLE yip.jury_assignments
  ADD COLUMN IF NOT EXISTS email text;

-- Lowercase normalisation on write (defensive — app should also normalise)
CREATE OR REPLACE FUNCTION yip.jury_assignments_lower_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
    IF NEW.email = '' THEN
      NEW.email := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jury_assignments_lower_email_trg ON yip.jury_assignments;
CREATE TRIGGER jury_assignments_lower_email_trg
BEFORE INSERT OR UPDATE OF email ON yip.jury_assignments
FOR EACH ROW
EXECUTE FUNCTION yip.jury_assignments_lower_email();

-- One email per event (NULLs allowed, multiple NULLs allowed by default)
CREATE UNIQUE INDEX IF NOT EXISTS jury_assignments_event_email_uniq
  ON yip.jury_assignments (event_id, email)
  WHERE email IS NOT NULL;

-- Lookup index for the login path
CREATE INDEX IF NOT EXISTS jury_assignments_email_idx
  ON yip.jury_assignments (email)
  WHERE email IS NOT NULL;
