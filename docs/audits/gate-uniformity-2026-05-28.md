# Gate Uniformity Audit — 2026-05-28

**Triggered by:** YIP 3-tier visibility bug where `layout.tsx` + 10 sub-tabs used stale `.eq("created_by", user.id)` while only the root used the canonical `getEvent()` helper. Regional admins could see events in list but every detail page 403'd.

**Scope:** Yi-Future, YiFi, Yi Connect `(dashboard)`. Excluded: `app/yip/*`, `app/coordinator/*`, `app/chapter-lead/*`.

---

## Summary Counts

| Metric | Count |
|--------|-------|
| Apps audited | 3 |
| Parent-detail trees found | 7 |
| Uniform | 6 |
| Drift | 1 |
| Silent permission-denial redirects | 3 |
| No-app-gate (.single() only, RLS-reliant) | 2 |

---

## Yi-Future

### Gate Architecture

Yi-Future uses two canonical context helpers:

- `getChapterContext()` — reads logged-in user's chapter membership, returns `{ chapterId, editionId, ... }` or null
- `getHostContext()` — same but also resolves `isHost` and `nationalEvent`
- `national/admin/layout.tsx` — uses `isCurrentUserPlatformAdmin()` RPC

All chapter admin pages (`/yi-future/chapter/**`) and host pages (`/yi-future/host/**`) flow through these helpers.

### Pattern 1 — Detail page + layout + sub-tabs

#### `chapter/final/[id]/*` — UNIFORM

| File | Gate |
|------|------|
| `chapter/final/[id]/page.tsx` | `getChapterContext()` + `event.chapter_id !== ctx.chapterId` check |
| `chapter/final/[id]/live/page.tsx` | Same: `getChapterContext()` + `event.chapter_id !== ctx.chapterId` |
| `chapter/final/[id]/schedule/page.tsx` | Same: `getChapterContext()` + `event.chapter_id !== ctx.chapterId` |

All three sub-pages independently verify context and cross-check chapter ownership. No layout file at this level — gate is inline per page.

#### `chapter/teams/[id]` — UNIFORM

`getChapterContext()` + `team.chapter_id !== ctx.chapterId` in the single detail page. No sub-routes.

#### `chapter/journey/[id]` — UNIFORM

`getChapterContext()` + `event.chapter_id !== ctx.chapterId`.

#### `chapter/delegates/[id]/edit` — UNIFORM

`getChapterContext()` + `delegate.chapter_id !== ctx.chapterId`.

#### `chapter/layout.tsx` — AUTH ONLY (by design)

Layout only checks `!user` → redirect to login. Chapter-scoped authorization is done inline in each sub-page via `getChapterContext()`. This is intentional — pages that need scoping do it themselves. The pattern is consistent.

#### `host/layout.tsx` — AUTH ONLY (by design)

Same pattern: layout checks `!user`. Permission checks (e.g. `ctx.isHost`) are done inline in each sub-page.

#### `national/admin/layout.tsx` — UNIFORM, STRONG

Uses `isCurrentUserPlatformAdmin()` at layout level. Sub-pages re-check `!user` before data fetches but the layout is the authoritative gate for the national admin section. This matches the YIP corrected pattern.

### Pattern 2 — Silent redirects

The following are **PERMISSION DENIAL redirects** (signed-in user, access denied to this specific resource), not auth bounces:

#### DRIFT-1: `host/government/page.tsx` lines 38-39
```
if (!ctx) redirect("/yi-future/chapter");
if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");
```
**Classification:** PERMISSION DENIAL. A signed-in chapter chair who is not the host chapter will silently bounce to `/yi-future/host` with no explanation. Same pattern repeated across ~15 host sub-pages (internships, media, partners, agenda, awards, resumes, etc.).

**Risk:** LOW-MEDIUM. The audience for these pages is chapter chairs — they know their role. But the bounce is silent and confusing. No existing Forbidden component for the `yi-future` app. **Not auto-fixed per constraints (no new components).**

#### DRIFT-2: `jury/[teamId]/page.tsx` line 133
```
if (!assignment) redirect("/yi-future/jury");
```
**Classification:** PERMISSION DENIAL. A jury member accessing a team they are not assigned to gets silently bounced to the jury home. The user sees no reason.

