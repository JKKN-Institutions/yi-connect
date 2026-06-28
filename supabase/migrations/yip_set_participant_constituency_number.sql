-- Auto-allot Const. No. (constituency_number) per event, starting at 101.
--
-- A YIP participant's identity number everywhere is constituency_number ("Const. No.").
-- Roster uploads (e.g. the chapter students list) often have no Constituency Number
-- column, which previously left it NULL → participants showed "—" on every screen.
-- This trigger fills it in on INSERT when blank, mirroring the existing
-- set_participant_serial_no trigger (serial_no = roster counter, starts at 1).
--
-- Any number explicitly provided in the upload is respected (trigger only fires
-- when constituency_number IS NULL). Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION yip.set_participant_constituency_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.constituency_number IS NULL AND NEW.event_id IS NOT NULL THEN
    SELECT COALESCE(MAX(constituency_number), 100) + 1
      INTO NEW.constituency_number
      FROM yip.participants
      WHERE event_id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participants_set_constituency_number ON yip.participants;
CREATE TRIGGER participants_set_constituency_number
  BEFORE INSERT ON yip.participants
  FOR EACH ROW
  EXECUTE FUNCTION yip.set_participant_constituency_number();

-- One-time backfill of existing participants missing a Const. No.
-- Per event, continue from the current max (floor 100) in serial-number order.
-- The WHERE guard makes this a no-op once every row has a number.
WITH ranked AS (
  SELECT p.id,
         (SELECT COALESCE(MAX(p2.constituency_number), 100)
            FROM yip.participants p2
           WHERE p2.event_id = p.event_id)
         + ROW_NUMBER() OVER (
             PARTITION BY p.event_id
             ORDER BY p.serial_no NULLS LAST, p.created_at
           ) AS new_no
    FROM yip.participants p
   WHERE p.constituency_number IS NULL
)
UPDATE yip.participants t
   SET constituency_number = r.new_no
  FROM ranked r
 WHERE t.id = r.id;
