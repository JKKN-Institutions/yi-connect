-- ============================================================================
-- Yi-Future CHECK-IN VOLUNTEERS  (ports the proven yip.volunteers model)
--
-- STATUS: **NOT APPLIED TO PRODUCTION** as of this commit. Review, then apply
-- via the Supabase Management API (project ref bkmpbcoxbjyafieabxao).
--
-- Before: Yi-Future had no volunteer concept at all. Check-in was an
-- admin-only bulk checkbox form on /yi-future/chapter/journey/[id] writing
-- future.phase_event_attendance — a chapter chair had to stand at the desk
-- with their own laptop and their own Supabase Auth login.
--
-- After: a chapter can staff a desk with volunteers who sign in with a
-- 6-character access code (no email, no password) at /yi-future/access and
-- mark delegates present one tap at a time.
--
-- ---------------------------------------------------------------------------
-- BLOCKER A — future.phase_event_attendance.marked_by is a FOREIGN KEY to
--   auth.users(id) and a volunteer has NO auth account.
--
--   CHOSEN: a second marker column `marked_by_volunteer_id` with its own FK to
--   future.volunteers(id), plus a CHECK constraint and a BEFORE trigger that
--   together keep EXACTLY ONE of the two markers set on every row. The audit
--   question "who marked this delegate present" therefore always has exactly
--   one answer: an auth user (admin) or a volunteer row (desk staff).
--
--   REJECTED (i) give volunteers real auth accounts — contradicts the
--   no-email/no-password requirement, needs an email per volunteer that a
--   walk-in desk helper does not have, mints hundreds of auth users per
--   chapter, and orphaned user_id links have locked real people out of this
--   app before.
--   REJECTED (ii) an opaque marker text column — loses referential integrity;
--   it cannot be joined back to a person, so it cannot actually answer "who".
--
--   The normalising trigger below exists so that NO change is needed in
--   app/yi-future/actions/attendance.ts: the existing admin bulk upsert keeps
--   writing marked_by only, and the trigger clears any stale volunteer id for
--   it. (That file is owned by another workstream and is untouched by this PR.)
--
-- ---------------------------------------------------------------------------
-- BLOCKER B — access-code uniqueness is PER TABLE only, and
--   validateAccessCode() resolves a submitted code across
--   delegates -> mentors -> jury_assignments -> corporate_partners -> experts.
--   A volunteer code that happened to equal a delegate's code would resolve as
--   the DELEGATE, silently signing a staff member in as a student.
--
--   CHOSEN: make the collision IMPOSSIBLE rather than handle it. A volunteer
--   code has a structurally different SHAPE — exactly 6 characters with a
--   leading ZERO — and the generator that mints every delegate / mentor / jury /
--   partner / expert code draws from a 32-character alphabet that contains no
--   zero at all (0, O, 1 and I were excluded as ambiguous in print). So no
--   other code-holder's code can ever have the volunteer shape, and
--   validateAccessCode() routes on the shape: a 0-leading code is looked up
--   ONLY in future.volunteers, and any other code is never looked up there.
--   Definition and proof: lib/yi-future/access-code-shape.ts. Census of the
--   16,838 codes live on 2026-08-10: zero contain 0, O, 1 or I anywhere.
--
--   REJECTED: deny an ambiguous code. It fails at the worst possible moment —
--   a volunteer standing at a busy desk on event day, told their code belongs
--   to two people and needing a chair to mint a new one on the spot.
--
--   Two defence-in-depth layers remain, and are now UNREACHABLE by design,
--   which is the point — they only start mattering if somebody widens that
--   shared alphabet to include a zero:
--     1. APP  uniqueVolunteerAccessCode() in app/yi-future/actions/
--             volunteers.ts checks a candidate against ALL SIX code-holding
--             future tables before accepting it.
--     2. DB   the trigger below REJECTS (errcode 23505) any volunteer code
--             already present in any of the other five tables, so a future code
--             path that bypasses the action still cannot mint one.
--
--   NOTE FOR WHOEVER APPLIES THIS FILE: the shape decision changed NO DDL in
--   this migration — only the comments above. There is nothing to re-apply and
--   no follow-up migration. The shape is enforced in application code, not by a
--   CHECK constraint, deliberately: a CHECK on the other five tables' codes
--   would have to be a second migration against 16,838 live rows for a rule
--   their only generator already cannot break.
-- ============================================================================

