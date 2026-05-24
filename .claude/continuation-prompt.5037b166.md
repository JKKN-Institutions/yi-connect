# Continuation Brief — yi-connect (pane 5037b166 → next session)

**Previous session:** 2026-05-23 evening → 2026-05-24 18:55 IST (~10 hours overnight)
**Resume mode:** fresh session after /clear; this brief is the priming. Type `go` to execute.

---

## VERIFY CURRENT STATE (read-only — run BEFORE any action)

These probes detect drift between this brief and reality. Run them first; do not skip.

```bash
# 1. Git state — confirm we're on master with the expected recent shipped work
cd /Users/omm/PROJECTS/yi-connect && git log --oneline -10 && git status --short | head -20

# 2. Auto-assign cron route is live (expect 200 + JSON when CRON_SECRET header is correct)
#    Pull secret from Vercel first, then probe production
vercel env pull /tmp/yi-env-check.production --environment=production --cwd /Users/omm/PROJECTS/yi-connect 2>&1 | tail -5
CRON_SECRET=$(grep -E '^CRON_SECRET=' /tmp/yi-env-check.production | cut -d= -f2- | tr -d '"')
curl -sS -o /tmp/cron-probe.json -w "HTTP %{http_code}\n" \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://www.jkkn.ai/yi-future/api/cron/auto-assign-problems && cat /tmp/cron-probe.json

# 3. Confirm migration 20260523194500_add_team_picks_deadline landed in production Supabase
#    (shared yi-platform DB: bkmpbcoxbjyafieabxao, yi_connect schema)
SUPABASE_TOKEN=$(cat ~/.supabase/access-token)
curl -sS -X POST "https://api.supabase.com/v1/projects/bkmpbcoxbjyafieabxao/database/query" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='\''yi_connect'\'' AND table_name='\''editions'\'' AND column_name='\''team_picks_deadline'\'';"}'

# 4. Yi Future login page is reachable on production (route-group + middleware not regressed)
curl -sS -o /dev/null -w "yi-future/login HTTP %{http_code}\n" https://www.jkkn.ai/yi-future/login
curl -sS -o /dev/null -w "yi-connect-app login HTTP %{http_code}\n" https://yi-connect-app.vercel.app/login

# 5. View shims present in public schema (sanity check Phase D substrate)
curl -sS -X POST "https://api.supabase.com/v1/projects/bkmpbcoxbjyafieabxao/database/query" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"SELECT count(*) AS view_count FROM information_schema.views WHERE table_schema='\''public'\'' AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema='\''yi_connect'\'');"}'
```

Expected: all HTTP 200, column `team_picks_deadline` of type `timestamp with time zone`, view_count ~140+. If anything diverges, STOP and report before acting.

---

## KEY DECISIONS (with rationale — do not re-litigate)

