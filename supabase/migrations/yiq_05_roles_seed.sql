-- =====================================================================
-- yiq_05_roles_seed — the MINIMUM viable YIQ role set.
--
-- YIQ roles are rows in yi_directory.role_assignments with app='yiq'.
-- There is no yiq.organisers table and there must never be one: per
-- CLAUDE.md, yi_directory.people + yi_directory.role_assignments is the
-- mother source for every Yi person and every role they hold. A parallel
-- per-vertical auth table is exactly the drift this platform already paid
-- for once.
--
-- WHAT THIS SEEDS, AND WHY IT IS SO SMALL
-- --------------------------------------------------------------------
-- Exactly one thing: it makes the YIQ national console REACHABLE, by
-- giving app='yiq' role='yiq_super_admin' to whoever already holds the
-- platform super-admin role. Nothing is invented — every row is derived
-- from a person who is already in the directory today.
--
-- Verified read-only against production on 2026-08-24, before writing
-- this file:
--   * yi_directory.role_assignments holds ZERO app='yiq' rows.
--   * 1 active platform_super_admin (app='platform'), 0 legacy 'super_admin'.
--   * 65 active app='yi' chapter_chair + 2 chapter_co_chair rows.
--
-- WHAT IS DELIBERATELY *NOT* SEEDED
-- --------------------------------------------------------------------
-- 1. CHAPTER CHAIRS. A Yi directory chapter_chair / chapter_co_chair is
--    ALREADY the YIQ chapter chair — lib/yiq/auth/event-access.ts tier 3b
--    grants chapter_admin off the app='yi' row directly, because the Yi
--    directory is the source of truth for who chairs a chapter. Creating
--    67 duplicate app='yiq' role='chapter_admin' rows would grant nothing
--    new and would immediately start drifting the day a chair changes.
--    Chairs need no seeding. Ever.
--
-- 2. CHAPTER ORGANISERS. Nobody has been named yet, and inventing people
--    or email addresses is not this migration's job. They are granted
--    through /yiq/admin/team, which writes the same table.
--
-- 3. REGIONAL ADMINS. Same reason — the 6 zone leads for YIQ are a
--    Director decision, not something derivable from existing rows. YIP's
--    6 regional_admins are NOT auto-projected onto YIQ: a different
--    vertical's zone lead is not automatically this vertical's.
--
-- 4. YIP / Yi-Future NATIONALS. Holding yip_super_admin does not make
--    someone a YIQ national admin. That is a policy call for the
--    Director, made in the console, not assumed here.
--
-- IDEMPOTENT: safe to re-run. The NOT EXISTS guard matches the live
-- unique index uq_role_assignment_scope
-- (person_id, app, role, coalesce(yi_chapter,''), yi_year), and the bare
-- ON CONFLICT DO NOTHING covers a concurrent second run.
-- =====================================================================

insert into yi_directory.role_assignments
  (person_id, app, role, yi_year, yi_chapter, yi_zone, title, is_active, is_primary)
select distinct
  ra.person_id,
  'yiq',
  'yiq_super_admin',
  ra.yi_year,          -- mirror the source row's Yi year; never assume one
  null,                -- national: no chapter scope
  null,                -- national: no zone scope
  'YIQ National admin',
  true,
  false
from yi_directory.role_assignments ra
join yi_directory.people p on p.id = ra.person_id
where ra.is_active is true
  -- Both names the code accepts as platform tier — see PLATFORM_SUPER_ROLES
  -- in lib/yi/auth/yi-directory-roles.ts. 'super_admin' is the legacy name
  -- kept alive through the rename window; there are 0 such rows today, but
  -- matching the code means this migration cannot silently miss one.
  and ra.role in ('platform_super_admin', 'super_admin')
  -- Fail closed: a deactivated person holds no effective roles
  -- (getCurrentPersonRoles returns null for them), so seeding one would
  -- create a row that reads as access and grants none.
  and p.is_active is not false
  and not exists (
    select 1
    from yi_directory.role_assignments existing
    where existing.person_id = ra.person_id
      and existing.app = 'yiq'
      and existing.role = 'yiq_super_admin'
      and coalesce(existing.yi_chapter, '') = ''
      and existing.yi_year = ra.yi_year
  )
on conflict do nothing;

-- Verification — returns the YIQ role set as it now stands. Expect one
-- yiq_super_admin row per platform super-admin, and nothing else: chapter
-- chairs are resolved live from app='yi' and must NOT appear here.
select
  ra.role,
  ra.yi_year,
  coalesce(ra.yi_chapter, ra.yi_zone, '(national)') as scope,
  p.full_name,
  ra.is_active
from yi_directory.role_assignments ra
join yi_directory.people p on p.id = ra.person_id
where ra.app = 'yiq'
order by ra.role, scope, p.full_name;
