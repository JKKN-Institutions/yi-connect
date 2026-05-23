# BUG-04: Raw enum "problem_selected" displayed in captain dashboard

**Role:** Captain (likely all team-bearing roles)
**Severity:** LOW — cosmetic, but jarring
**Found:** 2026-05-23 production sweep

## Repro
1. Unlock with captain code (9G299Q)
2. Land on /yi-future/me
3. See team card showing: "The Smart Warriors / problem_selectedYou are captain"

## Expected
Either a friendly label ("Problem selected — you are captain") or a status badge ("✓ Problem selected").

## Fix
Locate the team card component on /yi-future/me, find where `team.status` (or similar field with enum value "problem_selected") renders, wrap with a label-mapping function or remove if not user-facing.
