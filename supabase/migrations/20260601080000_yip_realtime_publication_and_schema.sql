-- YIP realtime fix (2026-06-01).
--
-- The YIP live layer (control panel -> projector / students / jury) was dead.
-- Two compounding bugs, found during live click-testing of the dress-rehearsal
-- event:
--   1. (DB, this migration) NO yip.* tables were in the supabase_realtime
--      publication — Supabase was not broadcasting any YIP changes at all.
--   2. (code, same PR) every YIP realtime subscription used schema:"public"
--      instead of "yip", so even the subscriptions pointed at the wrong schema.
--      Fixed in: lib/yip/hooks/use-realtime-event.ts, lib/yip/hooks/use-vote-session.ts,
--      app/yip/event/[id]/display/projector-display.tsx,
--      app/yip/jury/(authed)/jury-scoring-client.tsx (9 occurrences).
--
-- Symptom: the projector did not follow the organizer's agenda, students/jury
-- screens did not update live, votes did not appear live, and the control panel
-- did not reflect the organizer's own actions (Start Day, Lock, etc.) without a
-- manual refresh. All underlying data writes worked — only the live push was dead.
--
-- Applied to prod via the Supabase Management API on 2026-06-01 and verified
-- (control panel + projector update live without refresh).
--
-- REPLICA IDENTITY FULL is required so realtime UPDATE/DELETE payloads include
-- the columns the client filters use (e.g. event_id on agenda DELETE).

alter table yip.events           replica identity full;
alter table yip.agenda           replica identity full;
alter table yip.vote_sessions    replica identity full;
alter table yip.votes            replica identity full;
alter table yip.agenda_speakers  replica identity full;
alter table yip.questions        replica identity full;
alter table yip.bills            replica identity full;

alter publication supabase_realtime add table
  yip.events,
  yip.agenda,
  yip.vote_sessions,
  yip.votes,
  yip.agenda_speakers,
  yip.questions,
  yip.bills;
