-- yip_sync_participant_party_link
--
-- Safety net for the party assignment of a participant. The three party fields
-- on yip.participants must always agree:
--   * party_number  — the lettered party (drives the "Party E" label in the UI)
--   * party_id      — the link to the yip.parties record
--   * party_side    — the bench (ruling / opposition), which IS the party's side
--
-- The "Edit participant" action historically set party_number + party_side but
-- not party_id, leaving a student shown as "Party E" yet not truly linked — so
-- the government split and bench-based awards skipped them (BUG: Nischay #225).
-- The app layer now fixes the edit path and stops-and-warns on a bad party, but
-- this trigger guarantees the invariant for EVERY write path (import, walk-in,
-- allocation re-run, future code, raw SQL): whenever party_number is set or
-- changed, party_id and party_side are auto-filled from the matching party.
--
-- Consistency with existing flows (verified):
--   * Allocation engine sets a participant's bench only when the party record
--     already has that side, so deriving party_side from the party is identical.
--   * Government Formation updates party_side (+ unchanged party_number); the
--     trigger leaves an explicitly-set bench untouched when the number is
--     unchanged and the link already exists, so bench flips are preserved.
--
-- On a number that matches no party in the event the trigger clears the link
-- (rather than RAISE — safer on live tables); the app layer surfaces the
-- friendly "no such party" error and an audit query can catch any raw-SQL slips.

CREATE OR REPLACE FUNCTION yip.sync_participant_party_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_party RECORD;
BEGIN
  -- No party number → fully unlinked (link + bench cleared together).
  IF NEW.party_number IS NULL THEN
    NEW.party_id := NULL;
    NEW.party_side := NULL;
    RETURN NEW;
  END IF;

  -- Act when the party is (re)assigned, or when the link is missing (self-heal).
  IF TG_OP = 'INSERT'
     OR NEW.party_number IS DISTINCT FROM OLD.party_number
     OR NEW.party_id IS NULL THEN
    SELECT id, side INTO v_party
    FROM yip.parties
    WHERE event_id = NEW.event_id
      AND party_number = NEW.party_number
    LIMIT 1;

    IF FOUND THEN
      NEW.party_id := v_party.id;
      IF TG_OP = 'INSERT'
         OR NEW.party_number IS DISTINCT FROM OLD.party_number THEN
        -- Assignment / move: bench follows the new party.
        NEW.party_side := v_party.side;
      ELSIF NEW.party_side IS NULL THEN
        -- Pure self-heal (link was missing, number unchanged): only fill a
        -- bench that is itself blank — never clobber an explicitly-set bench.
        NEW.party_side := v_party.side;
      END IF;
    ELSE
      -- Number points to a party that does not exist in this event.
      NEW.party_id := NULL;
      NEW.party_side := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fire only when the party columns are actually written, so unrelated updates
-- (check-in, score flags, role changes) never pay for the trigger and the
-- Government Formation party_side propagation is never disturbed.
DROP TRIGGER IF EXISTS trg_sync_participant_party_link ON yip.participants;
CREATE TRIGGER trg_sync_participant_party_link
  BEFORE INSERT OR UPDATE OF party_number, party_id
  ON yip.participants
  FOR EACH ROW
  EXECUTE FUNCTION yip.sync_participant_party_link();
