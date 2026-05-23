# Yi Connect — Continuation Brief from 2026-05-23 (pane 7e93ed5a)

## ONE-LINE GOAL
Verify production end-to-end as a real Chair user — walk yi-connect-app.vercel.app through unlock → dashboard → event create → submission to validate today's ~110 fixes feel right to a human, not just to REST/TS.

## WHERE WE ARE

Today was a marathon ~110-bug sweep across 5 batches with 24 parallel worktree agents. 21 named commits landed on master (now @ ad6ed8c after session-end push). TypeScript is clean across the entire repo, build is green, and Agent Y verified 22/22 production routes return 200/307 with zero 500s and zero console errors. Production is live at https://yi-connect-app.vercel.app.

Two big infrastructure milestones landed: (1) Yi data migration completed end-to-end — ~440 rows moved OLD → NEW Supabase `bkmpbcoxbjyafieabxao`, 83 new auth.users provisioned (76 → 159), all FK links restored via 2-pass REST strategy; (2) Sentry observability is fully wired — `jkkn-em/yi-connect` project created via CFT, DSN set across all Vercel envs, test JS error captured end-to-end and visible in issues. Four DB migrations applied: `future.chapters` view (unblocked 17 yi-future pages via the PostgREST cross-schema embed workaround), `members.full_name` denorm column + sync trigger, 4 `access_code` CHECK constraints, and a graceful succession-module stub (saved -3727 lines while preserving 87 fn signatures).

`/yi-future/unlock` route is wired and verified live with access codes 9G299Q (captain), DEMO26 (member), 64SZSM (mentor), and TSTJRY (jury seeded for testing). The remaining latent surface is small: Agent W's audit shows ~64 broken embeds still scattered across low-priority files, plus ~24 worktree directories to clean up.

## VERIFY CURRENT STATE (run these read-only commands first)

```bash
# 1. Confirm branch + HEAD match the brief
cd /Users/omm/PROJECTS/yi-connect && git log --oneline -5
# Expected: ad6ed8c (or later wip) at top

# 2. Confirm production is live + healthy
curl -sI https://yi-connect-app.vercel.app | head -2
# Expected: HTTP/2 200 or 307 (no 5xx)

# 3. Confirm migration data landed in NEW Supabase
curl -s "https://bkmpbcoxbjyafieabxao.supabase.co/rest/v1/members?select=count" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY /Users/omm/PROJECTS/yi-connect/.env.local | cut -d= -f2)" \
  -H "Prefer: count=exact" -I | grep -i content-range
# Expected: content-range: 0-83/84 (or similar; was 84 members post-migration)

# 4. Confirm /yi-future/unlock is reachable
curl -sI https://yi-connect-app.vercel.app/yi-future/unlock | head -2
# Expected: HTTP/2 200

# 5. Confirm TypeScript still clean
cd /Users/omm/PROJECTS/yi-connect && npx tsc --noEmit 2>&1 | tail -3
# Expected: no output (or only node_modules noise)

# 6. List leftover worktree dirs (housekeeping awareness)
ls /Users/omm/PROJECTS/yi-connect/.claude/worktrees/ | wc -l
# Expected: ~24 directories
```

## NEXT TASKS (priority order)

1. **[P0 — user-stated VERBATIM] Verify production end-to-end as a real Chair user**
   - Open https://yi-connect-app.vercel.app/yi-future/unlock in a real browser
   - Test all 4 access codes in sequence: `9G299Q` (captain), `DEMO26` (member), `64SZSM` (mentor), `TSTJRY` (jury)
   - For each role, walk the actual day-in-the-life flow: unlock → /me dashboard → /me/team → /me/submissions → create event → submit deliverable
   - Capture any 500s, broken embeds, blank panels, or "feels wrong" moments to screenshot + GitHub issue
   - Verify on actual phone for Module 11 PWA / mobile experience (not just desktop)
   - **Done = Chair (or Director playing Chair) confirms full flow works end-to-end without surprises; any findings documented as new bugs.**

2. **[P1 — Director-gated] AWS GitHub Secrets + Sentry source-map upload**
   - Director needs to set: 5 AWS GitHub Secrets (for deferred backup workflow) + 1 `SENTRY_AUTH_TOKEN` in Vercel for source-map upload
   - Once Director confirms, autonomous verification: trigger Sentry source-map upload via deploy, then throw a test error and verify symbolicated stack trace appears in Sentry issues
   - If Director still defers, leave it; revisit next session

