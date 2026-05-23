# DEMO26 (Member — Priya Sharma, The Smart Warriors, Siliguri) — Sweep Summary

**Outcome:** Member role works correctly. Same nav bugs as captain (BUG-04, BUG-05) inherit.

## What works
- Unlock with DEMO26 → /yi-future/me as Priya Sharma
- /yi-future/me — member dashboard shows team summary, members list, problem statement (no Manage button — correct)
- /yi-future/me/team — **🔒 Captain only** gate shown correctly (auth working)
- /yi-future/me/submissions — **🔒 Captain only** gate shown correctly (only captains file deliverables)
- /yi-future/me/resume — works (personal resume URL input)
- /yi-future/me/consent — works (parent consent flow)
- /yi-future/me/feedback — works (empty state)

Zero console errors.

## Brief discrepancy
P0 brief listed "submit deliverable" as part of member day-in-the-life flow. **Members cannot submit deliverables** — only captains can. This is correct per design (1 captain submits on behalf of team), but worth flagging to Director in case the brief expected a separate member-submission surface.

## Bugs inherited from captain sweep
- BUG-04: "problem_selected" enum leak on team card
- BUG-05: All 7 journey nav tabs broken (same as captain — they share /yi-future/me/page.tsx)

## Verdict
Member flow functional. No additional bugs beyond captain set.
