# YIP — Let removed ("Ex-") leaders run again as nominees

**Decided via interview, 2026-06-25/26. Branch: `feat/yip-ex-renominate` (off latest master incl. #649/#651).**

## Background
When a single-seat leader (PM, Deputy PM, Leader of Opposition, Speaker, Deputy
Speaker) is removed mid-event — by **no-confidence vote**, **impeachment**, or an
**organiser hand-removal** (`deposeToExRole`) — their `parliament_role` flips to the
matching `ex_*` value. This preserves their leadership points. `ex_*` roles are kept
out of `PARLIAMENT_ROLES` so they are system-assigned only.

## Agreed behaviour (the spec)
1. **Let them run again.** Removed (`ex_*`) leaders must be selectable in
   nominee/candidate pickers.
2. **All three removal types treated the same** (no-confidence, impeachment,
   organiser depose): can run again, keep the `Ex-` mark.
3. **Shown with the `Ex-` label** in every picker (`ROLE_LABELS` / `ROLE_COLORS`).
4. **Any post** — an ex-Speaker may run for PM, etc., not only the post they lost.
5. **Points — replace only on a WIN.** Keep kept `ex_*` points through nomination
   AND voting; replace only when the person actually **wins** a new post (role flips
   to the won role; points become that role's points; one value at a time, never
   stacked; ex-Speaker who WINS PM → PM points only). Lose ⇒ keep `ex_*` points.
6. **Scope — all pickers** (Speaker, bench PM/Dep-PM/LoP, party-leader,
   cabinet/shadow).
7. **Block when locked/published** — no opening a nomination/vote once the event is
   `scores_locked` or `results_published_at` is set.

## What the code already did (verified) — so it was NOT changed
- Pools already include `ex_*` (`getPartyMembers` has no role filter).
- Seating already overwrites `ex_*` → won role on a win = the spec's replace-on-win.
  (Agent "preserve ex-status on win" findings were spec misreads — discarded.)
- Bonus config (`yip.position_bonus_config`) already has `ex_*` keys at base-role
  values; points are live from current `parliament_role` ⇒ replace-on-win is automatic.

## What this branch changes (small, additive)
- `vote-manager.tsx`: import `ROLE_LABELS/ROLE_COLORS/EX_PARLIAMENT_ROLES`; add
  `exRoleBadge(m)` helper; render it in all 4 nominee dialogs (party-leader,
  bench/leadership, cabinet/shadow, Speaker tray).
- `voting.ts` `openVote`: block when `results_published_at` set or `scores_locked`
  (mirrors `agenda.ts` reopen guard; `allocation_locked` intentionally NOT checked —
  elections run after allocation lock). Covers all vote types + runoff (calls openVote).
- `voting.ts` `getSpeakerCandidates`: include `ex_speaker`/`ex_deputy_speaker` in the
  role-based ballot fallback.

## SEPARATE pre-existing bug found (NOT fixed here — awaiting decision)
`computeResults()` (results.ts ~197) reads position bonuses via the authenticated
client; `position_bonus_config` has RLS on with no policy ⇒ 0 rows ⇒ it falls back to
handbook defaults (no `ex_*`, and lower base values). It bakes those into the persisted
`avg_score`, which the leaderboard's "Avg Score" + Rank read. Net: **ex-leaders show 0
leadership points on the leaderboard today**, Speaker shows 3 not 5, Deputy-PM 0 not 4,
etc. The Score Sheet tab recomputes from the correct admin config → dual-view mismatch.
Fix = point `computeResults` at `getPositionBonusConfigAdmin`/service read + re-run
compute; **changes scores incl. possibly published events** → needs director sign-off.
