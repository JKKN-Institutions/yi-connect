# BUG-05: 42 broken navigation hrefs across 3 dashboard layouts

**Roles affected:** Captain, Member (any /yi-future/me visitor); Chapter Admin; Host (Event Org).
**Severity:** CRITICAL — every dashboard tab leads to a 404
**Found:** 2026-05-23 production sweep

## Root cause
Three dashboard nav arrays declare hrefs as `/me/...`, `/chapter/...`, `/host/...` — all missing the `/yi-future/` prefix. The actual pages live at `/yi-future/me/*`, `/yi-future/chapter/*`, `/yi-future/host/*`.

## Files

### app/yi-future/me/page.tsx (7 broken)
- Line 81: `href: "/me/journey"` → should be `/yi-future/me/journey`
- Line 82: `href: "/me/submissions"` → should be `/yi-future/me/submissions`
- Line 83: `href: "/me/feedback"` → should be `/yi-future/me/feedback`
- Line 84: `href: "/me/resume"` → should be `/yi-future/me/resume`
- Line 85: `href: "/me/interviews"` → should be `/yi-future/me/interviews`
- Line 86: `href: "/me/consent"` → should be `/yi-future/me/consent`
- Line 87: `href: "/me/results"` → should be `/yi-future/me/results`

### app/yi-future/chapter/layout.tsx (17 broken)
All `/chapter/*` hrefs (lines 6-20) missing `/yi-future/` prefix. Line 21 `/my-bug-reports` may also need `/yi-future/my-bug-reports`.

### app/yi-future/host/layout.tsx (18 broken)
All `/host/*` hrefs (lines 6-22) missing `/yi-future/` prefix. Line 23 `/my-bug-reports` same issue.

## Repro (any role)
1. Unlock with any chapter-admin / captain / host code
2. Land on /yi-future/me (or /yi-future/chapter or /yi-future/host)
3. Click any nav tab
4. 404 Page Not Found

## Confirmation tested
Direct visit to `https://yi-connect-app.vercel.app/me/submissions` → 404. Same URL under `/yi-future/me/submissions` → works (existing tab 703318775 confirms).

## Why Agent Y missed this
Brief states "Agent Y verified 22/22 production routes return 200/307". Routes themselves return 200 — but the *links to* those routes are broken. Three-layer sweep failure: tested HTTP layer, missed UI navigation layer.

## Fix
Add `/yi-future` prefix to every nav-array entry in the 3 files. Search/replace:
- `href: "/me/` → `href: "/yi-future/me/`
- `href: "/chapter/` → `href: "/yi-future/chapter/`
- `href: "/host/` → `href: "/yi-future/host/`
- `href: "/my-bug-reports"` → `href: "/yi-future/my-bug-reports"` (verify path exists)

15-line PR. All 42 links fixed in one commit.
