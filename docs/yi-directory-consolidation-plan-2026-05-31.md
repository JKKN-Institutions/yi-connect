# yi_directory Consolidation Plan — single identity + permission spine

**Date:** 2026-05-31
**Author:** drafted with Claude (Director review pending)
**Status:** PROPOSAL — no code/DDL applied yet
**Decision being made:** Retire `yip.organizers` (and later `future.*` role tables) as sources of truth; make `yi_directory` the single identity + role-assignment store for every app in the monorepo; add a permission-policy layer on top.

---

## 0. Why (one paragraph)

Today the platform has **two sources of truth** for "who is what": the per-vertical tables (`yip.organizers`, `future.chapter_core_team`) and `yi_directory`. They are bridged by a **non-idempotent DB trigger** (`yi_directory.sync_from_organizer_profile`) that creates duplicate `people` rows whenever an organizer has no email/user_id. They have **already drifted**: `yip.organizers` knows roles `{chapter_em, national, rm}`; `yi_directory` additionally has `regional_admin` (6 rows) that organizers never had. Two writable sources + glue trigger = guaranteed drift. The fix is to make `yi_directory` the only write target and demote the vertical tables to read-only projections.

---

## 1. Current state (verified 2026-05-31)

### Data
- `yi_directory.people`: 98 rows (12 are duplicate person rows for 6 humans — see dedup note).
- `yi_directory.role_assignments`: 99 rows. `app='yip'` roles: rm(12, incl. dupes), regional_admin(6), national(3), chapter_em(1).
- `yip.organizers`: 10 rows, all active, roles `{chapter_em, national, rm}`. **No `regional_admin`** → already diverged from yi_directory.

### The sync (the bug class)
- `yip.organizers` triggers: `trg_yip_organizers_sync_write` (BEFORE INSERT/UPDATE) and `trg_yip_organizers_sync_delete` (AFTER DELETE) → `yi_directory.sync_from_organizer_profile()`.
- The function matches an existing person by **email** then **user_id**, then INSERTs. It never checks `source_yip_profile_id`, so emailless + unlinked organizers duplicate on every sync. Role upsert inside the function IS idempotent (`ON CONFLICT … DO UPDATE`).

### The hard constraint
- **Exactly one** FK references `yip.organizers`: `yip.events.chapter_em_id → yip.organizers.id` (`events_chapter_em_id_fkey`). A Postgres view cannot be an FK target, so this FK decides whether `organizers` can become a true view or must stay a derived table.

### The 11 `yip.organizers` call sites (status)
| # | File | Uses organizers for | Migration action |
|---|------|---------------------|------------------|
| 1 | `lib/yip/auth/require-super-admin.ts` | ✅ already reads yi_directory; only a vestigial unread `organizerId` field hits organizers | **Drop the dead field** |
| 2 | `app/yip/actions/chapter-roles.ts` | ✅ already writes yi_directory.role_assignments | none (reference impl) |
| 3 | `app/yip/actions/admin-team.ts` | ❌ CRUD write-path → organizers (fires the sync) | **Repoint writes to yi_directory** |
| 4 | `app/yip/actions/admin-chapter-admins.ts` | ❌ dual-writes (yi_directory + organizers insert) | **Drop the organizers insert** |
| 5 | `app/yip/actions/hierarchy.ts` | ❌ reads organizer lists + links user | **Read view / write yi_directory** |
| 6 | `app/yip/actions/mock-data.ts` | dev seeding only | low priority |
| 7 | `lib/yip/audit/log-action.ts` | actor lookup | repoint to yi_directory person |
| 8-10 | `app/admin/directory/sync-status/*` (3 files) | drift detector organizers↔yi_directory | **Becomes moot** (delete once organizers is a projection) |
| 11 | `lib/yi/auth/yi-directory-roles.ts` | comment reference only | none |

**Reality:** the "11 sites" is really ~5 that do live work (3,4,5,7 + the events FK). Auth is already largely migrated.

---

## 2. Target architecture

```
            ┌─────────────────────────────────────────────┐
  TIER 1    │  yi_directory.people  +  role_assignments    │  ← single identity + role source
  identity  │  (app = yip | future | yuva | thalir | …)    │
            └─────────────────────────────────────────────┘
                     │ read                    ▲ write (the ONLY write path)
                     ▼                         │
            ┌──────────────────┐      ┌─────────────────────┐
  TIER 2    │ role_permissions │      │ admin UIs (all apps)│
  policy    │ (app,role)→caps  │      │ write yi_directory  │
            └──────────────────┘      └─────────────────────┘
                     │ can(user,app,capability)
                     ▼
            every page / server action gate
```

- `yip.organizers`, `future.chapter_core_team` → **read-only projections** (view or derived cache) of `yi_directory`, never written directly.
- One gate `can(user, app, capability)` replaces scattered bespoke checks.

---

## 3. Tier 1 — make yi_directory the only identity/role source

### Phase 0 — Stop the bleed (do FIRST, independent of everything else)
Make the existing sync idempotent so duplicates quit regenerating. One-line fix to `sync_from_organizer_profile()`:
```sql
-- add BEFORE the "IF v_person_id IS NULL THEN INSERT":
IF v_person_id IS NULL THEN
  SELECT id INTO v_person_id FROM yi_directory.people WHERE source_yip_profile_id = NEW.id;
END IF;
```
**Verify:** update an emailless organizer twice → still one `people` row.

