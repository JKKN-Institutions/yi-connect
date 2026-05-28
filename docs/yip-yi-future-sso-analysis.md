# Yi-Future ↔ YIP Single Sign-On Analysis (Phase 19 / H)

**Date:** 2026-05-28
**Verdict:** PARTIALLY_UNIFIED (substrate is shared; authorisation tables and admin home pages are NOT)

---

## Context

From the 2026-05-27 Yi National team meeting (Speaker 2 / Om):

> "For Yi-Future also we have already created the platform — chapter wise 65 chapters, we have added name, phone and email — they already logged in or they will be logging in. So it's the same login which they will use."

The question: does the YIP organiser login (`/yip/login`) and the Yi-Future chapter-admin login (`/yi-future/login`) actually share authentication today? If a chapter chair signs in once, are they signed in across both modules?

---

## Current State

### YIP organiser login
- **Login form:** `app/yip/login/page.tsx` — email + password
- **Server action:** `app/yip/actions/auth.ts` → `loginOrganizer()` (line 247) — calls Supabase `signInWithPassword` via `lib/yip/supabase/server.ts` `createClient()`
- **Auth substrate:** Supabase Auth → writes the SSR cookie `sb-bkmpbcoxbjyafieabxao-auth-token` at path `/`
- **Authorisation table:** `yip.organizers` (column `user_id` → `auth.users.id`, plus `role`, `chapter_name`, `login_slug`)
- **Admin home:** `/yip/dashboard` → `app/yip/dashboard/layout.tsx` checks `supabase.auth.getUser()` and redirects to `/yip/login` if unauthenticated

### Yi-Future chapter-admin login
- **Login form:** `app/yi-future/login/page.tsx` — email + password (visually different, identical mechanism)
- **Server action:** `app/yi-future/actions/auth.ts` → `loginAdmin()` (line 25) — calls Supabase `signInWithPassword` via `lib/yi-future/supabase/server.ts` `createClient()`
- **Auth substrate:** Same Supabase project → same SSR cookie `sb-bkmpbcoxbjyafieabxao-auth-token` at path `/`
- **Authorisation table:** `future.chapter_core_team` (column `user_id` → `auth.users.id`, plus `role`, `chapter_id`, `edition_id`, `is_active`) — resolved by `lib/yi-future/chapter-context.ts` (line 45)
- **Admin home:** `/yi-future/chapter` → `app/yi-future/chapter/layout.tsx` checks `supabase.auth.getUser()` and redirects to `/yi-future/login` if unauthenticated

### Middleware (root `middleware.ts` → `lib/supabase/middleware.ts`)
- Single Supabase SSR client instantiated for **every** request, regardless of `/yip` or `/yi-future` prefix
- Same project URL, same anon key, same cookie name — the session cookie is written/read at path `/` and is visible to **all** sub-routes
- `handleYipAuth` and `handleYiFutureAuth` both call `supabase.auth.getUser()` on the same cookie — if the user is signed in on one, they are signed in on the other

---

## The Substrate

