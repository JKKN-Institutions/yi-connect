-- ============================================================================
-- yip.reset_event_for_go_live(p_event_id)
-- ----------------------------------------------------------------------------
-- "Clear practice data / Go Live" reset for a chapter chair. After rehearsing
-- on the real event, this wipes everything entered during testing AND the
-- allocation, so day 1 starts clean — KEEPING only the imported students and
-- the agenda.
--
-- Scope (director decision 2026-06-15):
--   DELETE (all rows for the event, regardless of is_mock):
--     votes, vote_sessions, scores (+ score_audit), committee_scores,
--     bills (+ bill_documents), motions, questions, results,
--     chat_messages, chat_mutes, feedback
--   CLEAR allocation on participants (KEEP the student rows):
--     party_id/number/side, parliament_role, ministry, constituency_*,
--     committee_number/name, all check-in flags, speech_finished,
--     qualified_for_next
--   DELETE parties (re-created when allocation is re-run / re-imported)
--   KEEP: event, agenda, participants(cleared), checklist, central topics,
--         jury panel, volunteers, registrations, media, invitations, fees.
--
-- Atomic: runs in one transaction (function body) — all-or-nothing.
-- Authorization is enforced in the server action (canDelete = chair / super-
-- admin) + a type-the-event-name confirmation BEFORE this is called. Execute
-- is granted ONLY to service_role (the gated server action's client); never to
-- anon/authenticated.
-- ============================================================================

create or replace function yip.reset_event_for_go_live(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to yip, public
as $$
declare
  v jsonb := '{}'::jsonb;
  n int;
begin
  if p_event_id is null then
    raise exception 'p_event_id is required';
  end if;

  -- score_audit has no event_id — delete via its scores first (FK child).
  delete from score_audit where score_id in (select id from scores where event_id = p_event_id);
  get diagnostics n = row_count; v := v || jsonb_build_object('score_audit', n);

  delete from votes where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('votes', n);

  delete from vote_sessions where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('vote_sessions', n);

  delete from committee_scores where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('committee_scores', n);

  delete from scores where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('scores', n);

  delete from bill_documents where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('bill_documents', n);

  delete from bills where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('bills', n);

  delete from motions where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('motions', n);

  delete from questions where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('questions', n);

  delete from results where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('results', n);

  delete from chat_messages where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('chat_messages', n);

  delete from chat_mutes where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('chat_mutes', n);

  delete from feedback where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('feedback', n);

  -- Clear allocation + live state on participants (KEEP the student rows).
  update participants set
    party_id = null,
    party_number = null,
    party_side = null,
    parliament_role = null,
    ministry = null,
    constituency_name = null,
    constituency_state = null,
    committee_number = null,
    committee_name = null,
    checked_in = false,
    checked_in_at = null,
    checked_in_day1 = false,
    checked_in_day1_at = null,
    checked_in_day2 = false,
    checked_in_day2_at = null,
    speech_finished = false,
    qualified_for_next = false
  where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('participants_cleared', n);

  -- Parties are an allocation artifact; participants.party_id is now null so
  -- there is no FK referencing them.
  delete from parties where event_id = p_event_id;
  get diagnostics n = row_count; v := v || jsonb_build_object('parties', n);

  return v;
end;
$$;

-- Destructive: execute ONLY by service_role (the gated server action). Never
-- anon/authenticated (new functions default to PUBLIC execute — revoke it).
revoke all on function yip.reset_event_for_go_live(uuid) from public;
revoke all on function yip.reset_event_for_go_live(uuid) from anon, authenticated;
grant execute on function yip.reset_event_for_go_live(uuid) to service_role;