1. **PS-per-team** — each team picks exactly one problem statement. Director-locked via AskUserQuestion + screenshot reply. Rationale: prevents thrash on multi-PS team scope.
2. **Teams form first, then pick PS** — no admin gate. Rationale: lower friction; chapters self-organize.
3. **Shared PS allowed** — two teams can pick the same PS. Rationale: diverse approaches enrich the chapter final.
4. **Auto-assign on deadline miss** — cron picks PS using captain's `preferred_track_slug` with fewest-teams-in-chapter tiebreak. Rationale: no chapter falls behind because of one absent captain.
5. **Phase D both-shim-AND-refactor (not either-or)** — view shims closed user-visible regressions in 5 min; the 5-agent refactor (143 files, ~1544 `.schema('yi_connect')` calls across PRs #210–#214) cleaned up the explicit calls behind it. Rationale: ship the user fix immediately, fix the code structure in parallel.
6. **Sandbox test account is OK** — `test-chair@yi-future-demo.com / TestChair2026!` is permitted for workflow testing; password is in git on purpose (sandbox-only). Account must NEVER be granted real privileges.

If a decision needs revisiting, re-run AskUserQuestion with the current context. Do NOT silently downgrade.

---

## WHAT'S NEXT (user's priorities, captured verbatim from /cnext interview)

User picked **all three P0 options + keep everything + read all priming sources**. Per CLAUDE.md rule: when the Director picks multiple from a numbered list after a 5x-focus prompt, treat as "all of them" and execute in stated order with parallel non-overlapping subagents where safe.

### A) Verify last night's work in CFT (do first)
- Open `https://www.jkkn.ai/yi-future/login` in Claude-in-Chrome; sign in as `test-chair@yi-future-demo.com / TestChair2026!` AND as a fresh delegate
- Confirm in browser (not just HTTP probes):
  - PS picker allows two teams to share the same PS without error
  - Teams form BEFORE PS pick (no admin gate visible)
  - Jury cross-chapter scope view stays in chapter via `teams!inner` filter (`chapter/jury/page.tsx`)
  - National admin sidebar shows "Teams" and "Unteamed Delegates" entries
  - Logout dropdown works (UserMenu in `components/navigation/user-menu.tsx`)
- Verify PRs #204–#209 fixes are still live (8 yi-future bugs from pane 7e93ed5a)
- Confirm Phase D regressions NOT recurring (sidebar, menus, `getUserProfile`)

### B) Continue Yi Future polish
- Jury cross-chapter UX — already fixed in code; verify in browser then polish copy
- Unteamed-delegates page (`app/yi-future/national/admin/delegates/unteamed/page.tsx`, 402 lines NEW) — walk through chair workflow, fix any awkward steps
- Team drill-down (`app/yi-future/national/admin/teams/[id]/page.tsx`, 513 lines NEW) — confirm participants/status/PS/captain all visible
- Auto-assign cron observability — add a success log surface (Director-readable, not just JSON-from-curl)

### C) Tackle Phase D adjacent regressions
- Sidebar gap audit — diff pre-monorepo sidebar against current; find missing menus
- Stale data hooks — find React Query calls still expecting `public.X` shape (after view shims drop)
- View-shim audit — `public.X` views are stopgap; identify which can be safely dropped now that consumers explicitly call `.schema('yi_connect')`

Spawn parallel agents for A vs B vs C where the file scopes don't overlap.

---

## SUBSTRATE ITEMS (Gate 5 — verify these landed)

- Migration `supabase/migrations/20260523194500_add_team_picks_deadline.sql` applied to production Supabase (adds `editions.team_picks_deadline TIMESTAMPTZ`)
- ~144 `public.X` view shims over `yi_connect.X` tables (concurrent-pane work + this pane)
- 3 public tables dropped due to shim collision: `events`, `notifications`, `schools` (Director-approved destructive op)
- Vercel env var `CRON_SECRET` set across production/preview/development via `printf "%s" | vercel env add` (echo version 401'd for 5 min — see memory entry)
- 163-file `revalidatePath` sweep (commit `4e396fd`, concurrent pane `7e93ed5a`) — route-prefix corrections after route-group moves

NO new RLS policies. NO new permission keys. NO chain-run required.

---

## CRITICAL SAFETY NOTE

The seed script bug (Supabase `GET /auth/v1/admin/users?email=X` ignores the query param and returns the first user) silently rotated `boobalan.a@jkkn.ac.in`'s password during this session. Mitigated (Google OAuth, local password is inert) and patched via PR #203 (Management API SQL). Memory entry: `feedback_supabase_admin_users_email_filter_broken.md`.

**The same anti-pattern may exist in other yi-* and MyJKKN seed scripts.** Worth a `grep -rn "admin/users?email=" scripts/` sweep across yi-connect AND MyJKKN repos, but not urgent — schedule when bandwidth allows.

---

## OPEN THREADS

- `/auth/v1/admin/users?email=X` anti-pattern sweep across other yi-* and MyJKKN seed scripts (see Critical Safety Note above)
- Auto-assign cron has only fired against the **Sandbox edition** — needs to run against the real 2026 edition once `team_picks_deadline` is set in production data
- Worktree dirt in `.claude/worktrees/agent-a*` — 30+ leftover dirs from tonight's parallel agents; concurrent pane handled a 52-worktree cleanup but new ones accumulated

---

## CONSTRAINTS

- Director (user) is a non-coder; do not block on technical questions, decide and proceed per CLAUDE.md rule 1 + Autonomous Decision Protocol
- Auto-save hook is active; wip commits will accumulate — recover polluted feature branches via `git push --force-with-lease`, NEVER amend through autosave commits
- Worktree dirt in `.claude/worktrees/` — 30+ leftover dirs; surface a cleanup task but only execute if user signals "yes"
- Production = live source only (CLAUDE.md rule 15). Verify via `git show jicate/main:file` or `curl https://www.jkkn.ai/...`. Never from `/tmp`, local worktrees, or memory.

---

## MUST-READ BEFORE STARTING (user picked "all")

- This brief (already loaded by SessionStart hook)
- `progress.txt` top 4 lines (multi-pane history; concurrent pane 7e93ed5a overlapped tonight)
- `docs/Module-*.md` (re-anchor on module specs; Phase D may have drifted code from spec)
- `docs/yi_chapter_prd_summary.md` — Yi Future portion especially

Once verified state matches expectations, proceed to **A → B → C** in parallel where file scopes don't overlap. Type `go` to begin.
