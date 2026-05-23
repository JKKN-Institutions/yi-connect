# BUG-07: Mentor dashboard is a stub — functional pages unreachable from UI

**Role:** Mentor (64SZSM)
**Severity:** HIGH — mentors can sign in but have no way to discover their working tools
**Found:** 2026-05-23 production sweep

## Repro
1. Unlock with `64SZSM` → lands on /yi-future/mentor as "Dr Priya"
2. Page text: "Your teams and feedback tasks will appear here. Phase 7 will wire mentor-to-team matching, feedback loops, and phase event scheduling."
3. No nav anywhere — only sign-out, brand link, and "Report a Bug"

## What's actually live (but hidden)
Direct URL navigation confirms these mentor surfaces exist and render correctly:
- **/yi-future/mentor/messages** — full message threads UI; "The Smart Warriors" team thread visible (no messages yet)
- **/yi-future/mentor/resources** — full study-resource upload form (title, description, type, file/link)

Both are completely functional but NOT linked from the mentor dashboard or layout.

## Additional finding
- **/yi-future/mentor/scoring** returns 404 (folder has only `[teamId]/page.tsx`, no index)

## Source
- `app/yi-future/mentor/layout.tsx` — no nav array (unlike `chapter/layout.tsx` and `host/layout.tsx`)
- `app/yi-future/mentor/page.tsx` — placeholder copy referencing "Phase 7"

## Fix
1. Add a nav array to `app/yi-future/mentor/layout.tsx` with at minimum: Overview, Messages, Resources. Use the correct `/yi-future/mentor/*` prefix (don't repeat BUG-05).
2. Replace the "Phase 7 will wire..." placeholder text on the mentor dashboard with actual team-list + feedback-queue rendering (data is already in messages/resources surfaces — wire it into the dashboard).

## Impact
Mentor role appears broken to anyone testing the access code, even though 2/3 surfaces work. Director should not consider mentor flow Chair-ready until the dashboard exposes the working pages.
