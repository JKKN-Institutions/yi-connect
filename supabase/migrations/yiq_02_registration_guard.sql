-- YIQ registration abuse guard.
-- Yi-Future took 2.36M faker rows through an ungated public waitlist (#862).
-- Public team registration here is rate-limited per IP and per school, so the
-- same failure mode cannot repeat. Provenance columns are also what lets an
-- organiser triage a flood after the fact.

alter table yiq.teams
  add column if not exists registered_ip text,
  add column if not exists registered_user_agent text;

alter table yiq.schools
  add column if not exists registered_ip text;

create index if not exists yiq_teams_reg_ip_time
  on yiq.teams (registered_ip, created_at desc);

create index if not exists yiq_schools_reg_ip_time
  on yiq.schools (registered_ip, created_at desc);

-- A school may field at most 3 teams per category per chapter event. Enforced
-- in the action; this partial index makes the check cheap.
create index if not exists yiq_teams_school_cat
  on yiq.teams (school_id, category) where status <> 'withdrawn';