-- ─── 1. future.volunteers ───────────────────────────────────────────────────
-- Scope is chapter + edition (NOT a single session): a chapter's desk staff
-- work whichever of that chapter's sessions is running. Every write re-verifies
-- chapter+edition server-side, so this is the whole authorization scope.
create table if not exists future.volunteers (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references future.editions(id) on delete cascade,
  -- Matches future.phase_events.chapter_id, which also references yi.chapters.
  chapter_id uuid not null references yi.chapters(id),
  full_name text not null,
  phone text,
  email text,
  -- Keep in lockstep with VOLUNTEER_STATIONS in lib/yi-future/volunteers.ts.
  station text not null default 'check_in'
    check (station in (
      'check_in', 'registration', 'help_desk',
      'hospitality', 'av_tech', 'floating'
    )),
  -- NULL = no code issued / code revoked. A NULL code can never sign in
  -- because the resolver matches on equality.
  access_code text,
  is_active boolean not null default true,
  -- Set on the volunteer's first successful code sign-in so the chair can see
  -- at a glance which desks are actually staffed.
  arrived boolean not null default false,
  arrived_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_future_volunteers_chapter_edition
  on future.volunteers (chapter_id, edition_id);

-- Uniqueness WITHIN volunteers (partial: only issued codes).
create unique index if not exists uq_future_volunteers_access_code
  on future.volunteers (access_code)
  where access_code is not null;

-- BLOCKER B defence-in-depth — cross-table collision guard. Unreachable while
-- volunteer codes keep their leading-zero shape (see the header); kept so that
-- widening the shared code alphabet cannot mint a colliding code behind the
-- app's back. Not SECURITY DEFINER on purpose: it runs as the writing role, and
-- only the service client writes this table (RLS below has no policies for
-- anon/authenticated).
create or replace function future.volunteers_access_code_global_guard()
returns trigger
language plpgsql
as $$
begin
  if new.access_code is null then
    return new;
  end if;

  new.access_code := upper(btrim(new.access_code));

  if exists (select 1 from future.delegates          where access_code = new.access_code)
     or exists (select 1 from future.mentors            where access_code = new.access_code)
     or exists (select 1 from future.jury_assignments   where access_code = new.access_code)
     or exists (select 1 from future.corporate_partners where access_code = new.access_code)
     or exists (select 1 from future.experts            where access_code = new.access_code)
  then
    raise exception
      'volunteer access code % already belongs to a delegate/mentor/jury/partner/expert',
      new.access_code
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

revoke execute on function future.volunteers_access_code_global_guard() from public;

drop trigger if exists trg_future_volunteers_access_code_global_guard
  on future.volunteers;
create trigger trg_future_volunteers_access_code_global_guard
  before insert or update of access_code on future.volunteers
  for each row
  execute function future.volunteers_access_code_global_guard();

-- Service-role only: RLS enabled with NO policies. All app access goes through
-- the service client inside gated server actions; anon/authenticated get
-- nothing (volunteer rows carry access_code, which is a credential).
alter table future.volunteers enable row level security;

-- Table-level grant. Tables created via the Supabase Management API get NO
-- default grants for service_role (default privileges only cover the postgres
-- role), so without this every read silently returns empty / errors with
-- "permission denied for table volunteers".
grant select, insert, update, delete on future.volunteers to service_role;

-- ─── 2. BLOCKER A — second marker column on attendance ──────────────────────
alter table future.phase_event_attendance
  add column if not exists marked_by_volunteer_id uuid
    references future.volunteers(id) on delete set null;

create index if not exists idx_phase_event_attendance_marked_by_volunteer
  on future.phase_event_attendance (marked_by_volunteer_id)
  where marked_by_volunteer_id is not null;

-- Keep exactly one marker set, whichever write path touched the row last.
-- Runs BEFORE the CHECK constraint below, so the constraint can be declarative
-- without any write path having to know about the other one.
create or replace function future.phase_event_attendance_single_marker()
returns trigger
language plpgsql
as $$
begin
  if new.marked_by is not null and new.marked_by_volunteer_id is not null then
    -- OLD is referenced ONLY inside the UPDATE branch: PL/pgSQL does not
    -- guarantee short-circuit evaluation of AND, so a single combined
    -- condition could touch OLD during an INSERT.
    if tg_op = 'INSERT' then
      new.marked_by := null;
    elsif new.marked_by_volunteer_id is not distinct from old.marked_by_volunteer_id then
      -- An ADMIN write is claiming a row a volunteer marked earlier. The admin
      -- bulk upsert does not supply marked_by_volunteer_id, so the value we
      -- see is the OLD one — stale. Clear it; the admin is now the marker.
      new.marked_by_volunteer_id := null;
    else
      -- A VOLUNTEER write claims the row (this statement set the volunteer id).
      new.marked_by := null;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function future.phase_event_attendance_single_marker() from public;

drop trigger if exists trg_phase_event_attendance_single_marker
  on future.phase_event_attendance;
create trigger trg_phase_event_attendance_single_marker
  before insert or update on future.phase_event_attendance
  for each row
  execute function future.phase_event_attendance_single_marker();

-- Declarative invariant. Every one of the 1,483 rows that exist today has
-- marked_by set and marked_by_volunteer_id null, so this validates as-is.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'future.phase_event_attendance'::regclass
      and conname = 'phase_event_attendance_one_marker'
  ) then
    alter table future.phase_event_attendance
      add constraint phase_event_attendance_one_marker
      check (marked_by is null or marked_by_volunteer_id is null);
  end if;
end
$$;
