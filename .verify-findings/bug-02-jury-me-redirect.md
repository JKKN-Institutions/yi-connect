# BUG-02: Jury role /me redirects to /join instead of /yi-future/jury

**Role:** TSTJRY (jury)
**Severity:** MEDIUM — confusing UX, not blocking
**Found:** 2026-05-23 production sweep

## Repro
1. Unlock with `TSTJRY` (lands on /yi-future/jury — correct)
2. Manually navigate to /yi-future/me
3. Redirected to /yi-future/join (the public registration form)

## Expected
Jury role accessing wrong section should be redirected to their own landing page (/yi-future/jury), not the public application form.

## Notes
Session IS alive after this — going back to /yi-future/jury works without re-unlock. So this is purely a redirect logic bug in the /me route handler / middleware for jury role.

## Fix
In /yi-future/me route guard, check role; if role == jury, redirect to /yi-future/jury instead of /yi-future/join.
