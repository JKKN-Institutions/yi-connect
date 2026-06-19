-- DPDP privacy mode — per-event PII anonymization (2026-06-19).
--
-- Adds an event-level privacy_mode flag + pii_purged_at stamp, a per-chapter
-- standing default, and a SECURITY DEFINER function that anonymizes ONE event's
-- participant + volunteer PII (name -> stable pseudonym, email/phone/parent/
-- school NULLed) and stamps pii_purged_at. The app gates invocation to
-- super-admin + chapter chair (getYipEventAccess.canDelete) and audit-logs it.
-- Anonymizing (vs deleting) keeps scores/results/awards coherent by id while
-- removing personal data — DPDP-compliant, since anonymized data is no longer
-- personal data.

alter table yip.events
  add column if not exists privacy_mode boolean not null default false;
alter table yip.events
  add column if not exists pii_purged_at timestamptz;

-- Per-chapter standing default: events created for the chapter inherit
-- privacy_mode = privacy_default.
create table if not exists yip.chapter_privacy (
  yi_chapter      text primary key,
  privacy_default boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- New yip tables ship anon-readable under the default ACL — lock it down.
-- Reads/writes go through the service client only (service_role bypasses RLS).
alter table yip.chapter_privacy enable row level security;
revoke all on table yip.chapter_privacy from anon, authenticated;
grant all on table yip.chapter_privacy to service_role;

-- Anonymize one event's PII. SECURITY DEFINER so the service-role app call runs
-- it; revoked from anon/authenticated so it can't be invoked via PostgREST.
-- The pseudonym MUST match lib/yip/pii.ts pseudonym() so live-masked names equal
-- the eventual purged names.
create or replace function yip.fn_anonymize_event_pii(p_event_id uuid)
returns table(participants_anonymized integer, volunteers_anonymized integer)
language plpgsql
security definer
set search_path = yip, public
as $$
declare
  p_count integer := 0;
  v_count integer := 0;
begin
  -- school_name + full_name are NOT NULL, so use a non-identifying placeholder /
  -- pseudonym rather than NULL (NULL would violate the constraint).
  update yip.participants
     set full_name    = 'Participant #' || substr(id::text, 1, 8),
         email        = null,
         phone        = null,
         parent_phone = null,
         school_name  = '[removed]',
         school_id    = null,
         updated_at   = now()
   where event_id = p_event_id;
  get diagnostics p_count = row_count;

  update yip.volunteers
     set full_name  = 'Volunteer #' || substr(id::text, 1, 8),
         email      = null,
         phone      = null,
         updated_at = now()
   where event_id = p_event_id;
  get diagnostics v_count = row_count;

  update yip.events
     set pii_purged_at = now(),
         updated_at    = now()
   where id = p_event_id;

  return query select p_count, v_count;
end;
$$;

revoke all on function yip.fn_anonymize_event_pii(uuid) from public, anon, authenticated;
