-- ============================================================================
-- Yi-Future push: allow 'expert' as a push subject  (Feature #3, 2026-06-29)
--
-- future.push_subscriptions.subject_type had a CHECK limiting it to
-- (auth_user, delegate, jury, mentor, partner). Experts can now log in and
-- opt into push, so widen the allow-list to include 'expert'. Drops the old
-- constraint by its discovered name (robust to auto-generated naming).
-- ============================================================================

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'future.push_subscriptions'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%subject_type%';

  if cname is not null then
    execute format('alter table future.push_subscriptions drop constraint %I', cname);
  end if;
end $$;

alter table future.push_subscriptions
  add constraint push_subscriptions_subject_type_check
  check (subject_type = any (array[
    'auth_user'::text, 'delegate'::text, 'jury'::text,
    'mentor'::text, 'partner'::text, 'expert'::text
  ]));
