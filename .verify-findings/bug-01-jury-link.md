# BUG-01: Jury assignment link returns 404

**Role:** TSTJRY (jury)
**Severity:** CRITICAL — entire Take Pride Award scoring flow broken
**Found:** 2026-05-23 production sweep

## Repro
1. Unlock at /yi-future/unlock with `TSTJRY`
2. Lands on /yi-future/jury (correct — shows 1 assignment)
3. Click the assignment "The Smart Warriors → Waste-to-Energy for Tier-2 Cities → Pending"
4. URL goes to `/jury/93af41a5-8afa-47e7-bbd8-8fe0d9d47c6a` → **404 Page Not Found**

## Expected
URL should be `/yi-future/jury/93af41a5-8afa-47e7-bbd8-8fe0d9d47c6a` (under the yi-future namespace where the jury landing page lives).

## Fix
Search/replace href construction on /yi-future/jury list page — prepend `/yi-future` to assignment links.
