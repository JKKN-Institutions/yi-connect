# YIP Comprehensive Link Audit
**Date:** 2026-05-28
**Target:** https://yi-connect-app.vercel.app/yip
**Commit verified:** 3b8bbfe (path-prefix mass fix + dashboard/admin redirect)
**Verdict:** BROKEN LINKS FOUND — the path-prefix mass fix MISSED three critical nav components

## Executive summary

The 3b8bbfe fix correctly prefixed direct `<Link href="/dashboard/...">` strings in page bodies, but **missed the three nav-config objects** that are rendered on every dashboard page:

1. `app/yip/dashboard/dashboard-shell.tsx` — sidebar nav (5 items) — broken on **every** dashboard page
2. `app/yip/dashboard/admin/admin-shell-nav.tsx` — admin secondary nav (10 items) — broken on **every** admin page
3. `app/yip/dashboard/events/[id]/event-tab-nav.tsx` — event tab nav (20 tabs) — broken on **every** event page

Plus 5 action cards on the event overview page and a Projector View link on the control panel.

**Total: 38 distinct broken hrefs in production.** The user's bookmark 404s are not a perception issue — every primary navigation surface in the dashboard is broken.

## Pages walked

| Page | URL | Status | Notes |
|---|---|---|---|
| Login | `/yip/login` | 200 | OK, sign-in works |
| Dashboard (My Events) | `/yip/dashboard` | 200 | Renders correctly; event cards link OK |
| Topics (clicked from sidebar) | `/dashboard/topics` (no /yip) | **404** | Sidebar bug |
| Event Overview | `/yip/dashboard/events/<id>` | 200 | Renders correctly via direct URL |
| Event Checklist (clicked from tab nav) | `/dashboard/events/<id>/checklist` (no /yip) | **404** | Event tab nav bug |

Two clicks into the dashboard were sufficient to surface the systematic failure pattern; the remaining 36 broken links share the exact same root cause (bare nav-config strings).

## Broken links found

| # | From page | Link text | href value | Status | Type | Source |
|---|---|---|---|---|---|---|
| 1 | Every dashboard page | "My Events" (sidebar) | `/dashboard` | 404 | D | `app/yip/dashboard/dashboard-shell.tsx:22` |
| 2 | Every dashboard page | "Topics" (sidebar) | `/dashboard/topics` | 404 | D | `app/yip/dashboard/dashboard-shell.tsx:23` |
| 3 | Every dashboard page | "Schools" (sidebar) | `/dashboard/schools` | 404 | D | `app/yip/dashboard/dashboard-shell.tsx:24` |
| 4 | Every dashboard page | "Zones" (sidebar) | `/dashboard/zones` | 404 | D | `app/yip/dashboard/dashboard-shell.tsx:25` |
| 5 | Every dashboard page | "Admin" (sidebar) | `/dashboard/admin` | 404 | D | `app/yip/dashboard/dashboard-shell.tsx:26` |
| 6 | Every event page | "Overview" tab | `/dashboard/events/<id>` | 404 | A | `app/yip/dashboard/events/[id]/event-tab-nav.tsx:60` (basePath) |
| 7 | Every event page | "Checklist" tab | `/dashboard/events/<id>/checklist` | 404 | A | same |
| 8 | Every event page | "Registrations" tab | `/dashboard/events/<id>/registrations` | 404 | A | same |
| 9 | Every event page | "Participants" tab | `/dashboard/events/<id>/participants` | 404 | A | same |
| 10 | Every event page | "Fees" tab | `/dashboard/events/<id>/fees` | 404 | A | same |
| 11 | Every event page | "Parties" tab | `/dashboard/events/<id>/parties` | 404 | A | same |
| 12 | Every event page | "Allocation" tab | `/dashboard/events/<id>/allocation` | 404 | A | same |
| 13 | Every event page | "Jury" tab | `/dashboard/events/<id>/jury` | 404 | A | same |
| 14 | Every event page | "Volunteers" tab | `/dashboard/events/<id>/volunteers` | 404 | A | same |
| 15 | Every event page | "Branding" tab | `/dashboard/events/<id>/branding` | 404 | A | same |
| 16 | Every event page | "Topics" tab | `/dashboard/events/<id>/topics` | 404 | A | same |
| 17 | Every event page | "Questions" tab | `/dashboard/events/<id>/questions` | 404 | A | same |
| 18 | Every event page | "Motions" tab | `/dashboard/events/<id>/motions` | 404 | A | same |
| 19 | Every event page | "Bills" tab | `/dashboard/events/<id>/bills` | 404 | A | same |
| 20 | Every event page | "Control" tab | `/dashboard/events/<id>/control` | 404 | A | same |
| 21 | Every event page | "Media" tab | `/dashboard/events/<id>/media` | 404 | A | same |
| 22 | Every event page | "Scoring" tab | `/dashboard/events/<id>/scoring` | 404 | A | same |
| 23 | Every event page | "Results" tab | `/dashboard/events/<id>/results` | 404 | A | same |
| 24 | Every event page | "Feedback" tab | `/dashboard/events/<id>/feedback` | 404 | A | same |
| 25 | Every event page | "Certificates" tab (when results_published) | `/dashboard/events/<id>/certificates` | 404 | A | same |
| 26 | Every admin page | "Pipeline" (secondary nav) | `/dashboard/admin` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:21` |
| 27 | Every admin page | "People" | `/dashboard/admin/people` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:22` |
| 28 | Every admin page | "Rubrics" | `/dashboard/admin/rubrics` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:23` |
| 29 | Every admin page | "Topics" | `/dashboard/admin/topics` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:24` |
| 30 | Every admin page | "Checklist Template" | `/dashboard/admin/checklist` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:25` |
| 31 | Every admin page | "National Team" | `/dashboard/admin/team` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:26` |
| 32 | Every admin page | "Chapter Admins" | `/dashboard/admin/chapter-admins` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:27` |
| 33 | Every admin page | "Seasons" | `/dashboard/admin/seasons` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:28` |
| 34 | Every admin page | "Branding Rules" | `/dashboard/admin/branding-rules` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:29` |
| 35 | Every admin page | "Mock Data" | `/dashboard/admin/mock-data` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:30` |
| 36 | Every admin page | "Audit Log" | `/dashboard/admin/audit-log` | 404 | D | `app/yip/dashboard/admin/admin-shell-nav.tsx:31` |
| 37 | Event overview (status-dependent action card) | "Add Participants" / "Import Students" | `/dashboard/events/<id>/participants` | 404 | A | `app/yip/dashboard/events/[id]/page.tsx:101,119` |
| 38 | Event overview (status-dependent action card) | "Run Allocation" | `/dashboard/events/<id>/allocation` | 404 | A | `app/yip/dashboard/events/[id]/page.tsx:109` |
| 39 | Event overview (status-dependent action card) | "Go Live" / "Open Control Panel" | `/dashboard/events/<id>/control` | 404 | A | `app/yip/dashboard/events/[id]/page.tsx:132,142` |
| 40 | Event Control panel (when isLive) | "Open Projector View" | `/event/<id>/display` | 404 | A | `app/yip/dashboard/events/[id]/control/control-panel.tsx:435` (display route lives at `/yip/event/[id]/display`) |
| 41 | Test-login page | "Open Projector View" for each session | `/event/<id>/display` | 404 | A | `app/yip/test-login/test-login-client.tsx:237` |

