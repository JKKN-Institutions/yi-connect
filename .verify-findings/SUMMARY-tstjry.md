# TSTJRY (Jury) — Sweep Summary

**Outcome:** Mostly works; 2 bugs found, both fixable in one PR.

## What works
- Unlock with TSTJRY → /yi-future/jury (correct landing)
- Jury list page renders: "1 assigned · 1 to score" for The Smart Warriors → "Waste-to-Energy for Tier-2 Cities"
- Anonymous panel banner shown ("MEMBER NAMES HIDDEN") — privacy intact
- Session persists across navigation
- No console errors on any visited page

## What's broken
1. **BUG-01 (CRITICAL):** Click-into assignment goes to `/jury/<team_id>` → 404. Should be `/yi-future/jury/<team_id>`. Source: `app/yi-future/jury/page.tsx:110`.
2. **BUG-02 (MEDIUM):** Jury manually visiting /yi-future/me redirected to /yi-future/join (public reg form). Should redirect to /yi-future/jury.

## Verdict
Jury cannot complete their scoring flow because of BUG-01. The full Take Pride Award nomination → score cycle is blocked in production until this href is corrected.
