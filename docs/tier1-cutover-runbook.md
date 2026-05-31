# Tier-1 Cutover Runbook — `yip.organizers` → `yi_directory`

**Status:** NOT auto-applied. This is a COUPLED write-direction flip. Each phase
changes both code AND data shape; applying them out of order, or applying the
SQL before the code that depends on it, will silently drop writes (the classic
"Server Action returns 200 but the row never lands" failure).

**Scope:** Phases 2 → 5 of the `yi_directory` consolidation. Phase 0 (read gates)
and Phase 1 (chapter-role assignment writes `yi_directory.role_assignments`
directly) already shipped. The READ side already converged:

- `lib/yi/auth/yi-directory-roles.ts` — `getCurrentPersonRoles()` reads
  `yi_directory.people` + `role_assignments` only.
- `lib/yip/auth/require-super-admin.ts` — the gate no longer touches
  `yip.organizers` at all (the `organizerId` field now carries `person_id`).
- `app/yip/actions/admin-team.ts` — identity enrichment now reads
  `yi_directory.people` (was the non-existent `contestants` table).

What remains is the WRITE side: three writers still INSERT/UPDATE
`yip.organizers` as a source of truth, and `yip.events.chapter_em_id` still
FK-references `yip.organizers(id)` instead of `yi_directory.people(id)`.

---

## Golden rules (read before touching anything)

1. **Code before SQL, never SQL before code.** Repoint the writer to
   `yi_directory` FIRST, deploy, verify a real write lands, THEN run the data
   migration. If you drop the column before the code stops reading it, every
   affected page 500s.
2. **Snapshot first.** Every phase below assumes a fresh DB snapshot exists.
   Take one (`pg_dump` or a Supabase point-in-time restore marker) and record
   its ID in the deploy ticket before step 1 of each phase.
3. **One phase per deploy.** Do not batch phases. Each phase has its own
   verify + rollback. The DROP COLUMN in Phase 3 is irreversible without the
   snapshot.
4. **Director approval gate.** Phases 3 and 4 are irreversible (column drop,
   table → view). Get explicit Director sign-off in the ticket before running
   the `DRAFT_*.sql` files.

---

## Phase 2 — Repoint the three organizers writers to `yi_directory`

Goal: stop treating `yip.organizers` as a source of truth on the write side.
After this phase, every onboarding/promotion path INSERTs into `yi_directory`
first; `yip.organizers` rows are only ever written by the sync trigger (which
Phase 4 will replace with a view).

This phase is CODE-ONLY. No SQL. It can be rolled back by a single revert.

### 2a. `app/yip/actions/admin-team.ts` — create / update

- **Current:** `adminCreateMember` / `adminUpdateMember` INSERT/UPDATE
  `yip.organizers` directly (`.from("organizers").insert(...)`).
- **Change:** route the create through the same `ensurePerson()` +
  `role_assignments` insert pattern that `app/yip/actions/chapter-roles.ts`
  already uses (find-or-create `yi_directory.people`, then upsert a
  `role_assignments` row with `app='yip'`, `role`, `yi_chapter`, `yi_zone`).
  `adminUpdateMember` updates `yi_directory.people` (name/email/photo) and the
  matching `role_assignments` row (role/zone/chapter), NOT `yip.organizers`.
- **Keep stable:** the `TeamMember` return shape and the
  `revalidatePath("/yip/dashboard/admin/team")` calls.
- **Verify:**
  ```bash
  # In the running app, create a member via /yip/dashboard/admin/team,
  # then confirm the row landed in yi_directory, not just organizers:
  #   SELECT * FROM yi_directory.people WHERE email = '<new>';
  #   SELECT * FROM yi_directory.role_assignments
  #     WHERE person_id = '<id>' AND app = 'yip';
  # adminListTeam should show the new member with the correct yi_year.
  ```
- **Rollback:** `git revert` the commit. Data written to `yi_directory` is
  additive and harmless; the sync trigger keeps `organizers` populated.

### 2b. `app/yip/actions/admin-chapter-admins.ts` — insert (lines ~122, ~184, ~238)

