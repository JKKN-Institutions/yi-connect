-- YIP: make yip.parties.side nullable (benchless parties).
--
-- Ruling/Opposition ("side") is now decided on EVENT DAY (parties negotiate a
-- coalition government off-app), NOT at allocation. Allocation only splits
-- students equally across the chapter's N parties (Party A..N) + assigns a
-- constituency. So a party row can exist with NO bench yet.
--
-- participants.party_side is already nullable and every read already renders
-- "--" for a null bench, so this only relaxes the parties table to match.
-- Legacy events that already carry ruling/opposition keep their values; this
-- is purely a DROP NOT NULL (no data change).

alter table yip.parties alter column side drop not null;
