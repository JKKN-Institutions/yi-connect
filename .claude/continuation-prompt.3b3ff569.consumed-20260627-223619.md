# CONTINUATION BRIEF — YIP Committee Room + Official Bill Template (PR #688)

## TOP PRIORITY (verbatim user P0)
User answered **"ALL ABOVE 3"** = do all three, in order: **(1)** verify the preview
build is green + run the full official-9-section CFT click-through on the REAL demo
event, **(2)** get PR #688 review-ready to merge, **(3)** polish the form-mirror bug.
Drops: **"Nothing — carry it all."** (Keep PR #688, the staged demo test setup, the
official-template alignment, the pending cleanup.)

## CURRENT STATE (all shipped to the PR, preview GREEN)
- **PR #688** `feat(yip): Committee Room` — branch `yip-committee-room` (off master after
  #687). https://github.com/JKKN-Institutions/yi-connect/pull/688
  Preview: `https://yi-connect-app-git-yip-committee-room-jkkn-institutions.vercel.app`
  Last Vercel build = **PASS** (commit `56cbb106`, the official-template alignment).
- **Two features in the PR, both built + type-clean (tsc 0 errors) + live-migrated:**
  1. **Committee Room** `/yip/me/committee` — Bill / Discuss / Amend / Roles + Day-2 mode;
     amendments (propose→vote→chair/lead accept folds into clause); organiser view at
     `/yip/dashboard/events/[id]/committee/[committee]`; provisions→`{id,text}[]`;
     `bill_amendments`/`bill_amendment_votes` (service-role-only); `chat_messages.thread_key`;
     seeder fixed (creates scoreable agenda sessions so mock events don't compute to 0);
     `/yip/me/bill` redirects in. Migration `20260627205000_yip_committee_room` (LIVE).
  2. **Official 9-section bill template** — migration `20260627220000_yip_bill_official_template`
     (LIVE) added preamble/definitions/funding_budget/conclusion + objectives `{id,text}[]`;
     Room Bill tab now: Title·Preamble·Definitions·Objectives(2-4)·Key Provisions·Implementation
     Plan·Funding/Budget·Expected Impact·Conclusion. Word template + Report annexure match.
     New→legacy columns MIRRORED (preamble→problem_statement, joined objectives→objective).
- **Amendment lifecycle proven** end-to-end on mock data (propose→vote→accept-fold→cleanup).
- **Partial browser CFT done** as the chair on the MOCK event earlier (title/objective/problem
  saved + verified in DB) — but that was the OLD 6-field form and the mock event; the
  OFFICIAL 9-section CFT on the real demo event is NOT yet done.

## ⚠️ STAGED TEST SETUP ON REAL DATA — run CFT then REVERT (user said keep it)
Event **Erode Demo final** `f64e7433-eeb1-4b37-804b-5de2b4a755e4` (draft demo, real non-mock),
committee **"Ministry of Education"** is set up for the CFT:
- **Chair** access code `C6PQTP` (S.Sowbarnika, id `b59e8fa7-9e07-49a0-9d66-e4961ca305bd`,
  promoted to `committee_chair`).
- **Member** access code `3JGBPT` (Saya Devi K, id `2a4970c7-bf58-479d-b9ac-bcbe1c9fb24f`).
- `allow_bill_before_report=true` on the event (drafting unlocked).
- No live phase (no presentation-mode block); committee had NO bill (safe).
**After the CFT, REVERT (mandatory — real demo data):**
```
UPDATE yip.participants SET parliament_role='mp' WHERE id='b59e8fa7-9e07-49a0-9d66-e4961ca305bd';
UPDATE yip.events SET allow_bill_before_report=false WHERE id='f64e7433-eeb1-4b37-804b-5de2b4a755e4';
DELETE FROM yip.bills WHERE event_id='f64e7433-eeb1-4b37-804b-5de2b4a755e4' AND committee_name='Ministry of Education';
```

## TASKS (numbered, in order)
1. **[P0·small] Verify build green** — `gh pr checks 688` (Vercel = pass). Already green at
   handoff; re-confirm in case of new pushes.
2. **[P0·med] Official 9-section CFT** on the preview, committee "Ministry of Education":
   browser-login as chair `C6PQTP` at `/yip/join` → `/yip/me/committee` → fill all 9 sections
   (Title, Preamble, Definitions, 2 Objectives via the +, 3 Provisions, Implementation,
   Funding, Impact, Conclusion) → Roles tab assign a presenter → readiness all green → as
   member `3JGBPT` propose+vote an amendment → back as chair accept (verify fold) → Submit.
   Screenshot key steps. Then **REVERT** (block above). Chrome tools are deferred — ToolSearch
   the `mcp__claude-in-chrome__*` core set first. Preview has NO Vercel auth wall.
3. **[P0·small] Get PR #688 review-ready** — confirm both migrations are recorded as files,
   tsc clean on MAIN tree (`cd /Users/omm/PROJECTS/yi-connect && npx tsc --noEmit` after the
   worktree branch is reachable), then merge to master (squash) on user's go.
4. **[P0·med] Polish the form-mirror bug** — Bill tab blanks a field after rapid sequential
   edits because the create-on-first-write reload changes `bill.id` → the `useEffect` resets
   `fields`. DATA is safe in DB; only the UI mirror blanks until refresh. Fix: don't reset the
   form on every bill.id change (e.g. only initialise once, or merge unsaved local edits). File:
   `app/yip/me/committee/committee-client.tsx` (`buildFields`/`setFields` useEffect ~line 299).
5. **[P1·small] Compact MEMORY.md** — it's 20.3KB (read limit 24.4KB). Trim to <17.1KB:
   one line per entry, merge/drop stale ones.

## KEY DECISIONS (locked)
- Committee Room sign-off (earlier): no-chair fallback=lead_drafter else organiser; amendment
  carry=chair/lead decides (tally is advice); min 3 provisions; `/yip/me/bill` redirects in.
- Official template: **full align now in PR #688**, sections **exactly as the template** (drop
  separate Problem Statement → folded into Preamble). Mirror new→legacy so old consumers
  (dashboard/control/projector) keep working without churn.
