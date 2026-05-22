# Platform Unification Plan — yi-connect as the Umbrella

**Date drafted:** 2026-05-22
**Status:** Approved, not yet started
**Owner:** Director (omm) via Claude Code sessions
**Risk profile:** Low (yi-connect is not live; no production data to migrate)

---

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Q1 | Schema name for yi-connect tables in the shared DB | `yi_connect.*` |
| Q2 | Routing model | **Single Next.js app, multi-module monorepo** (`/dashboard`, `/yip`, `/yi-future`) |
| Q3 | Access control | Role-based via `yi_directory.role_assignments` |

---

## End state

```
                    ┌────────────────────────────────────┐
                    │   yi-connect (Next.js 16 app)      │
                    │                                    │
                    │   app/                             │
                    │     ├── dashboard/  (chapter mgmt) │
                    │     ├── yip/        (YIP module)   │
                    │     └── yi-future/  (delegates)    │
                    │                                    │
                    │   One auth. One deploy. One UI.    │
                    └─────────────────┬──────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │  Supabase: bkmpbcoxbjyafieabxao    │
                    │                                    │
                    │  public.*       = YIP tables       │
                    │  future.*       = YiFuture tables  │
                    │  yi_connect.*   = chapter mgmt     │
                    │  yi.chapters    = canonical list   │
                    │  yi_directory.* = shared identity  │
                    │  auth.users     = single login pool│
                    └────────────────────────────────────┘
```

Three apps disappear; one app replaces them. A chapter chair logs in once and sees everything they have access to. A student in YIP logs in and only sees YIP. The Director sees all three.

---

## Migration sequencing

Phases are ordered by dependency, not by who does them. All work happens in Claude Code sessions; the human is the decision-maker, not the implementer.

### Phase 0 — Prep & safety net

**Goal:** Make every step rollback-safe.

- [ ] Create branch `feat/platform-unification` off `main`
- [ ] Snapshot current yi-connect Supabase project `jxvbjpkypzedtrqewesc` (pg_dump or Supabase backup)
- [ ] Document current state of shared DB `bkmpbcoxbjyafieabxao`:
  - List all schemas (`public`, `future`, `yi`, `yi_directory`, etc.)
  - List all tables per schema
  - Note any existing `chapter_id` references
- [ ] Inventory yi-connect's 39 migrations and tag what they touch (tables, RLS, functions, seed)
- [ ] Verify YIP and YiFuture are still functional in shared DB (smoke test)

**Exit criteria:** A clean, documented starting point.

---

### Phase 1 — Database unification (`yi_connect.*` schema)

**Goal:** Lift all 39 migrations from `jxvbjpkypzedtrqewesc` → `bkmpbcoxbjyafieabxao` under the `yi_connect` schema.

- [ ] Create `yi_connect` schema in shared DB: `CREATE SCHEMA yi_connect;`
- [ ] Re-author each of the 39 migrations to qualify table names:
  - `CREATE TABLE members` → `CREATE TABLE yi_connect.members`
  - Foreign keys, indexes, triggers, RLS policies all updated
  - Functions moved to `yi_connect.fn_name()` where appropriate
- [ ] Replace `yi_connect.chapters` with shared `yi.chapters`:
  - Drop the per-app chapters table
  - Repoint every `chapter_id FK` to `yi.chapters(id)`
  - Backfill: insert Erode + EC team chapters into `yi.chapters` if not already there
- [ ] Apply migrations to shared DB via Supabase MCP (one migration at a time, verify each)
- [ ] Re-seed reference data:
  - Approved emails whitelist
  - Yi Erode schools, colleges, events
  - EC team 2025 emails
  - Demo chapter setup
- [ ] Verify row counts match between old project and new schema

**Exit criteria:** Every yi-connect table exists in `yi_connect.*` with policies, seeds, and FK integrity intact. Row counts match.

---

### Phase 2 — Directory plumbing (identity unification)

**Goal:** One person, one identity, across all three modules.

- [ ] Add `person_id UUID` column to `yi_connect.members` referencing `yi_directory.people(id)`
- [ ] Backfill: for each member, find or create the matching `yi_directory.people` row by email
- [ ] Install bidirectional sync trigger:
  - Member insert/update → upsert into `yi_directory.people`
  - Profile fields kept in sync (name, phone, etc.)
