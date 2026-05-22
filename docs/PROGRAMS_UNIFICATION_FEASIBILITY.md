# Programs Unification — Feasibility Assessment

**Date:** 2026-05-22
**Status:** Reconnaissance complete
**Owner:** Director (omm)

---

## Ground truth (verified, not assumed)

After reading both YIP and YiFuture source trees and migration history:

| Fact | Evidence |
|---|---|
| YIP and YiFuture share Supabase project `bkmpbcoxbjyafieabxao` | Both .env.local files |
| Migrations 001-021 are byte-identical between YIP and YiFuture | `diff` returned empty for 001 and 019 |
| YIP forked from common ancestor, then diverged with 5 unique migrations | YIP has 26 total; 022-026 are YIP-only |
| YiFuture diverged with 36 unique migrations (101-135) in `future.*` schema | All 100-series in future namespace |
| `yi_directory.people` (cross-app identity) exists, authored by YIP | Migration 023 |
| `yi.chapters` (canonical chapter list) exists, authored by YiFuture | Migration 128 |
| `yi.national_admins` (national-level access allow-list) exists | YiFuture migration 131; includes director@jkkn.ac.in |
| YiFuture's `future.*` tables do NOT yet link to `yi_directory.people` | `grep yi_directory` in YiFuture migrations = empty |

## What this means

The cross-app identity layer is **half-built and unevenly adopted**:

- ✅ `yi_directory.people` table exists, ready to use
- ✅ `yi.chapters` table exists, ready to use
- ✅ `yi.national_admins` gating exists, ready to use
- ❌ YiFuture hasn't actually wired its tables to use `yi_directory.people` yet
- ❌ yi-connect doesn't know any of this exists (it's on a different Supabase project)

So the architectural work isn't "build a unified platform from three things." It's **"finish the cross-app identity work YIP started, and bring yi-connect into the existing shared DB."** That's much smaller scope than my earlier estimates.

## Revised architectural target (replaces earlier mental model)

```
                ┌─────────────────────────────────────────────────┐
                │   Shared Supabase: bkmpbcoxbjyafieabxao         │
                │                                                 │
                │   yi.chapters         (canonical chapter list)  │
                │   yi.national_admins  (national access gate)    │
                │   yi_directory.people (cross-app identity)      │
                │   yi_directory.role_assignments (Q1 decision)   │
                │                                                 │
                │   public.*    (YIP — mock parliament)           │
                │   future.*    (YiFuture — 90-day program)       │
                │   yi_connect.* (NEW — chapter management)       │
                └─────────────────────────────────────────────────┘
                         ▲              ▲              ▲
                         │              │              │
                  ┌──────┴───┐   ┌──────┴────┐   ┌────┴──────┐
                  │   YIP    │   │ YiFuture  │   │ yi-connect│
                  │ app/yip  │   │app/yi-fut │   │ app/      │
                  │          │   │           │   │           │
                  │ Forked   │   │ Forked    │   │ Original  │
                  │ codebase │   │ codebase  │   │ codebase  │
                  └──────────┘   └───────────┘   └───────────┘
```

**Three apps. One DB. One identity layer.** That's the realistic 2-month target.

Long-term codebase merge (YIP + YiFuture → one `programs` platform) is deferred to Phase 3, after the wedge proves out. Merging them now is a 4-6 week refactor with high risk and low immediate value.

## Revised phasing (replaces docs/UNIFICATION_PLAN.md)

### Phase A — yi-connect joins the shared DB (this is the urgent move)

| Step | Effort |
|---|---|
| Create `yi_connect.*` schema in `bkmpbcoxbjyafieabxao` | 1 session |
| Lift 39 yi-connect migrations, schema-qualified to `yi_connect.*` | 3-4 sessions |
| Replace yi-connect's `public.chapters` with FK to `yi.chapters` | 1 session |
| Add `person_id` to yi-connect's `members` → `yi_directory.people` | 1 session |
| Backfill: ensure Erode + EC chapters in `yi.chapters`; people in `yi_directory.people` | 1 session |
| Re-point yi-connect's .env.local to shared project | trivial |
| Smoke-test all 11 yi-connect modules | 1 session |

