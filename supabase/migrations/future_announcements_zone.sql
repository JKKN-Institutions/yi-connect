-- Yi-Future announcements: add 'zone' (region) targeting for national admins.
do $$
declare cname text;
begin
  select con.conname into cname from pg_constraint con
  where con.conrelid = 'future.announcements'::regclass and con.contype='c'
    and pg_get_constraintdef(con.oid) ilike '%audience%';
  if cname is not null then
    execute format('alter table future.announcements drop constraint %I', cname);
  end if;
end $$;
alter table future.announcements
  add constraint announcements_audience_check
  check (audience in ('everyone','chapter','team','delegate','zone'));
alter table future.announcements add column if not exists zone text;
