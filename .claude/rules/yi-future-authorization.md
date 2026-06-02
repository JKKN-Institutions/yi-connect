---
paths:
  - "app/yi-future/**"
  - "lib/yi-future/**"
---

# 🔴 Yi-Future Authorization Model

Auto-loads on `app/yi-future/**` / `lib/yi-future/**`. The yi_directory app key for this vertical is **`app='future'`** (NOT `'yi-future'`). Service client: `@/lib/yi-future/supabase/server`. Unauthenticated → `redirect("/yi-future/login")`.

## Two predicates — NEVER gate a WRITE with the VIEW predicate

The national-admin gates live in `app/yi-future/actions/national-admins.ts`. There are TWO tiers and they must stay separate (a single shared predicate caused a **privilege-escalation bug, fixed 2026-06-01**):

1. **STRICT platform/super tier** — `requirePlatformAdmin()` (redirecting) / `isCurrentUserPlatformAdmin()` (button-visibility probe). Accepts, on `app='future'`: `future_super_admin`, `platform_super_admin`, `super_admin`, `platform_admin` — **plus** a cross-app short-circuit for anyone holding `platform_super_admin`/`super_admin` on ANY app (e.g. `director@jkkn.ac.in` on `app='platform'`). **Gates every privileged WRITE** (toggle super/platform admin, password resets, structural config). EXCLUDES the regular tier.
2. **BROAD view tier** — `isCurrentUserFutureAdmin()`. Adds the regular tier (`future_admin`, `national_admin`) on top of the strict set. **VIEW only** — gates `national/admin/layout.tsx` so a regular national admin keeps read access. **MUST NOT gate any write.**

> Original bug: one predicate gated BOTH view and write, so a regular `future_admin`/`national_admin` could promote/demote admins, reset passwords, and broadcast. When you add a gate, decide write-vs-view FIRST, then pick the matching predicate.

## Other invariants
- **Legacy super-admin:** `requireSuperAdmin()` still reads `yi.national_admins.is_super_admin` (legacy table, being deprecated in favour of yi_directory). Don't add rows there — add to `yi_directory` (see root CLAUDE.md identity rule).
- **Last-admin guard:** `removeNationalAdmin` / `toggleSuperAdmin(false)` / `togglePlatformAdmin(false)` refuse when the target is the last remaining super/platform admin (app-layer count check, run AFTER the guard passes).
- **Deny EXPLICITLY:** gates `redirect()` to `/yi-future/national/admin?error=not_platform_admin` (or `not_super_admin`) — a surfaced reason, never a silent bounce to a landing page (rule #27).
- **Participant access codes:** `lib/yi-future/access-code.ts` → `generateAccessCode()` (6-char, ambiguous chars excluded; uniqueness checked per-edition at insert time).