- **Current:** creates an auth user, then `svc.from("organizers").insert({...})`
  as the chapter-admin record of record.
- **Change:** insert into `yi_directory.people` + `role_assignments`
  (`role='chapter_admin'`, scoped by `yi_chapter`). Mirror the
  `ensurePerson` + role-upsert flow from `chapter-roles.ts`. The auth-user
  creation + rollback-on-failure logic stays.
- **Verify:** create a chapter admin via the admin UI; confirm a
  `role_assignments` row with `role='chapter_admin'` and the right
  `yi_chapter` exists; confirm `requireSuperAdmin()` / event-access gate sees
  the new admin.
- **Rollback:** `git revert`. The `organizers` row will simply not be created
  by the app; the sync trigger backfills it from the new `role_assignments`.

### 2c. `app/yip/actions/hierarchy.ts` — link + chapter_em assignment (lines ~63, ~78–81, ~112)

- **Current:** updates `organizers.user_id/email` (line ~63) and sets
  `events.chapter_em_id` to an `organizers.id` (line ~78–81).
- **Change:** the user-link update targets `yi_directory.people.user_id`. The
  `chapter_em` assignment is deferred to Phase 3 (it depends on the new
  `events.chapter_em_person_id` column). In THIS phase, leave
  `chapter_em_id` writes pointing at `organizers.id` — do not change the FK
  target until Phase 3's column exists. Only the people-link half moves here.
- **Verify:** link a user via the hierarchy UI; confirm
  `yi_directory.people.user_id` updated for that person.
- **Rollback:** `git revert`.

**Phase 2 exit criteria:** all three writers create/update `yi_directory` rows.
`yip.organizers` is now write-only via the sync trigger. No reader anywhere
treats `organizers` as source of truth. Confirm with:
```bash
grep -rn '.from("organizers")' app/yip --include="*.ts" | grep -iE "insert|update"
# Expected after Phase 2: only sync-trigger-equivalent paths, no app writers.
```

---

## Phase 3 — Events FK migration: `chapter_em_id` → `chapter_em_person_id`

Goal: `yip.events` references `yi_directory.people(id)` directly instead of
hopping through `yip.organizers(id)`.

File: `supabase/migrations/DRAFT_phase3_events_chapter_em_person_id.sql`
(filename starts with `DRAFT_` so `supabase db push` skips it — it must be run
by hand after approval).

### 3a. CODE FIRST

- Update `app/yip/actions/hierarchy.ts` line ~78–81 to write
  `events.chapter_em_person_id` (a `yi_directory.people.id`) instead of
  `chapter_em_id`. Resolve the selected person to their `people.id` via the
  same lookup `chapter-roles.ts` uses.
- Update any reader that joins `events.chapter_em_id → organizers` to instead
  join `events.chapter_em_person_id → yi_directory.people`. Find them:
  ```bash
  grep -rn "chapter_em_id" app/yip --include="*.ts"
  ```
- Deploy. The new column does not exist yet, so this code must tolerate it
  being null until 3b runs — gate the write behind a feature flag OR run 3b's
  ADD COLUMN + BACKFILL in the same maintenance window, code deployed first.

### 3b. DATA — run `DRAFT_phase3_events_chapter_em_person_id.sql`

The migration: `ADD COLUMN chapter_em_person_id uuid REFERENCES
yi_directory.people(id)`, then BACKFILL it from the existing
`events.chapter_em_id → organizers.person_id` mapping. The `DROP COLUMN
chapter_em_id` statement is present but **commented out** — do NOT drop the old
column in the same window. Run only ADD + BACKFILL first.

- **Verify (backfill correctness):**
  ```sql
  -- Every event that had a chapter_em should now have a person_id, and it
  -- should match the organizer's person_id. This must return ZERO rows:
  SELECT e.id, e.chapter_em_id, e.chapter_em_person_id, o.person_id
  FROM yip.events e
  JOIN yip.organizers o ON o.id = e.chapter_em_id
  WHERE e.chapter_em_id IS NOT NULL
    AND e.chapter_em_person_id IS DISTINCT FROM o.person_id;
  ```
