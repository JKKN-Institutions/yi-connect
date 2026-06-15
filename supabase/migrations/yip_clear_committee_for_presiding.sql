-- "Once someone is assigned to Speaker or Deputy Speaker, they are removed from
-- any committee" (user rule, 2026-06-15; handbook: the Speaker Panel presides
-- and is not in a drafting committee). Enforced by a trigger so it holds on
-- EVERY path that sets the role — the Speaker election reveal, a manual role
-- edit, allocation, or the assignCommittees engine.
--
-- Applied live to bkmpbcoxbjyafieabxao via the Management API on 2026-06-15.

create or replace function yip.tg_clear_committee_for_presiding()
returns trigger language plpgsql as $$
begin
  if NEW.parliament_role in ('speaker', 'deputy_speaker') then
    NEW.committee_name := null;
    NEW.committee_number := null;
  end if;
  return NEW;
end $$;

drop trigger if exists participants_clear_committee_presiding on yip.participants;
create trigger participants_clear_committee_presiding
  before insert or update on yip.participants
  for each row execute function yip.tg_clear_committee_for_presiding();

-- One-time backfill: clear committees from any existing Speaker/Deputy Speaker.
update yip.participants
   set committee_name = null, committee_number = null
 where parliament_role in ('speaker', 'deputy_speaker')
   and committee_name is not null;