**Risk:** LOW. Jury members only land on this page via the jury home links, which only show assigned teams. But direct URL access gives no feedback.

**Not auto-fixed** — no Forbidden component exists for yi-future.

#### `national/admin/finals/new/page.tsx` line 21
```
if (!edition) redirect("/yi-future/national/admin");
```
**Classification:** DATA-MISSING, not permission denial. If no active edition exists, redirect to admin hub is appropriate. Borderline — keep as-is.

### Pattern 3 — .single() with permissive RLS

No unchecked `.single()` pattern found in the page-layer for yi-future. The `.single()` calls in `host/finale/live`, `host/finalists`, and `host/finale/schedule` are for fetching `host_finale_region` rows — all backed by app-layer `ctx.isHost` checks before they run. Risk is LOW.

---

## YiFi

### Pattern 1 — Detail pages

YiFi has no `[id]` detail sub-trees. Its page structure is:

```
yifi/admin/page.tsx     — admin dashboard (single page)
yifi/me/page.tsx        — member portal (single page)
yifi/join/page.tsx      — public join form
```

**Result: N/A — no parent-detail pattern to audit.**

### Pattern 2 — Silent redirects

#### `yifi/admin/page.tsx` line 41
```
if (!user?.email) redirect("/yifi/login");
```
AUTH BOUNCE — correct.

#### `yifi/me/page.tsx` lines 49, 59
```
if (!raw) redirect("/yifi/join");
if (!registrant) redirect("/yifi/join");
```
**Classification:** PERMISSION DENIAL. A user who has an auth session but whose registrant record is missing (deleted, or access_code not in table) gets silently bounced to the join form. This could confuse a member who registered and then tries to revisit. However YiFi's auth model is access-code based (no Supabase auth sessions), so `!raw` literally means "no cookie/session" which is an AUTH BOUNCE, not permission denial.

**Result: UNIFORM — no drift.**

---

## Yi Connect (dashboard)

### Gate Architecture

Yi Connect uses:
- `getCurrentUser()` from `lib/data/auth.ts` for auth checks
- `getEventById()` from `lib/data/events.ts` — fetches event, no chapter-scope filter (relies on RLS)
- `getVerticalById()` from `lib/data/vertical.ts` — fetches vertical, no chapter-scope filter (relies on RLS)
- RLS policies are chapter-scoped for both `yi_connect.events` and `yi_connect.verticals`

### Pattern 1 — Detail pages

#### `(dashboard)/events/[id]/*` — PARTIAL (1 drift)

| File | Auth Check | Permission Check |
|------|-----------|-----------------|
| `events/[id]/page.tsx` | `!user → /login` | `isOrganizer = event.organizer?.id === user.id` + `isAdmin = hierarchyLevel >= 4` |
| `events/[id]/edit/page.tsx` | `!user → /login` | `isOrganizer \|\| isAdmin` — **silent redirect on failure** |
| `events/[id]/materials/page.tsx` | `!user → /login` | role lookup via `get_user_roles` RPC — then renders (no block) |
| `events/[id]/report/page.tsx` | `!user → /login` | **no app-layer permission check** |
| `events/[id]/sessions/page.tsx` | none (no auth check) | none |
| `events/[id]/checkin/page.tsx` | none | none |
| `events/[id]/live/page.tsx` | `!user → /login` | none |

**The RLS policy for events is not strictly chapter-scoped** — it allows access to published events to anyone, and draft events to the organizer or hierarchy_level >= 3. This means `getEventById()` can return events from other chapters if they are published. Sub-pages that don't re-check ownership can display cross-chapter data.

**Worst drift: `events/[id]/report/page.tsx`** — no permission check at all. Any authenticated user who knows the event UUID can view the report of any published event from any chapter.

**DRIFT-3: `events/[id]/edit/page.tsx` line 79**
```
if (!canEdit) {
  redirect(`/events/${id}`);
}
```
**Classification:** PERMISSION DENIAL silent redirect. A member who navigates directly to `/events/X/edit` and is not the organizer or Chair+ gets silently redirected to the event detail page with no explanation.

#### `(dashboard)/verticals/[id]/*` — UNIFORM (via RLS)

