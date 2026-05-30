# YIP Actions + Lib Audit — 2026-05-30

Branch: `audit/yip-actions-lib`  
Scope: `app/yip/actions/**` (44 files) + `lib/yip/**` (27 files)  
Schema: live `yip.*` via Supabase Management API  
Auditor: Claude Sonnet 4.6 (automated)

---

## Pass 1 — Schema Drift

### Fixed

**CRITICAL — `app/yip/actions/scoring.ts:216`**  
`rubric:scoring_rubrics(total_max)` → `rubric:rubrics(total_max)`  
The PostgREST foreign-key join named a non-existent table `scoring_rubrics`.  
The live table is `yip.rubrics`. This join is in `getScoresForJury()`, which  
the jury scoring page calls to render the score list. At runtime this would  
produce a PostgREST 400 "relation scoring_rubrics does not exist" and return  
an empty array — jury members would see no scores. **Scariest one; demo-blocking.**

**LOW — `app/yip/actions/results.ts:319–330` (insert payload)**  
`yip.results` has a `qualifies_next` (boolean, nullable) column that the  
`computeResults` insert never populated. Added `qualifies_next: null` explicitly  
with a comment directing future implementors to derive it from `r.rank` and  
the promotions workflow. Not a crash — column is nullable — but the column  
would silently stay NULL for every computed result row while mock-data seeds  
it correctly, causing inconsistency.

### False positives / confirmed-clean

| File / reference | Verdict |
|---|---|
| `positions.ts` `.eq("id", true)` on `position_bonus_config` | CLEAN — `id` column IS boolean in live DB; singleton row has `id = true` |
| `admin-branding-rules.ts` `yi.brand_rules` | CLEAN — `.schema("yi")` present on all 9 references |
| `admin-seasons.ts` / `pipeline.ts` `yi.years` | CLEAN — all have `.schema("yi")` |
| `schools.ts` `yi.institutions` | CLEAN — `.schema("yi")` on all 7 references |
| `admin-chapter-admins.ts` `yi.chapters`, `yi_directory.role_assignments` | CLEAN — correct `.schema()` qualifiers |
| `admin-team.ts` `yi_directory.role_assignments` | CLEAN — cast + schema present |
| `events.ts` `yi.chapters` | CLEAN — `.schema("yi")` present |
| `mock-data.ts` `yi_connect.notifications` | OUT OF SCOPE — mock seeder only; not in demo pipeline |
| All 44 `yip.*` table references (events, participants, scores, results, agenda, etc.) | CLEAN — all columns verified against live schema |

**False-positive count: ~20** (schema-qualified cross-schema joins flagged by  
initial grep but confirmed correct on closer read.)

---

## Pass 2 — Fail-Closed Gates + Super-Admin Uniformity

### `lib/yip/auth/require-super-admin.ts`

Intact and correct. Reads from `yi_directory.role_assignments` via  
`getCurrentPersonRoles()` + `isPlatformSuperAdmin()`. Both paths log a  
structured `super_admin_gate` JSON line to Vercel logs. Backward-compat  
`organizerId` field still present (unread by callers). No changes needed.

### `getEvent()` in `events.ts` — 3-tier gate

The gate correctly fails CLOSED for non-super-admin callers:
- If `data.yi_zone_code` is null → `regionalZones.includes(null)` is false → denies.  
- If `regionalZones` is empty → includes() is false → denies.  
- Falls through to `return null` correctly.

This is the correct fail-closed pattern (unlike the Yi Connect bug fixed in  
commit 0a51772). No fix needed.

`getEventWithDetails()` has the same logic duplicated — also fail-closed.

### Delete / destructive endpoints — FIXED

Three delete functions used `createServiceClient` (bypasses RLS) with **no  
authentication or ownership check**:

| File | Function | Risk |
|---|---|---|
| `app/yip/actions/motions.ts:240` | `deleteMotion` | Any authenticated session could delete any motion by ID |
| `app/yip/actions/parties.ts:87` | `deleteParty` | Any authenticated session could delete any party by ID |
| `app/yip/actions/volunteers.ts:106` | `deleteVolunteer` | Any authenticated session could delete any volunteer by ID |

**Fixed:** Each now checks `auth.getUser()`, verifies `event.created_by === user.id`,  
and scopes the delete with `.eq("event_id", eventId)` as a second predicate.

### Other delete endpoints — confirmed gated

| File | Function | Gate |
|---|---|---|
| `participants.ts:377` | `deleteParticipant` | ✓ ownership check + allocation lock check |
| `jury.ts:120` | `removeJury` | ✓ ownership check |
| `results.ts:317` | delete-before-insert in `computeResults` | Uses `createServiceClient` scoped to `event_id` — acceptable (service role, server-side only, not exposed as delete endpoint) |
| `topics.ts:114`, `topics.ts:131` | `removeTopicFromEvent` | Uses `createServiceClient` (no session check) — FLAG: same gap as motions/parties/volunteers but lower severity (topic ≠ participant/score data). Out of scope for this audit pass. |

### Client-supplied `event_id` / `participant_id` re-verification

