-- Pre-event agenda phase.
--
-- The agenda is organised by `day`: 1 and 2 are the two event days. This adds a
-- third phase, day 0 = "Pre-event", for dated preparation milestones (roster
-- import, codes sent, jury briefing, …) so the whole timeline — pre-event then
-- the two days — lives in one place. Items are movable between phases.
--
-- Additive + backward compatible: relaxes the day CHECK to allow 0, and adds a
-- nullable scheduled_date used only by pre-event items (event days are dated by
-- the event's own day1_date / day2_date).

ALTER TABLE yip.agenda DROP CONSTRAINT IF EXISTS agenda_items_day_check;
ALTER TABLE yip.agenda ADD CONSTRAINT agenda_items_day_check CHECK (day IN (0, 1, 2));

ALTER TABLE yip.agenda ADD COLUMN IF NOT EXISTS scheduled_date date;
