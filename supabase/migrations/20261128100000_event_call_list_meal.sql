-- Event call list: meal choice + head count for events that serve a meal.
-- ADD-ONLY: two new nullable columns on yi_connect.event_call_list (a table
-- added the same day by 20261128090000_event_call_list.sql). Nothing else changes.
--
-- The per-event switch lives in events.custom_fields.meal_choice (existing
-- jsonb), so the events table needs no schema change.
--
-- Undo:
--   alter table yi_connect.event_call_list drop column if exists meal_choice;
--   alter table yi_connect.event_call_list drop column if exists head_count;

alter table yi_connect.event_call_list
  add column if not exists meal_choice text
    check (meal_choice is null or meal_choice in ('veg', 'non_veg')),
  add column if not exists head_count integer
    check (head_count is null or (head_count between 1 and 20));

comment on column yi_connect.event_call_list.meal_choice is 'veg / non_veg, asked on the call when the result is coming; null = not asked yet';
comment on column yi_connect.event_call_list.head_count is 'People coming with this invitee, including them (plates); null unless coming';

notify pgrst, 'reload schema';
