-- Event call list: who should phone each invitee, and what they said.
-- ADD-ONLY: one new table. No existing table or column is changed.
--
-- Why a separate table and not new columns on event_rsvps / guest_rsvps:
--   * event_rsvps has an anon UPDATE policy (anon_update_rsvps_by_token) for
--     published events, so call columns there would be writable by anyone
--     holding the public RSVP link.
--   * One table covers both member RSVPs and guests, so the call list reads
--     and writes one place.
--   * Undo is a single DROP TABLE; the RSVP flows are untouched.
--
-- A missing row means "not called yet, no caller assigned".
--
-- Undo:  drop table if exists yi_connect.event_call_list;

create table if not exists yi_connect.event_call_list (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references yi_connect.events(id) on delete cascade,
  rsvp_id uuid unique references yi_connect.event_rsvps(id) on delete cascade,
  guest_rsvp_id uuid unique references yi_connect.guest_rsvps(id) on delete cascade,
  assigned_caller_member_id uuid references yi_connect.members(id) on delete set null,
  call_result text not null default 'not_called'
    check (call_result in ('not_called', 'coming', 'not_coming', 'no_answer', 'call_back')),
  called_by_member_id uuid references yi_connect.members(id) on delete set null,
  called_at timestamptz,
  call_note text check (call_note is null or char_length(call_note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_call_list_one_invitee check (
    (rsvp_id is not null and guest_rsvp_id is null)
    or (rsvp_id is null and guest_rsvp_id is not null)
  )
);

create index if not exists event_call_list_event_idx
  on yi_connect.event_call_list (event_id);
create index if not exists event_call_list_caller_idx
  on yi_connect.event_call_list (assigned_caller_member_id);

alter table yi_connect.event_call_list enable row level security;

-- Same grants as event_rsvps, minus anon (no public access at all).
grant select, insert, update, delete on yi_connect.event_call_list to authenticated;
grant all on yi_connect.event_call_list to service_role;

-- Leaders of the event: organizer, co-organizers, Co-Chair+ (hierarchy >= 3)
-- of the event's own chapter, or National Admin+ (hierarchy >= 6).
-- Same building blocks as the event_rsvps SELECT policy, scoped to the chapter.
create policy "Event leaders manage the call list"
  on yi_connect.event_call_list
  for all
  to authenticated
  using (
    exists (
      select 1 from yi_connect.events e
      where e.id = event_call_list.event_id
        and (
          e.organizer_id = auth.uid()
          or auth.uid() = any (e.co_organizers)
          or exists (
            select 1
            from yi_connect.user_roles ur
            join yi_connect.roles r on r.id = ur.role_id
            where ur.user_id = auth.uid()
              and (
                r.hierarchy_level >= 6
                or (
                  r.hierarchy_level >= 3
                  and exists (
                    select 1 from yi_connect.members m
                    where m.id = auth.uid() and m.chapter_id = e.chapter_id
                  )
                )
              )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from yi_connect.events e
      where e.id = event_call_list.event_id
        and (
          e.organizer_id = auth.uid()
          or auth.uid() = any (e.co_organizers)
          or exists (
            select 1
            from yi_connect.user_roles ur
            join yi_connect.roles r on r.id = ur.role_id
            where ur.user_id = auth.uid()
              and (
                r.hierarchy_level >= 6
                or (
                  r.hierarchy_level >= 3
                  and exists (
                    select 1 from yi_connect.members m
                    where m.id = auth.uid() and m.chapter_id = e.chapter_id
                  )
                )
              )
          )
        )
    )
  );

-- A caller sees the names given to them...
create policy "Callers see their assigned calls"
  on yi_connect.event_call_list
  for select
  to authenticated
  using (assigned_caller_member_id = auth.uid());

-- ...and can record the result on them (cannot hand the row to someone else).
create policy "Callers record results on their assigned calls"
  on yi_connect.event_call_list
  for update
  to authenticated
  using (assigned_caller_member_id = auth.uid())
  with check (assigned_caller_member_id = auth.uid());

notify pgrst, 'reload schema';
