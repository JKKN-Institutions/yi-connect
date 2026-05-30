# YIP Jury + Participant Audit — 2026-05-30

Audited by: code-review agent (Sonnet 4.6)
Branch: audit/yip-jury-participant
Scope: app/yip/jury/**, app/yip/me/**, app/yip/join/**, app/yip/event/**/display, app/yip/login/**, app/yip/_components/**

---

## Pass 1 — Schema Drift

### FIXED: `scoring.ts` — `getScoresForJury` joins wrong table name

**File:** `app/yip/actions/scoring.ts` line ~215

```
rubric:scoring_rubrics(total_max)   ← WRONG
rubric:rubrics(total_max)           ← CORRECT (fixed)
```

The table in the `yip` schema is `rubrics`, not `scoring_rubrics`. The incorrect join silently returns `null` for every `rubric` field in the history response. Effect: every `ScoreCard` in the History tab displayed `{score}/100` instead of the actual rubric max (the history client falls back to `score.rubric?.total_max ?? 100`). **Fixed.**

### Verified clean columns across all critical tables

| Table | Columns queried in code | Live schema | Status |
|---|---|---|---|
| `yip.participants` | `id, full_name, school_name, parliament_role, party_side, committee_name, event_id, access_code, ministry, constituency_name` | All present | OK |
| `yip.jury_assignments` | `id, jury_name, event_id, is_active, access_code, email` | All present | OK |
| `yip.scores` | `id, jury_assignment_id, participant_id, event_id, rubric_id, agenda_item_id, criteria_scores, total_score, comments, status, submitted_at, updated_at, flag_no_confidence_brought, flag_walkout, flag_ruckus, flag_suspension, is_mock, position_bonus` | All present | OK |
| `yip.events` | `id, name, level, status, chapter_name, day1_date, scores_locked, current_agenda_item_id, live_timer_end, live_timer_running, results_published_at, oath_text, live_banner_text, live_banner_active` | All present | OK |
| `yip.rubrics` | `id, target_role, criteria, total_max, is_default` | All present | OK |
| `yip.score_audit` | `score_id, previous_scores, previous_total, new_scores, new_total, changed_by, reason` | Table exists | OK |

### False positives

- `listJuryLoginEvents` selects `level` from `events` — `level` is a USER-DEFINED enum, not a plain text column. The TypeScript cast to `string` in the return type is a simplification. This is a type looseness issue, not a runtime failure (Postgres returns the enum value as a string).
- `from("events")` in `projector-display.tsx` is accessed via the anon client (no auth context). Row-level security policy behavior not audited here — that is in the supabase migrations domain. The query itself selects only public display fields.

---

## Pass 2 — Auth Gates

### FIXED: `join/page.tsx` missing `method="post" action="#"`

**File:** `app/yip/join/page.tsx`

The credential-leak fix (CLAUDE.md memory entry `feedback_chapter_lead_login_broken.md`) was applied to `app/yip/jury/login/login-client.tsx` and `app/yip/login/page.tsx` but not to `app/yip/join/page.tsx`. A browser GET fallback on the access-code form would append the code to the URL bar and browser history. **Fixed** — added `method="post" action="#"` to the form element.

### Jury login — scope is correctly enforced

`juryLoginByEmail` in `auth.ts`:
- Filters by BOTH `email` AND `event_id` in one query with `.maybeSingle()`.
- Checks `is_active === false` before issuing the cookie.
- Sets the session cookie scoped to the specific `event_id`.

The jury layout at `app/yip/jury/(authed)/layout.tsx` reads `yip_session` and requires `type === "jury"`, `id`, `name`, and `eventId` all to be present. A juror cannot see another event's data because all downstream queries (`getScoresForJury`, `getScoreForParticipant`, `getCurrentSpeaker`, etc.) are parameterized by `session.eventId`.

No fail-open found for jury-event scoping.

### Access code path — no bypass found

`validateAccessCode` in `auth.ts`:
- Validates length (3–10 chars) before hitting the DB.
- Queries participants first, then jury_assignments with `.single()` / `.maybeSingle()` — a code that returns multiple rows would error, not succeed with a wrong identity.
- Both participant and jury cookies use `httpOnly: true`, `sameSite: "lax"`, `secure: true` in production.
- Jury code additionally checks `is_active` before issuing the cookie.

No bypass found.

### Projector view — no score/PII leak

`app/yip/event/[id]/display/projector-display.tsx`:
- Reads from `events`, `agenda`, `agenda_speakers`, `participants`, `questions`, `bills`, `vote_sessions`, `votes` — all via the anon Supabase client.
- Exposed participant fields: `full_name`, `parliament_role`, `party_side`, `constituency_name`, `constituency_state`, `school_name` — consistent with a public name-board display, no phone/email/parent_phone exposed.
- No `scores` table is read anywhere in this component.
- Vote tallies are shown only when `isRevealed` (vote_session.status = revealed), which is controlled by the organizer action. Not pre-emptively exposed.

No PII or score-in-progress leak found.

### Login forms — `e.preventDefault()` present

Both `app/yip/login/page.tsx` and `app/yip/jury/login/login-client.tsx` have `e.preventDefault()` as the first line of `handleSubmit`. `app/yip/join/page.tsx` also has `e.preventDefault()`.

---

## Pass 3 — Silent Failure on Mobile Jury

### Score submit — feedback is present and correct

`components/yip/scoring/score-form.tsx`:
- Both Save Draft and Submit buttons set `saving` / `submitting` state and show a `Loader2` spinner during the async call.
- On success: `removeFromBuffer` is called and `lastSaved` is set with a timestamp shown via `CheckCircle2` icon.
- On error: `setError(result.error ?? "Failed to save")` renders a red border div immediately below the form.
- On network exception: `setError("Network error. Your scores are saved locally.")` — explicitly tells the jury the score was buffered offline.

No silent failure found on submit.

### Scores-locked guard — dual layer

1. Client: `JuryScoringClientInner` tracks `eventLocked` state, receives it as `initialEventLocked` from the server and subscribes to realtime `postgres_changes` on the `events` row. When locked, `handleSubmit` returns `{ success: false, error: "Scoring has been locked..." }` before calling the server action.
2. Server: `submitScore` in `scoring.ts` independently fetches `events.scores_locked` and returns an error if true.

Both layers match and are consistent.

### Button disabled logic — no stale-state trap for Submit

The Submit and Save Draft buttons in `score-form.tsx` are disabled only when `saving || submitting`. They are NOT gated on a separate `isComplete` / `isValid` React state that could be left in a bad state by automation. Score sliders initialize to 0, so a juror can submit even with all-zero scores (intentional — zero is a valid score).

The `handleSubmit` early return `if (!activeParticipant || !rubric)` in `jury-scoring-client.tsx` is the only other gate, and it returns an explicit error object rather than silently no-oping.

### Offline sync — no dropped scores

`use-offline-sync.ts`:
- On mount, flushes any buffered drafts immediately if online.
- On `window.addEventListener("online", ...)`, auto-flushes.
- Failed flush entries are left in the buffer (not removed) so they retry on next reconnect.
- The `flushingRef` guard prevents concurrent flushes from racing.
- Counts pending entries every 10 seconds — badge stays accurate.

No score-drop path found.

### Participant picker — no crash on empty list

`getScoreableParticipants` filters `.not("parliament_role", "is", null)`. If it returns empty, the picker renders the toggle button in its collapsed state and shows no list. No crash.

### Radix SelectItem crash (empty string)

The jury login form uses a native `<select>` element (not Radix `Select`), so the empty-string `<option value="">` default is a valid HTML pattern and does not crash.

---

## Risk Assessment for June 4 Mizoram Demo

| Item | Risk | Status |
|---|---|---|
| `scoring_rubrics` wrong table name in history | HIGH — wrong max score shown | FIXED |
| `join/page.tsx` missing `method="post"` | MEDIUM — credential URL leak | FIXED |
| Score submit silent failure | CRITICAL — would be catastrophic live | Clean — explicit feedback on every path |
| Juror sees wrong event | CRITICAL | Clean — email+event_id double-lock |
| Scores visible on projector | HIGH | Clean — no `scores` read in display |
| Offline buffer drops scores | HIGH | Clean — retry-on-reconnect pattern |
| Scoring locked UX confusing | MEDIUM | Clean — two-layer guard with explicit banner |

---

## Files Changed

1. `app/yip/actions/scoring.ts` — fix `scoring_rubrics` → `rubrics` in `getScoresForJury`
2. `app/yip/join/page.tsx` — add `method="post" action="#"` to access-code form