| Layer | Shared? | Evidence |
|---|---|---|
| Supabase project | YES | `bkmpbcoxbjyafieabxao` referenced by both `lib/yip/supabase/server.ts` and `lib/yi-future/supabase/server.ts` via `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase `auth.users` table | YES | Postgres has exactly one `auth.users`; both `yip.organizers.user_id` and `future.chapter_core_team.user_id` FK into it |
| Session cookie | YES | `sb-bkmpbcoxbjyafieabxao-auth-token` at path `/` — set by Supabase SSR; both surfaces read it via the same `createServerClient` |
| Middleware | YES | Root `middleware.ts` → `lib/supabase/middleware.ts` runs `supabase.auth.getUser()` for every request before the route-specific gate |
| Login form | NO (cosmetic) | Two visually different forms (`/yip/login` saffron card vs `/yi-future/login` navy admin card) — both call `signInWithPassword` underneath. **The password is the same.** |
| Authorisation table | NO | YIP reads `yip.organizers.user_id`; Yi-Future reads `future.chapter_core_team.user_id`. A person must have a row in BOTH to admin both surfaces. |
| Chapter referent | YES (loose) | Both eventually point at `yi.chapters`. YIP via `events.yi_chapter_id`; Yi-Future via `chapter_core_team.chapter_id` |
| Post-login redirect | NO | YIP → `/yip/dashboard`; Yi-Future → `/yi-future/chapter`. No shared "pick a module" landing. |

---

## Gap Analysis

The substrate IS unified — but the user experience is not. Three concrete gaps:

### Gap 1: Two separate authorisation tables
A chapter chair who exists in `future.chapter_core_team` but NOT in `yip.organizers` can log in at `/yi-future/login`, then visit `/yip/dashboard` — and middleware will let them through (cookie is valid), but `app/yip/dashboard/layout.tsx` only checks `auth.getUser()`, not organiser membership. The user lands on YIP dashboard with no events to manage. Inverse is also true.

The 65-chapter onboarding Om mentioned has populated `future.chapter_core_team` (Yi-Future side). It has NOT populated `yip.organizers`. Chapter chairs who only need YIP would have to be added separately.

### Gap 2: Two separate login URLs / forms
There is no shared landing page that says "Sign in to Yi platforms". The user must know whether they want `/yip/login` or `/yi-future/login`. Once signed in via either, the session works on both — but discovery is bad.

### Gap 3: No cross-module redirect after login
`loginOrganizer()` hard-redirects to `/yip/dashboard`. `loginAdmin()` hard-redirects to `/yi-future/chapter`. Neither honours a `redirectTo` query param that would let `/yip/login` send a chapter chair back to `/yi-future/chapter` if that's where they came from.

---

## Proposed Smallest-Change Unification

Three-step migration. None require schema changes to `auth.users`.

### Change 1 — Backfill `yip.organizers` from `future.chapter_core_team`
**Where:** new migration `supabase/migrations/03Xxx_backfill_yip_organizers_from_chapter_core_team.sql`
**What:** for every active row in `future.chapter_core_team` whose `role IN ('chair', 'co_chair', 'chapter_em')` AND whose corresponding `auth.users.email` is not already in `yip.organizers`, insert an `yip.organizers` row with the same `user_id`, `role = 'chapter_em'`, and `chapter_name` resolved via `future.chapters → yi.chapters.name`.
**Effect:** every Yi-Future chapter chair instantly becomes a YIP organiser too. They use the same email/password (Supabase Auth), the same cookie, and now have a row in both authorisation tables.

### Change 2 — Add a shared `/sign-in` landing page
**Where:** `app/(public)/sign-in/page.tsx` (new), routes to `/yip/login` or `/yi-future/login` based on which surface the user picked (or detects via the `Referer` header / `?from=` query).
**What:** plain shell with two buttons: "I'm running a YIP event" → `/yip/login` ; "I'm a Yi-Future chapter chair" → `/yi-future/login`. Both ultimately call the same `signInWithPassword` and both produce the same session cookie.
**Optional:** make `/login` (top-level, currently `app/(auth)/login`) auto-redirect to `/sign-in` so all entry points converge.

### Change 3 — Honour `redirectTo` after sign-in
**Where:** `app/yip/actions/auth.ts` line 247 (`loginOrganizer`) and `app/yi-future/actions/auth.ts` line 25 (`loginAdmin`)
**What:** accept an optional `redirectTo` param and return it; the form pushes to that URL after success instead of hard-coding `/yip/dashboard` or `/yi-future/chapter`. The pages already read `redirectTo` from the URL (middleware sets it on redirect).
**Effect:** a Yi-Future chapter chair who clicks a deep link into `/yip/dashboard/events/abc` and gets bounced to `/yip/login` can sign in once and land back on the original page.

### Optional Change 4 — Unified module switcher
**Where:** shared header component used in both `app/yip/dashboard/dashboard-shell.tsx` and `app/yi-future/.../AdminShell.tsx`
**What:** a dropdown "Switch to: YIP / Yi-Future / Yi-Connect" visible when the signed-in user has membership in more than one. Query: `select 'yip' where exists(... yip.organizers.user_id=...) union all select 'future' where exists(... future.chapter_core_team.user_id=...)`.

---

## Risks

- **Backfill aliasing risk:** if a Yi-Future row has an email that already exists in `yip.organizers` with a DIFFERENT `user_id` (rare, but possible if someone was added to YIP under a separate auth.users row), the insert would create a duplicate. Mitigation: backfill SQL must UPSERT on `user_id`, not on email.
- **Cookie-path drift:** the comment in `lib/supabase/middleware.ts` (lines 34-46) flags a planned migration to scope `yip_session` to `path: "/yip"`. This is for the access-code cookie (jury / participants), NOT for the Supabase Auth cookie — that one MUST stay at path `/` for SSO to work. Confirm before any cookie-path change ships.
- **RLS policies:** `yip.organizers` likely has RLS that only allows self-read. Backfilling new rows is fine (service client bypasses RLS), but the new chapter chairs will hit RLS denials if the YIP dashboard tries to read their organiser row via the user-scoped client. Need to verify policy `organizers_self_read` covers them.
- **Role semantics:** `yip.organizers.role` is `national | rm | chapter_em`. Mapping `future.chapter_core_team.role` (`chair | co_chair | chapter_em | mentor_coord | ...`) needs a decision — `chair → chapter_em` is the obvious choice but should be confirmed with the National team.

---

## Estimated Effort

- **Investigation:** complete (this doc)
- **Change 1 (backfill migration):** 1-2 hours including testing on staging
- **Change 2 (shared sign-in page):** 1-2 hours
- **Change 3 (redirectTo honouring):** 30 minutes
- **Change 4 (module switcher, optional):** 2-3 hours
- **Total to "Om's claim is true end-to-end":** half-day single session, plus 1 hour of post-deploy verification with a real Yi-Future chapter chair account

The substrate work is already done. What remains is data-plumbing (Change 1) and UX (Changes 2-4).
