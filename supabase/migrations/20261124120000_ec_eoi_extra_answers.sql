-- Yi Erode EC 2027 EOI: extra questions for crowded areas (Director 24 Nov 2026).
-- Members who pick Thalir, Rural Initiatives or Entrepreneurship answer 2 short
-- extra questions. Add-only: one new table + one new save function. The
-- original ec_eoi_submit stays as it was, so the live form keeps working
-- until the new code is released. Same lock-down as the other EOI tables.

create table if not exists yi_connect.ec_eoi_extra_answers (
  application_id uuid not null references yi_connect.ec_eoi_applications (id) on delete cascade,
  role_id text not null check (role_id ~ '^vertical-([0-9]|1[0-3])$'),
  question_key text not null check (question_key ~ '^[a-z0-9-]{1,40}$'),  -- see EOI_EXTRA_QUESTIONS in lib/ec-eoi/catalog.ts
  answer text not null check (char_length(answer) between 1 and 500),
  primary key (application_id, role_id, question_key)
);
alter table yi_connect.ec_eoi_extra_answers enable row level security;
revoke all on yi_connect.ec_eoi_extra_answers from anon, authenticated;
grant all on yi_connect.ec_eoi_extra_answers to service_role;

-- Same as ec_eoi_submit, plus the extra answers, all in one transaction.
create or replace function yi_connect.ec_eoi_submit_v2(p jsonb)
returns table (id uuid, submitted_at timestamptz, duplicate boolean)
language plpgsql
security invoker
set search_path = yi_connect, pg_temp
as $$
declare
  v_id uuid;
  v_at timestamptz;
  v_roles text[];
begin
  select array_agg(s->>'roleId') into v_roles from jsonb_array_elements(p->'selections') s;

  insert into yi_connect.ec_eoi_applications as a
    (request_key, team_year, member_name, phone, acknowledged, commitment_version, role_ids)
  values ((p->>'requestKey')::uuid, p->>'teamYear', p->>'name', p->>'phone', true, p->>'commitmentVersion', v_roles)
  on conflict (request_key) do nothing
  returning a.id, a.submitted_at into v_id, v_at;

  if v_id is null then
    select a.id, a.submitted_at into v_id, v_at from yi_connect.ec_eoi_applications a where a.request_key = (p->>'requestKey')::uuid;
    return query select v_id, v_at, true;
    return;
  end if;

  insert into yi_connect.ec_eoi_proposals (application_id, role_id, response)
  select v_id, s->>'roleId', s->>'answer' from jsonb_array_elements(p->'selections') s;

  insert into yi_connect.ec_eoi_extra_answers (application_id, role_id, question_key, answer)
  select v_id, s->>'roleId', x->>'key', x->>'answer'
  from jsonb_array_elements(p->'selections') s,
       jsonb_array_elements(coalesce(s->'extras', '[]'::jsonb)) x;

  return query select v_id, v_at, false;
end $$;
revoke all on function yi_connect.ec_eoi_submit_v2(jsonb) from public, anon, authenticated;
grant execute on function yi_connect.ec_eoi_submit_v2(jsonb) to service_role;