### Count by type
- **TYPE A** (template-literal `/dashboard/...` in JSX hrefs): 24 — concentrated in event-tab-nav (one fix touches 20) + event overview action cards (5) + control panel + test-login projector links (2)
- **TYPE B** (genuine orphan route): 0
- **TYPE C** (bare `redirect()` in server actions): 0 in user-facing nav (the `revalidatePath()` calls in `app/yip/actions/admin-*.ts` use bare `/dashboard/admin/...` paths, which is **correct** for revalidation — those are Next.js internal cache keys, not redirects, so they're not bugs)
- **TYPE D** (sidebar / nav config with bare prefix): 15 — `dashboard-shell.tsx` (5) + `admin-shell-nav.tsx` (10)

### Single highest-impact broken link
**The sidebar nav in `dashboard-shell.tsx`.** A logged-in organizer hitting `/yip/dashboard` cannot click ANY of the five sidebar nav items without landing on a 404. This is the bug the user is repeatedly hitting on bookmarks because the sidebar is the primary navigation surface and is rendered on every dashboard page.

## Recommended fixes

All TYPE A and TYPE D fixes are mechanical: add `/yip` prefix.

### Fix 1: `app/yip/dashboard/dashboard-shell.tsx` (5 lines + 2 active-state checks)
```tsx
const navItems = [
  { label: "My Events", href: "/yip/dashboard", icon: CalendarDays },
  { label: "Topics", href: "/yip/dashboard/topics", icon: BookOpen },
  { label: "Schools", href: "/yip/dashboard/schools", icon: School },
  { label: "Zones", href: "/yip/dashboard/zones", icon: Globe },
  { label: "Admin", href: "/yip/dashboard/admin", icon: LayoutGrid },
];
```
Also update lines 110-111:
```tsx
item.href === "/yip/dashboard"
  ? pathname === "/yip/dashboard" || pathname.startsWith("/yip/dashboard/events")
  : pathname.startsWith(item.href);
```

### Fix 2: `app/yip/dashboard/admin/admin-shell-nav.tsx` (lines 21-31)
Add `/yip` prefix to all 10 hrefs.

### Fix 3: `app/yip/dashboard/events/[id]/event-tab-nav.tsx:60`
```tsx
const basePath = `/yip/dashboard/events/${eventId}`;
```
One line fix — propagates to all 20 tabs.

### Fix 4: `app/yip/dashboard/events/[id]/page.tsx` (lines 101, 109, 119, 132, 142)
Prefix all 5 action-card hrefs with `/yip`.

### Fix 5: `app/yip/dashboard/events/[id]/control/control-panel.tsx:435`
```tsx
href={`/yip/event/${eventId}/display`}
```

### Fix 6: `app/yip/test-login/test-login-client.tsx:237`
```tsx
href={`/yip/event/${s.id}/display`}
```

### Also worth checking (not user-facing but related)
- `lib/yip/supabase/middleware.ts:46` — `if (pathname.startsWith("/dashboard"))` — this is dead code now (real path is `/yip/dashboard`). Either remove or update to `/yip/dashboard` so middleware auth actually enforces protection on the YIP dashboard. **Security implication**: if this is the only auth gate for the dashboard, the YIP dashboard may currently be unprotected at the middleware layer (Supabase RSC-side checks may still gate it, but this is worth verifying).
- `app/yip/actions/test-login.ts:286` — returns `redirect: "/dashboard"` which the client uses to navigate post-login. Should be `/yip/dashboard`.

### Verification command after fix
```bash
grep -rn '`/dashboard\|"/dashboard\|`/event/\|"/event/' app/yip --include='*.tsx' --include='*.ts' | grep -vE '(revalidatePath|RUBRICS_PATH|ADMIN_PATH|BRANDING_RULES_PATH|REVAL_PATH|SEASONS_PATH|startsWith|middleware.ts)'
```
Should return zero hits when all fixes are applied.