**Phase A total:** ~7-8 sessions. Output: yi-connect lives in the shared DB, ready for SSO with YIP and YiFuture.

### Phase B — Wire YiFuture to use yi_directory (finish what YIP started)

| Step | Effort |
|---|---|
| Add `person_id` to YiFuture's `future.chapter_core_team`, `future.mentors`, `future.delegates` | 1 session |
| Backfill: match existing YiFuture people to `yi_directory.people` by email | 1 session |
| Add sync triggers in `future.*` (mirror what YIP has) | 1 session |

**Phase B total:** ~3 sessions. Output: all three apps share `yi_directory.people`.

### Phase C — SSO across the three apps

| Step | Effort |
|---|---|
| Confirm shared `auth.users` works across all three apps | 1 session |
| Build cross-app role gate using `yi_directory.role_assignments` | 1 session |
| yi-connect adds `/programs` portal page with deep-links to YIP and YiFuture | 1 session |
| Each app trusts the others' sessions (cookie scope / domain config) | 1 session |

**Phase C total:** ~4 sessions. Output: a chair logs into yi-connect, clicks YIP or YiFuture, lands authenticated.

### Phase D (DEFERRED) — Codebase merge of YIP + YiFuture

Re-evaluate after 6 months of paid operation. Decision criteria:
- Are we maintaining 3 codebases painful enough to justify a 4-6 week merge?
- Has the divergence (YiFuture has mentors, partners, government, push, 35 unique migrations) made merging harder, not easier?
- Would a third program (YIP-2027? new vertical?) benefit from a unified platform?

Most likely outcome: **don't merge.** Keep 3 codebases, accept the cost, focus on the wedge.

## Phase A + B + C total: ~14-15 sessions

This is the unification. ~14 sessions of work, spread across whenever the Director chooses. Much smaller than my earlier 17-19 estimate, because we're NOT merging codebases.

## Critical risks (named)

1. **Schema cross-references.** YIP migration 023 already added `person_id` to `future.chapter_core_team` — meaning YIP's migrations reach into YiFuture's schema. When we apply yi-connect migrations, we must check they don't conflict with this existing cross-reach. Pre-Phase-A audit: read every YIP and YiFuture migration for `ALTER TABLE` statements on other apps' schemas.

2. **Director account name collision.** director@jkkn.ac.in is super-admin in YIP (migration 110000), YiFuture (migration 132), and will be in yi-connect. All three use `auth.users` — fine — but make sure the role/permission model doesn't accidentally let YIP's super-admin write to yi-connect tables or vice versa. Per-app RLS must scope by schema, not by user identity alone.

3. **Existing YIP and YiFuture data.** If either app has real data (not just seeds), Phase B's backfill must preserve referential integrity. Check before starting.

4. **The `future.*` migrations 131-135 are creating `yi.*` infrastructure that yi-connect also needs.** Migration 131 created `yi.national_admins`; yi-connect's super-admin check (migration 20251110110000) is independent. Need to consolidate — yi-connect should query `yi.national_admins` instead of its own super-admin table.

## What this means for the soft-beta launch

You don't have to wait for any of this to start the beta. yi-connect works standalone on `jxvbjpkypzedtrqewesc` today. Beta chapters can use it as-is.

**Phase A's first step (yi-connect → shared DB) is the data migration that affects beta chapters.** It should happen BEFORE you onboard chapters that you don't want to migrate twice. So:

- **Beta chapters 1-2 (now):** use yi-connect on standalone project. Tolerate that they'll be migrated once.
- **Phase A (parallel):** lift yi-connect into shared DB.
- **Beta chapters 3-5 (after Phase A):** onboard directly on shared DB. Never touch the old project.

## Next concrete build action

Run **Phase A, Step 1: Create `yi_connect.*` schema in `bkmpbcoxbjyafieabxao`** and apply one safe migration to prove the path works. ~15 minutes of actual work.

After that succeeds, lift one yi-connect table at a time. Each lift is a small, reversible, observable step.

---

*Document written 2026-05-22 after reading YIP and YiFuture source trees + migration files. Supersedes the architectural model in UNIFICATION_PLAN.md.*