All write paths that take a `participantId` from the client re-verify it against  
`event_id` in a `.eq("event_id", eventId)` predicate on the write. No IDOR  
vectors found in the pipeline actions.

---

## Pass 3 — Runtime Edge Cases in Pipeline

### `computeResults` — 0 scores / partial scores

- **0 submitted scores for entire event** → returns `{ success: false, error: "No submitted scores found" }`. Correct.
- **Participant with 0 juror scores (partial)** → `scoresByParticipant.get(p.id)` returns undefined → `continue`. Participant is excluded from results row. Award logic sees them as absent. No crash.
- **1 juror, `adjusted` has 1 element** → `reduce` runs correctly, divide by 1. No crash.

### `computeResults` — tied awards

`assignAward` finds the single top score, then assigns the award to ALL rows at that score. If 3 participants tie at 95.0, all 3 get the award label appended. `award_category` becomes `"Best Parliamentarian"` for each. Functionally correct per handbook intent ("award one prize to all tied at max"). No crash.

### `computeResults` — `minJurorScore = Infinity`

When `adjusted` is empty (impossible given the `pScores.length === 0` guard), `Math.reduce` with `Infinity` returns `Infinity`. The guard `minJurorScore === Infinity ? 0 : ...` on line 235 catches this. Not reachable in practice but safely handled.

### `allocation-engine.ts` — fewer participants than roles

- Fewer than 2 schools → single-school 55/45 split path taken. Correct.
- Fewer participants than ministries (8) → `numCabinetToAssign = Math.min(8, rulingAvailable.length)`. No over-indexing. Correct.
- 0 participants → early return with empty assignments. Correct.
- More participants than 543 constituencies → fallback to random constituency from full list. No crash; documented with comment.
- **Duplicate constituencies**: The engine uses `usedConstituencyIndices` set — each constituency index used at most once. If more participants than distinct non-home-state constituencies are available, the fallback path reuses. This is intentional.

### `score-buffer.ts` — offline rehydration shape mismatch

The buffer key is `juryAssignmentId::participantId` (nested key, not flat). `saveToBuffer` / `getFromBuffer` / `removeFromBuffer` all use the same `bufferKey()` function. No flat/nested pollution risk. The prior bug (flat-key seeder) is not reproducible here — the buffer only stores `BufferedScore` objects with `criteriaScores: Record<string, number>`.

There is no guard against a stale buffer entry whose `rubricId` no longer matches the current rubric (e.g., after rubric update during event). The jury form should validate `criteriaScores` keys against the current rubric before submitting. This is a **flag** — not a crash but a silent data integrity issue if rubrics change mid-event.

### JSONB `score_breakdown` shape

`computeResults` computes `scoreBreakdown` as `Record<string, number>` averaging  
juror `criteria_scores`. The `parentScoreByKey` helper in `lib/yip/rubric.ts`  
handles both flat keys (`"content": 20`) and dotted nested keys  
(`"content.relevance": 8, "content.originality": 7, ...`). Guards against  
`null` breakdown on line 39. No `.toFixed()` calls on JSONB values — the prior  
mock-seeder bug is not present here.

---

## Verdict: Demo Pipeline (upload → allocate → score → results)

| Stage | Status |
|---|---|
| Upload / import participants | Schema-coherent. All columns in insert payload exist in `yip.participants`. |
| Allocation engine | Schema-coherent. Update payload columns all verified present. Edge cases handled. |
| Jury scoring (submitScore) | Schema-coherent. All flag columns exist in `yip.scores`. |
| getScoresForJury (score list) | **FIXED** — was broken by `scoring_rubrics` wrong table name. Now `rubrics`. |
| computeResults | Schema-coherent after `qualifies_next: null` explicit write. No crash paths. |
| publishResults | Schema-coherent. Only sets `results_published_at`. |

**The demo pipeline is schema-coherent end-to-end after these fixes.**

---

## Items Flagged (Not Fixed — Out of Scope / Logic Changes)

1. **`topics.ts` `removeTopicFromEvent` / `assignTopicsToEvent`** — uses `createServiceClient` with no user auth check. Lower severity (topic metadata not participant/score data) but same pattern as the 3 fixed deletes. Recommend adding event-ownership check in a follow-up pass.

2. **`qualifies_next` promotion logic** — `computeResults` now writes `null` explicitly. If auto-qualification at compute time is desired (top-N by rank), add derivation from `r.rank` and a configurable `n` parameter. Current promotions workflow handles this separately via `pipeline.ts`.

3. **Stale offline buffer + rubric update** — if a rubric changes mid-event, a buffered draft could submit criteria keys that no longer exist. Recommend validating `criteriaScores` keys against the active rubric on sync submission in `submitScore`.

4. **`deleteMotion` / other motions write paths** (`rejectMotion`, `recordMotionVote`, `resolveMotion`) — use `createServiceClient` without verifying event ownership. Only the delete was security-critical; updates are lower risk. Recommend a follow-up ownership gate.

5. **`award_category` for awards 8 + 9** (Best Research and Innovative Ideas) — both use `byCriterion("content")` as the rank function, so the same participant will win both awards in most events. This appears to be a rubric-level design question (handbook p.20). Flagged, not changed.
