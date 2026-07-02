-- "Now Speaking" volunteer console — hard invariant: at most ONE 'speaking'
-- row per agenda item.
--
-- getCurrentSpeaker() (app/yip/actions/scoring.ts) reads the live speaker with
-- .single(); two simultaneous 'speaking' rows would error and every jury screen
-- would lose its banner. setLiveSpeaker()/advanceSpeaker() complete all
-- 'speaking' rows before setting a new one, but under two volunteers tapping at
-- the exact same instant the separate statements could still race. This partial
-- unique index makes a second 'speaking' row physically impossible: the losing
-- writer gets a 23505 and setLiveSpeaker retries (complete-again → set-again),
-- so the LAST tap wins cleanly while the invariant never breaks.
--
-- Safe/additive: only 'speaking' rows are indexed (pending/completed/skipped are
-- unaffected), and no existing writer ever holds two 'speaking' rows at once
-- (advanceSpeaker completes-then-sets; generateSpeakerQueue inserts 'pending').
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agenda_speaker_one_speaking
  ON yip.agenda_speakers (agenda_item_id)
  WHERE status = 'speaking';