- `/yip/me/ministry` (cabinet desk) intentionally NOT touched — different feature.
- probe_verdict: not-run (continuous session, strong recall; trust this brief).

## MUST-READ FIRST
- Memory: `project_yip_committee_room.md` (full feature + official-template + the form-mirror
  polish note), `feedback_rsc_server_component_in_client.md` (the build-gate lesson this
  session — server component in a client file breaks `next build`, tsc misses it),
  `feedback_worktree_build_gate_turbopack.md`, `feedback_yip_scoring_namespaced_keys_consumers.md`.
- CLAUDE.md YIP auth/gotchas blocks. Spec: `docs/yip-committee-room-spec.md`.
- Key files: `app/yip/actions/committee-room.ts`, `app/yip/me/committee/committee-client.tsx`,
  `lib/yip/bill-provisions.ts`, `lib/yip/bill-template.ts`,
  `supabase/migrations/20260627205000_*` + `20260627220000_*`.

## VERIFY CURRENT STATE (run before building)
- `gh pr checks 688` — Vercel = pass.
- `git -C /Users/omm/PROJECTS/yi-connect/.claude/worktrees/yip-nominee-ex log --oneline -3` —
  HEAD should be `56cbb106` (official-template) atop the Committee Room commit.
- DB (Mgmt API, token `~/.supabase/access-token`, ref `bkmpbcoxbjyafieabxao`): confirm the 5
  new bills columns exist (preamble/definitions/funding_budget/conclusion/objectives) and the
  Erode Demo final setup is still staged (chair C6PQTP = committee_chair, allow_bill_before_report=true).
- Build gate: worktree `npx tsc --noEmit` (works here, node_modules symlinked); the Vercel
  preview build is the REAL gate (it caught the RSC boundary bug tsc missed).
