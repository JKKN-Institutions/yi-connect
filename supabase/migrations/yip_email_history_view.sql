-- yip.email_history — one place to answer "did this student get any email?"
--
-- Context. YIP now logs outbound email in two tables, for good reasons:
--
--   yip.formation_emails  — the older, richer one. Carries step_id, kind and
--                           attempts, because formation email is a multi-step
--                           sequence with retries. 379 rows and counting.
--   yip.email_log         — added 2026-08-14 for access codes, which are a
--                           single fire-and-forget batch with no steps and no
--                           retry, so it has provider_message_id and
--                           recipient_name instead.
--
-- Neither is wrong. Collapsing them would mean either losing step_id/attempts
-- or bolting nullable formation columns onto a table that has no use for them.
--
-- What was actually missing is the READ. When a student says "I never got
-- anything", an organiser had to know which of the two tables to look in — and
-- which one depends on what kind of email it would have been, which is exactly
-- what they are trying to find out. This view removes that.
--
-- Deliberately a view, not a table: no second copy of the data, nothing to keep
-- in sync, and it cannot drift from its sources.

create or replace view yip.email_history as
  select
    'access_code'::text            as source,
    el.id,
    el.event_id,
    el.participant_id,
    el.trigger_type                as kind,
    el.recipient_email,
    el.recipient_name,
    el.subject_line,
    el.status,
    el.error,
    -- email_log has no retry concept: a row is attempted exactly once.
    1                              as attempts,
    el.created_at,
    el.sent_at
  from yip.email_log el

  union all

  select
    'formation'::text              as source,
    fe.id,
    fe.event_id,
    fe.participant_id,
    fe.kind,
    fe.recipient_email,
    -- formation_emails does not capture a display name; the participant row has it.
    null::text                     as recipient_name,
    fe.subject_line,
    fe.status,
    fe.error,
    fe.attempts,
    fe.created_at,
    fe.sent_at
  from yip.formation_emails fe;

comment on view yip.email_history is
  'Every YIP outbound email across both logs (access codes and formation), normalised. Read-only union — answers "did this participant receive anything, and what happened to it?" without knowing which table to look in. Service-role only.';

-- The yip schema carries blanket default grants, so a new object arrives with
-- anon SELECT attached. These rows are student email addresses; revoke it and
-- grant only the role the app actually reads with.
revoke all on yip.email_history from anon, authenticated;
grant select on yip.email_history to service_role;