3. **[P1 — autonomous] Seed jury_assignments + chapter final events for The Smart Warriors**
   - Needed so the full Take Pride Award nomination-to-award cycle is E2E-testable
   - Seed: 3-5 jury_assignments rows linked to TSTJRY jury member + create 2 chapter final event rows under The Smart Warriors chapter
   - Verify: log in with TSTJRY code → jury dashboard shows pending nominations → can score → leaderboard reflects scores

4. **[P2] Cleanup test artifacts in production DB**
   - Agent J left: 1 TSTJRY jury row + 1 Phase A draft submission on Smart Warriors
   - Only delete after Director explicitly confirms — these may still be useful for ongoing E2E tests

5. **[P2] Address remaining 64 latent embed bugs** (Agent W audit)
   - Most are scattered low-priority across files no Chair touches daily
   - Strategy: only fix if a user-facing impact is discovered during task 1 verification; otherwise defer
   - If batch-fixing later, reuse the 24-agent decomposition pattern from today

6. **[P3] Worktree cleanup** (~24 directories from today's agents)
   - `rm -rf /Users/omm/PROJECTS/yi-connect/.claude/worktrees/agent-*` after confirming no pending commits
   - Pure housekeeping; not blocking anything

## KEY DECISIONS

**Why the 24-agent relentless decomposition pattern worked:** Each agent got non-overlapping file/cluster ownership, made exactly one named commit, and worked in an isolated git worktree. Five batches of ~5 agents fixed ~110 bugs with zero merge conflicts because the orchestrator pre-partitioned the file graph before fan-out. The pattern is now reusable for any large bug-sweep task — see today's commit history (5390592 through 143d850) for the cluster boundaries.

**PostgREST cross-schema embed → same-schema VIEW pattern** (today's biggest unlock): PostgREST's `.select("child(...)")` only resolves embeds within the from-clause schema. When yi-future tables needed to embed `yi_connect.chapters`, the fix wasn't to rewrite the query — it was to create `future.chapters` as a VIEW that proxies `yi_connect.chapters`. Single migration unblocked 17 yi-future pages. Saved as memory: `feedback_postgrest_cross_schema_embed.md`.

**DB denormalization over consumer refactor:** When an embed-shape fix would touch 5+ consumer files, the answer is to add a denormalized column + sync trigger at the DB layer instead of refactoring every consumer. Today this saved a 13-file refactor on `members.full_name`. Saved as memory: `feedback_denormalize_over_refactor.md`.

**Brief scope verification:** This morning's brief claimed 65 chapters; a 30-second REST count showed the actual number was 4 (only Yi Erode is real, plus a few test chapters). Catching this BEFORE accepting Director-locked tooling/strategy prevented hours of over-engineered work. Always run REST count or DB query against the live system before trusting brief scale claims. Saved as memory: `feedback_verify_brief_scope_before_strategy.md`.

**Probe verdict:** healthy. Context stayed sharp throughout today's marathon — no rot symptoms, no forgetting, no repetition.

## MUST READ FIRST

User answered "all — read everything the brief surfaces". Read in this order before starting task 1:

1. `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/MEMORY.md` — full memory index, especially the 3 new ones added today
2. `/Users/omm/PROJECTS/yi-connect/.claude/sessions/7e93ed5a.md` — full body of today's session (21 commits, 5 batches, lessons learned)
3. The 3 new memory files in detail:
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_postgrest_cross_schema_embed.md`
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_denormalize_over_refactor.md`
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_verify_brief_scope_before_strategy.md`
4. `/Users/omm/PROJECTS/yi-connect/CLAUDE.md` — project rules (module-by-module workflow, mandatory `nextjs16-web-development` + `advanced-tables-components` skills)
5. `/Users/omm/PROJECTS/yi-connect/progress.txt` — top 10 lines for cross-pane awareness

## OPEN QUESTIONS FOR USER

Surface via AskUserQuestion BEFORE starting task 1:

- **Task 1 scope — who drives?** "End-to-end Chair verification" — does Director want to walk through the flows themselves (best for catching 'feels wrong' moments), or want me to drive it via CFT browser as Director's session and capture screenshots for Director to review? CFT can execute actions but can't judge UX quality — Director's eyeballs matter for this one.
- **Task 2 — secrets status?** Has Director set the 5 AWS GitHub Secrets + 1 `SENTRY_AUTH_TOKEN` in Vercel yet? If yes, I'll run verification autonomously. If no, defer to next session and proceed straight to task 3.
- **Director-deferred items reminder:** Old Supabase project `jxvbjpkypzedtrqewesc` decommission is scheduled for **2026-06-23** — confirm still on track or push out?
