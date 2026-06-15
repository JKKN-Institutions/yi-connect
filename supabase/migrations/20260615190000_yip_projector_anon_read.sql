-- ============================================================================
-- Public projector (/yip/event/<id>/display) anon read access — scoped + safe.
-- ----------------------------------------------------------------------------
-- The projector is a PUBLIC screen (no login). It reads events/agenda/
-- agenda_speakers/participants/bills/questions/vote_sessions/votes via the
-- browser anon client. After the 2026-06 security lockdown, yip.* tables have
-- RLS with policies ONLY for `authenticated` + `service_role` and NONE for
-- `anon` → anon SELECT returns zero rows → the projector shows "Event not
-- found" on any screen that isn't logged in. (Caught by a truly-anonymous
-- projector persona in the Erode multi-role walkthrough, 2026-06-15.)
--
-- This restores anon read for the projector's tables, carefully:
--   * NEVER exposes participants.access_code / phone / email / parent_phone —
--     those columns are already revoked from anon (column grants); we only add
--     a row policy on top of the existing safe column grants.
--   * Ballot secrecy: anon must NOT learn WHO voted what. We revoke the voter-
--     identity columns from anon on yip.votes, and only allow anon to read
--     ballots for REVEALED sessions (matches the projector, which shows tallies
--     only after reveal). The tally is computed from vote_value alone.
--   * Minor PII: participant rows are anon-readable ONLY while the event is
--     actively running or completed (names are shown on the public projector
--     in those states anyway) — not for draft/registration events.
--   * authenticated / service_role behaviour is unchanged (separate policies).
-- ============================================================================

-- ── Low-sensitivity public projector data: schedule, queue, content ──────────
create policy yip_events_read_anon          on yip.events          for select to anon using (true);
create policy yip_agenda_read_anon          on yip.agenda          for select to anon using (true);
create policy yip_agenda_speakers_read_anon on yip.agenda_speakers for select to anon using (true);
create policy yip_bills_read_anon           on yip.bills           for select to anon using (true);
create policy yip_questions_read_anon       on yip.questions       for select to anon using (true);
create policy yip_vote_sessions_read_anon   on yip.vote_sessions   for select to anon using (true);

-- ── Participants: column grants already exclude access_code + PII. Scope the
--    row read to actively-running / completed events only (minors). ───────────
create policy yip_participants_read_anon on yip.participants for select to anon
using (
  exists (
    select 1 from yip.events e
    where e.id = participants.event_id
      and e.status in ('day1_live','day1_complete','day2_live','completed','results_published')
  )
);

-- ── Votes: BALLOT SECRECY. yip.votes had a TABLE-LEVEL anon SELECT grant (all
--    columns, incl. participant_id) — a column-level revoke can't remove that,
--    so revoke the whole-table grant and re-grant ONLY the tally columns. anon
--    can then never read participant_id / recorded_by_* (who voted). ──────────
revoke select on yip.votes from anon;
grant select (id, event_id, session_id, agenda_item_id, vote_type, vote_value)
  on yip.votes to anon;

create policy yip_votes_tally_read_anon on yip.votes for select to anon
using (
  exists (
    select 1 from yip.vote_sessions vs
    where vs.id = votes.session_id and vs.status = 'revealed'
  )
);