### Phase 1 — Dedup the 6 duplicated humans
(Now safe because Phase 0 stopped regeneration.) Re-point one `rm` role + backfill source onto each canonical auth row, delete the duplicate synced rows. Target: people 98→86, roles 99→92. (Draft migration `20260531080000_*` exists; rework it post-Phase-0 so deletes don't retrigger the sync.)

### Phase 2 — Repoint the organizers WRITE-path to yi_directory
- `admin-team.ts` create/update/archive/link → write `yi_directory.people` + `role_assignments(app='yip')` (mirror the already-correct `chapter-roles.ts`).
- `admin-chapter-admins.ts` → delete the step-5 `organizers.insert`.
- `hierarchy.ts` `linkCurrentUserToProfile` → set `yi_directory.people.user_id`.
- `log-action.ts` actor → yi_directory person.
**Invariant after Phase 2:** no app code writes `yip.organizers`.

### Phase 3 — Resolve the `events.chapter_em_id` FK (the one blocker)
Two options:
- **3a (clean):** add `yip.events.chapter_em_person_id uuid → yi_directory.people.id`; backfill from the current organizer→person mapping; drop `chapter_em_id`. Update event code (`hierarchy.setEventZone`, allocation, event reads) to use the person ref.
- **3b (pragmatic fallback):** keep `yip.organizers` as a **derived table** (not a view), FK preserved, but **flip the trigger** so `yi_directory → organizers` (organizers becomes the cache, refreshed from yi_directory; never written by app code).
**Recommendation:** 3a if event code coupling is light (it looks light — one column), else 3b. Decide after reading `yip/actions/events.ts` + `allocation.ts`.

### Phase 4 — Demote organizers + delete the sync trigger
- If 3a: `CREATE VIEW yip.organizers AS SELECT … FROM yi_directory.people p JOIN role_assignments ra ON … WHERE ra.app='yip'`. Drop the base table + both sync triggers + `sync_from_organizer_profile`.
- If 3b: keep table, replace the two organizer-side triggers with a single `yi_directory → organizers` refresh trigger.
**Verify:** every YIP admin screen still renders; `requireSuperAdmin` still allows the right users; no 403 regressions.

### Phase 5 — Remove drift tooling
Delete `app/admin/directory/sync-status/*` + `sync-status.ts` — drift is structurally impossible once organizers is a projection.

---

## 4. Tier 2 — permission-policy layer (the "control all page permissions" part)

`yi_directory` answers *who-is-what*, not *what-each-role-can-do*. Today permissions are hardcoded across ~40 action files + per-app `_guard.ts`. To centralize:

```sql
CREATE TABLE yi_directory.role_permissions (
  app text NOT NULL,            -- yip | future | yuva | …  (or '*' = all apps)
  role text NOT NULL,           -- chapter_chair | rm | national | super_admin | …
  capability text NOT NULL,     -- e.g. 'event.delete', 'directory.read', 'team.manage'
  PRIMARY KEY (app, role, capability)
);
```
One gate, used everywhere:
```ts
// lib/yi/auth/can.ts
export async function can(capability: string, app: string): Promise<boolean> { … }
// reads getCurrentPersonRoles() → role_permissions
```
Migration is incremental: introduce `can()`, convert gates file-by-file, keep the old check until each is moved. **No big-bang.**

---

## 5. Tier 3 — generalize

`future.chapter_core_team` gets the same treatment (it already has a twin `sync_from_chapter_core_team`). New verticals (Yuva, Thalir, Masoom) **never** create their own `organizers` table — they write `yi_directory.role_assignments WHERE app='<vertical>'` and read Tier-1 + Tier-2. Enforce via the existing CLAUDE.md rule + code review.

---

## 6. Rollback

- Phase 0: `CREATE OR REPLACE` the function back to its previous body (kept in this doc / migration history).
- Phase 1: restore from `backups/yd_*_2026-05-31.json`.
- Phases 2-4: each is a normal PR; revert the PR. Keep `yip.organizers` base table until Phase 4 is proven in production for ≥1 week (don't drop-and-pray).
- DB snapshot before Phase 3/4 (the irreversible structural ones).

## 7. Risk register

| Risk | Mitigation |
|------|------------|
| Dropping organizers breaks an unseen reader | grep gate at end of Phase 2; keep base table 1 week behind the view |
| events FK migration loses chapter_em links | backfill + row-count assert before dropping `chapter_em_id` |
| Tier 2 lockout (someone loses access mid-migration) | `can()` defaults to existing check until a capability is explicitly seeded; super_admin bypass |
| MCP/Management-API can't run multi-statement txns reliably (seen today) | apply via real `psql`/`supabase db push`, or step-wise autocommit with per-step verification |

## 8. Sequencing recommendation

1. **Phase 0 now** (stop the bleed) — low risk, unblocks everything.
2. Phase 1 dedup — data hygiene.
3. Phases 2→5 as one focused branch (Tier 1).
4. Tier 2 as a separate incremental track.
5. Tier 3 opportunistically per new vertical.

Phase 0 is the only thing safe to do today without further review.