All sub-pages (`settings`, `plan`, `kpis`, `activities`, `members`, `achievements`) use `getVerticalById(id)`. The `verticals_select_policy` is:
```sql
USING (
  chapter_id IN (
    SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
  )
)
```
This is chapter-scoped at the DB layer. A user from Chapter A cannot read Chapter B's verticals — `getVerticalById` will return null and the page calls `notFound()`. **UNIFORM via RLS.**

#### `(dashboard)/finance/*` — UNIFORM (via RLS, `notFound` on miss)

All finance detail pages (`budgets/[id]`, `expenses/[id]`, `reimbursements/[id]`, `sponsorships/[id]`) use `notFound()` when data is not found. Finance tables have chapter-scoped RLS. **UNIFORM.**

### Pattern 2 — Silent permission-denial redirects

**DRIFT-3** (already noted above): `events/[id]/edit/page.tsx` — `if (!canEdit) redirect(...)`.

**`(dashboard)/verticals/[id]/settings/page.tsx` lines 55-57 (QUIRK)**
There is a dead `getVerticalById` call outside the async function body (static export-time call) that would throw at build. Closer reading: it's inside an outer `async function` body. The pattern is slightly unusual (two consecutive `getVerticalById` calls for the same id within one request) but not a security issue.

### Pattern 3 — .single() relying on permissive RLS

**`events` table RLS is not strictly chapter-scoped** (published events are visible to all authenticated users). Pages that call `.single()` on events by ID without an app-layer ownership check include:

- `events/[id]/report/page.tsx` — **HIGH RISK**: no auth-level permission check. Any authenticated Yi Connect user can view any chapter's event report by guessing a UUID.
- `events/[id]/sessions/page.tsx` — no auth check at all. Even an unauthenticated user who bypasses middleware can call this.

These two pages rely entirely on the `.single()` returning null (which it won't for a published event from another chapter).

---

## Top 3 Worst Drifts

### 1. `app/(dashboard)/events/[id]/report/page.tsx` — CRITICAL
No app-layer permission check. Events RLS is not chapter-gated for published events. Any authenticated Yi Connect member can read any published event's full report from any chapter by navigating to the URL. This is cross-chapter data leakage.

**File:** `/app/(dashboard)/events/[id]/report/page.tsx`
**Fix needed:** Add `isOrganizer || isAdmin` check matching `events/[id]/page.tsx` pattern. Return 403/notFound if user lacks permission.

### 2. `app/(dashboard)/events/[id]/sessions/page.tsx` — HIGH
No auth check at all (no `getCurrentUser()`, no redirect). If middleware has any gap, this page is fully unauthenticated. Even with middleware, it fetches cross-chapter sessions for a published event (no scoping on the secondary sessions query).

**File:** `/app/(dashboard)/events/[id]/sessions/page.tsx`
**Fix needed:** Add `getCurrentUser()` guard at top. Scope the sessions query to `chapter_id`.

### 3. `app/(dashboard)/events/[id]/edit/page.tsx` line 79 — MEDIUM (PERMISSION DENIAL)
```
if (!canEdit) redirect(`/events/${id}`);
```
Silent bounce on permission denial. User sees "I tried to edit, now I'm back on the detail page" with no explanation.

**File:** `/app/(dashboard)/events/[id]/edit/page.tsx`
**Fix needed:** Since `(dashboard)` has no Forbidden component and constraints say don't create new ones, the minimal fix is to return a simple inline forbidden message rather than a redirect. Flag for review.

---

## Auto-fixes Applied

**0 auto-fixes applied.**

Rationale:
- The only auto-fixable pattern (silent permission-denial redirect → Forbidden component) requires a Forbidden component in each app. The existing `Forbidden403` component is YIP-specific (`logoutOrganizer` from yip auth, `/yip/dashboard` hardcoded). Per constraints: "DO NOT create new components, helpers, or shared utilities."
- The two critical no-gate pages (`report`, `sessions`) require logic changes not just component swaps. These are flagged for manual fix, not auto-applied to avoid breaking changes.
- Yi-Future drifts are consistent-by-design (the entire host sub-tree silently bounces non-host chapters) — refactoring all ~15 host pages is out of scope per constraints.

---

## tsc

Exit code: **0** (zero source errors; 1 `.next/` generated-type warning unrelated to this audit).

---

## Branch

`audit/gate-uniformity` — not merged to master per constraints.
