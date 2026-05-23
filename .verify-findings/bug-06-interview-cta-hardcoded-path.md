# BUG-06: Interviews page CTA hardcodes "/me/resume" in user-facing copy

**Role:** Captain (likely all member roles)
**Severity:** LOW — confusing copy, not a click-trap (text not a link)
**Found:** 2026-05-23 production sweep

## Repro
1. Unlock with any captain/member code
2. Navigate to /yi-future/me/interviews
3. Page shows: "Add a resume at /me/resume so partners can find you."

## Expected
Either rewrite as a relative reference ("Add a resume on the Resume tab") or use the correct full path "/yi-future/me/resume".

## Source
Find the interview empty-state component under `app/yi-future/me/interviews/`.