- [ ] Apply same pattern to any other "person-ish" tables in yi-connect:
  - Stakeholder CRM contacts (if they're also Yi members)
  - Trainers / facilitators
  - Award nominees and jury members
- [ ] Update RLS policies in `yi_connect.*` to use `yi_directory.role_assignments` for chapter-scoping where appropriate (replaces app-local role checks)

**Exit criteria:** Every yi-connect member has a `person_id`. New signups auto-create the `yi_directory.people` row. Role checks pull from `yi_directory.role_assignments`.

---

### Phase 3 — Code rewire in yi-connect

**Goal:** All yi-connect code reads from `yi_connect.*` instead of `public.*`.

- [ ] Update Supabase client setup to expose the `yi_connect` schema in TypeScript types
- [ ] Find/replace every Supabase query in yi-connect:
  - `.from("members")` → `.schema("yi_connect").from("members")`
  - Same for ~25 other tables
- [ ] Where code reads chapters: switch to `.schema("yi").from("chapters")`
- [ ] Regenerate TypeScript types from new schema (`supabase gen types`)
- [ ] Smoke-test every module page in dev:
  - Member Hub list + detail + create
  - Events list + create + RSVP
  - Finance dashboard + expense submit
  - Stakeholder CRM
  - All 11 modules

**Exit criteria:** yi-connect (still standalone) runs against the shared DB with zero functional regressions.

---

### Phase 4 — Monorepo merge (port YIP + YiFuture into yi-connect)

**Goal:** Three Next.js apps → one Next.js app.

#### 4.1 — Move YIP into yi-connect

- [ ] Copy YIP's `app/` → `yi-connect/app/yip/`
- [ ] Copy YIP's `components/` → `yi-connect/components/yip/`
- [ ] Copy YIP's `lib/` → `yi-connect/lib/yip/`
- [ ] Copy YIP's actions, hooks, types into namespaced subfolders
- [ ] Merge YIP's `package.json` deps into yi-connect's — resolve any version conflicts
- [ ] Update YIP's internal imports to new paths
- [ ] Update YIP's routes to be relative to `/yip` (e.g. `/dashboard` → `/yip/dashboard`)

#### 4.2 — Move YiFuture into yi-connect (same pattern)

- [ ] Copy YiFuture's `app/` → `yi-connect/app/yi-future/`
- [ ] Same for components, lib, actions
- [ ] Merge deps
- [ ] Update internal paths and routes

#### 4.3 — Reconcile shared concerns

- [ ] Single Supabase client used by all three modules (just different `.schema()` calls)
- [ ] Single env file with all keys
- [ ] Resolve any name collisions in `components/ui/` (yi-connect, YIP, YiFuture all use shadcn — should be fine but verify)
- [ ] Deduplicate shared utility functions (`cn`, `formatDate`, etc.)

**Exit criteria:** One Next.js app builds and runs locally. `/dashboard` shows yi-connect chapter mgmt. `/yip/*` works. `/yi-future/*` works. No console errors.

---

### Phase 5 — Auth + role-based access gate

**Goal:** Single login. Role determines which modules a user sees.

- [ ] yi-connect's OAuth + email whitelist becomes the single auth entry point
- [ ] On login, query `yi_directory.role_assignments` for the user's roles
- [ ] Compute `accessible_modules` set:
  - `chapter_chair`, `ec_member`, `director` → all three modules
  - `delegate` → `/yi-future` only
  - `participant`, `student` → `/yip` only
  - Future roles configurable in `yi_directory.role_definitions`
- [ ] Middleware (`middleware.ts`) enforces route access:
  - User hits `/yip/*` without YIP access → redirect to 403
  - Same for `/yi-future/*` and `/dashboard/*`
- [ ] Build a `useAccessibleModules()` hook for UI gating (nav items, dashboard tiles)

**Exit criteria:** A test student account can only see `/yip`. A test chapter chair can see everything. The Director account sees everything. 403 page works.

---

### Phase 6 — Shared shell (unified UX)

**Goal:** Make it feel like one product, not three glued together.

- [ ] Top nav with module switcher: `Chapter | YIP | YiFuture` (only modules the user has access to)
- [ ] `/` (root) → unified dashboard with tiles for each accessible module
- [ ] Shared user menu (profile, sign out, switch chapter if multi-chapter user)
- [ ] Shared notification system (single bell, all three modules pipe in)
- [ ] Consistent header/footer across all routes
- [ ] Each module keeps its own internal sub-navigation under its route segment

**Exit criteria:** Logging in lands on a dashboard that shows what you have access to. Switching between modules feels instant (client-side nav). Branding is consistent.

---

### Phase 7 — Cutover

**Goal:** Make the unified app the real thing.

- [ ] Update yi-connect's `.env.local` → point at `bkmpbcoxbjyafieabxao`
- [ ] Update Vercel env vars (production + preview)
- [ ] Final smoke test: every flow, every role
- [ ] Set up redirects:
  - Old YIP standalone deploy → `yi-connect.app/yip`
  - Old YiFuture deploy → `yi-connect.app/yi-future`
- [ ] Announce internally (Director, EC, chapter chairs) before public launch
- [ ] 2-week safety window: keep `jxvbjpkypzedtrqewesc` (old yi-connect Supabase) paused but not deleted
- [ ] After 2 weeks of clean operation: decommission old project, archive old standalone deploys

**Exit criteria:** One URL. One login. One DB. Three modules visible based on role. Old infra decommissioned.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration script errors during schema lift | Medium | Low (no live data) | Apply one migration at a time via MCP; verify row counts |
| Dependency version conflicts in monorepo merge | High | Medium | Resolve per package; pin React 19 + Next 16 across all three |
| Auth race conditions when role_assignments is empty for new signup | Medium | Medium | Auto-create a `participant` role on first signup as fallback |
| RLS policy gaps after schema move | High | High | Test each role × each module flow before cutover. Use `silent-failure-auditor` skill. |
| `yi.chapters` missing a chapter that yi-connect needs | Low | Medium | Phase 1 backfills all yi-connect chapters into `yi.chapters` |
| Director account losing access mid-migration | Low | High | Hardcode director email in middleware as super-admin fallback (already exists per migration 20251110110000) |

---

## Rollback

Since nothing is live, rollback per phase is simple:

- **Phase 1 fail:** `DROP SCHEMA yi_connect CASCADE` in shared DB. yi-connect still points at old project, unaffected.
- **Phase 3 fail:** Revert code branch. Re-point `.env.local` at old project.
- **Phase 4 fail:** Revert merge commits. Three apps still exist independently.
- **Phase 7 fail:** Re-point env vars back at old project. Re-enable old standalone deploys.

The `feat/platform-unification` branch is the single rollback unit. No work touches `main` until Phase 7 is verified.

---

## Estimated effort

These are working estimates for Claude Code sessions, not human calendar time:

| Phase | Effort | Notes |
|---|---|---|
| 0 — Prep | 1 session | Branch, snapshot, inventory |
| 1 — DB unification | 3-4 sessions | 39 migrations × re-author + apply + verify |
| 2 — Directory plumbing | 2 sessions | Backfill is the slow part |
| 3 — Code rewire | 2 sessions | Mostly mechanical find/replace + smoke test |
| 4 — Monorepo merge | 4-5 sessions | The biggest phase. Dep conflicts will eat time. |
| 5 — Auth + role gate | 2 sessions | Already have OAuth, just adding role layer |
| 6 — Shared shell | 2 sessions | Nav, dashboard, switcher |
| 7 — Cutover | 1 session | Smoke test + flip env vars |
| **Total** | **~17-19 sessions** | Spread across as many days as the Director chooses |

---

## What gets reused vs. rebuilt

| Existing asset | Action |
|---|---|
| yi-connect's 11 modules | **Reuse as-is**, just schema-qualified |
| yi-connect's OAuth + email whitelist | **Reuse**, extend with role gate |
| YIP standalone codebase | **Lift into `/app/yip/`** as-is, re-namespace |
| YiFuture standalone codebase | **Lift into `/app/yi-future/`** as-is, re-namespace |
| `yi.chapters` (shared) | **Reuse** — replaces yi-connect's `public.chapters` |
| `yi_directory.people` + `role_assignments` | **Reuse** — becomes the single identity + access source |
| 3 separate Supabase projects | **Collapse to 1** (`bkmpbcoxbjyafieabxao`) |
| 3 separate Vercel deploys | **Collapse to 1** (yi-connect.app) |

---

## Open questions to resolve before starting

1. **Domain:** Final URL for the unified platform? `yi-connect.app`? `connect.yi.in`? Custom?
2. **Brand:** Do YIP and YiFuture keep their visual identities inside the unified shell, or fully adopt yi-connect's design system?
3. **Multi-chapter users:** Some Directors and EC members will belong to multiple chapters. Confirm `role_assignments` supports `chapter_id` per row (it should — verify in Phase 0).
4. **Existing YIP/YiFuture users:** Do they need an email about the platform consolidation, or is the redirect enough?

---

*Plan written by Claude Code session on 2026-05-22. Updates should be made directly to this file as phases complete.*