- **Rollback (before DROP):** `ALTER TABLE yip.events DROP COLUMN
  chapter_em_person_id;` — safe and reversible because the old column is
  untouched.

### 3c. DROP the old column (separate, later window — IRREVERSIBLE)

Only after the app has run on `chapter_em_person_id` for at least one full
release cycle with zero errors: uncomment the `DROP COLUMN chapter_em_id` line
and run it. **Rollback after this point requires the DB snapshot.** Get Director
sign-off in the ticket.

---

## Phase 4 — `yip.organizers` table → view over `yi_directory`

Goal: make `yip.organizers` a read-only VIEW so it can never drift from
`yi_directory` again. This is the point of no return for the table shape.

File: `supabase/migrations/DRAFT_phase4_organizers_to_view.sql`.

**Pre-flight (must all be true before running):**
- Phase 2 complete: no app code INSERTs/UPDATEs `yip.organizers`.
- Phase 3 complete through 3b: `events.chapter_em_id` no longer read by app.
- Every remaining `.from("organizers").select(...)` is a pure read whose
  columns are all reproducible from the view. Confirm:
  ```bash
  grep -rn '.from("organizers")' app/yip lib/yip --include="*.ts"
  ```

### 4a. Run `DRAFT_phase4_organizers_to_view.sql`

The migration `DROP`s the sync triggers (`trg_yip_organizers_sync_write`,
`trg_yip_organizers_sync_delete`) and the `yi_directory.sync_from_organizer_profile`
function, renames the old base table out of the way, then
`CREATE OR REPLACE VIEW yip.organizers AS SELECT … FROM yi_directory.people p
JOIN yi_directory.role_assignments ra ON ra.person_id = p.id WHERE ra.app='yip'`.

- **Verify (parity):**
  ```sql
  -- Row count and key columns from the view should match what the app expects.
  SELECT count(*) FROM yip.organizers;          -- via the new view
  SELECT id, full_name, email, role, person_id  -- spot-check a few rows
  FROM yip.organizers LIMIT 20;
  ```
  Then click through `/yip/dashboard/admin/team` and the hierarchy UI — every
  reader must still render.
- **Rollback:** restore the renamed base table (`ALTER TABLE
  yip.organizers_old RENAME TO organizers;`), recreate the two triggers and the
  sync function from the snapshot's DDL. This is why the base table is RENAMED,
  not dropped, in the migration. Keep `organizers_old` for one release before
  dropping it.

---

## Phase 5 — Drift-detection tooling

Goal: a scheduled check that asserts `yip.organizers` (the view) and
`yi_directory` agree, so any future regression is caught loudly, not silently.

- **Change:** add a small admin diagnostic (server action or cron route) that
  counts mismatches between active `role_assignments WHERE app='yip'` and the
  rows the view produces, and surfaces a non-zero count in the admin UI /
  Vercel logs. Pattern: same `logGateVerdict`-style single-line JSON tag used
  in `require-super-admin.ts` so it is greppable.
- **Verify:** seed a deliberate mismatch in staging (e.g. deactivate a
  `role_assignments` row out of band), confirm the check reports it, then
  revert.
- **Rollback:** remove the diagnostic. It is read-only, so removal is safe.

---

## Quick reference — file → phase

| File | Phase | Type |
|------|-------|------|
| `app/yip/actions/admin-team.ts` (create/update) | 2a | code |
| `app/yip/actions/admin-chapter-admins.ts` (insert) | 2b | code |
| `app/yip/actions/hierarchy.ts` (user link) | 2c | code |
| `app/yip/actions/hierarchy.ts` (chapter_em write) | 3a | code |
| `DRAFT_phase3_events_chapter_em_person_id.sql` | 3b/3c | SQL (manual) |
| `DRAFT_phase4_organizers_to_view.sql` | 4a | SQL (manual) |
| drift-detection diagnostic | 5 | code |

**Reminder:** the two `DRAFT_*.sql` files are intentionally named with a
`DRAFT_` prefix instead of a timestamp so `supabase db push` SKIPS them. They
are run by hand, against a snapshot, with Director approval — never via the
normal migration pipeline.
