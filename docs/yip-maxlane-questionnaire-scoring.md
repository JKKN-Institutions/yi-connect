# Scoring the selection questionnaire on MyJKKN's ₹0 Max lane

> **What this is.** A handoff spec for moving questionnaire scoring off the
> external claude.ai routine described in [`yip-ai-routine.md`](./yip-ai-routine.md)
> and onto **MyJKKN's shared ₹0 Max lane** — the engine already behind the
> `bug.*` / `reply.draft` tasks, whose console lives at
> `jkkn-centralized-bug-reporter.vercel.app/org/jicate-solution/ai`.
>
> Nothing here has been applied. Every step below is written so a human can
> read it, disagree with it, and run it.

---

## 0. Why bother, and the one thing that will bite you

The Max lane is the right home: **₹0 by construction**, queue + drain already
built, and Yi Connect is already a registered app on the console, so it needs
**no new credential** — it reuses the bug-reporter API key it already has.

**The trap.** The build spec promises adding a task is *"one row in
`ai_job_types` + add its key to an app's `ai_allowed_tasks`. No code change."*
**That is not true today.** The console's public API gates on a hardcoded list:

```ts
// jkkn-centralized-bug-reporter/app/api/v1/public/ai/run/route.ts
if (!allowed.includes(task) || !AI_TASK_KEYS.includes(task))   // → 403
```

`AI_TASK_KEYS` is derived from a frozen `FALLBACK_AI_TASKS` array in
`lib/ai/tasks.ts`. A sixth task will appear in the console's tick-list, save
fine, and then fail at runtime with **`403 task_not_permitted`**.

This already happened once: `ops.brief` was `external_allowed` on MyJKKN for
weeks while invisible to every app, for exactly this reason. **Budget for the
console PR from the start** — it is the difference between "works" and "403s
silently."

Verified against production on 2026-08-16: `ai_job_types` has exactly five rows
with `external_allowed = true`, matching that hardcoded list precisely.

---

## 1. Sizing — checked against the real papers, not assumed

The external door rejects payloads over **32,768 bytes**. Measured across the
180 SRTN papers (question text + answer text per paper):

| Post | Papers | Questions | Largest paper | Average |
| --- | --- | --- | --- | --- |
| Parliamentary Administrator | 43 | 10 | **8,253 B** | 4,035 B |
| Party Leader | 80 | 6 | 5,131 B | 3,086 B |
| Speaker | 57 | 6 | 5,103 B | 2,715 B |

The worst real paper is **8.2 KB — a quarter of the ceiling**. So **one job per
paper** is safe, with room for the prompt on top. Splitting a paper across jobs
would be wrong anyway: two of the five red flags ("unnaturally uniform structure
across this candidate's answers", "no correct YiP-specific detail anywhere")
can only be judged with the whole paper in view.

Note the theoretical worst case is larger — `MAX_ANSWER_CHARS` is 4,000, so ten
maximal answers would be ~40 KB and would 413. Nobody writing for 30 minutes has
come close, but a future post with more questions should be re-measured rather
than assumed.

---

## 2. Throughput — what 180 papers actually costs

- External jobs enqueue at **priority 500**; MyJKKN's own work is **100**.
  Lower wins, so **MyJKKN always jumps the queue.**
- The runner is **one Windows machine** with a Claude Max seat. There is no paid
  fallback. **If it is off, jobs sit `pending` forever** — `fn_ai_requeue_stale`
  only touches `claimed`/`running` rows, so nothing ever times out a pending job.
- The **60 requests/minute rate limit is on the shared console key**, not per
  app. 180 enqueues + polling competes with every other app on the platform.

At `max_inflight = 4` and ~40 s per paper, 180 papers drain in roughly **30
minutes of clear lane**. That is fine for scoring overnight or between rounds.

**It is not fine for anything needed during a live round.** This is a queue you
wait on, not an API you call. Keep that in mind before making any part of an
event-day flow depend on it.

---

## 3. The task recipe

Modelled on `MyJKKN/.claude/reply-draft-max-lane-2026-08-08.sql`, the proven
external-door recipe. **Applied by hand via the Supabase Management API against
MyJKKN (`kvizhngldtiuufknvehv`), not as a numbered migration** — that is the
established habit for this table (`ops.brief` and `reply.draft` both have no
migration file). Keep a copy at `MyJKKN/.claude/` to match.

`provider` / `model_id` are cosmetic on this path — the external door overrides
them to the Max subscription regardless. They are set to `sonnet` to record the
intent: this is a judgement task about minors' selection, not a summarisation.

```sql
-- yip.questionnaire_score — external Max-lane task for Yi Connect (YIP).
--
-- Scores ONE selection-questionnaire paper against the YIP rubric. The rubric
-- text below is carried over VERBATIM from lib/yip/questionnaire.ts
-- (RUBRIC_CRITERIA / RED_FLAGS) — if that file changes, this must change with
-- it, or the app and the scorer are marking to different standards.
--
-- The payload carries NO candidate name, id or school. These are minors and the
-- ranking is advisory: nothing in the app promotes, assigns or drops anybody on
-- the strength of a score.
--
-- Idempotent: re-running updates the recipe rather than erroring.

INSERT INTO public.ai_job_types (
  job_type, title, description,
  prompt_template, tool_set, output_target,
  interactive, lane, allow_rule, max_inflight,
  schedulable, enabled, expected_seconds,
  provider, model_id, external_allowed, loop_key,
  input_schema
) VALUES (
  'yip.questionnaire_score',
  'YIP — score a selection questionnaire (external)',
  'External-app task: score one YIP selection-questionnaire paper against the fixed rubric. Returns strict JSON. Enqueued via fn_ai_enqueue_external only.',
  'You are marking ONE candidate''s written paper for a Young Indians Parliament (YiP) Regional Round selection. The candidate is a school student. Mark only what is on the page.

Post applied for: {{post}}

Answers (JSON array of {position, question, answer}):
{{answers}}

Score EVERY answer you are given, including blank ones (a blank scores 0/0/0 with penalty 0). Do not skip positions.

RUBRIC — per answer:
- Event-specific grounding (0-3): 0 if generic/could apply anywhere. 3 only for a correct, specific YiP Regional Round detail. 1-2 for partial/slightly incorrect use.
- Depth & originality of reasoning (0-4): 0-1 for filler or an unresolved "it depends." 2-3 for a real position with reasoning. 4 only for a clear, specific, defended stance with a concrete example (and an actual pick on forced-choice questions).
- Role-appropriate voice & clarity (0-3): 3 if it reads like something this person would actually say out loud (first person, decisive, on-topic). Deduct for third-person essay style, drift, or restating the question.

RED FLAGS — deduct up to 3 points from an answer ONLY when TWO OR MORE apply to that same answer. One flag is a note, not a deduction.
1. Perfectly balanced/neutral tone with no personal stance, even when forced to choose
2. No correct YiP-specific detail anywhere, despite the question asking for one
3. Unnaturally uniform structure/length across this candidate''s answers
4. Third-person, textbook-formal language instead of first-person, in-character voice
5. Vocabulary/polish inconsistent with how a student this age typically writes

Per-answer score = grounding + depth + voice, minus the penalty, floored at 0. Maximum 10 before deduction.

HARD RULES:
- You are NOT told who wrote this, on purpose. Do not ask, do not guess, and never let a guess about identity move a score.
- Mark this paper against the rubric alone. No comparison to other papers, no curve, no adjusting for spread.
- Be consistent first answer to last. If unsure between two scores, take the LOWER one — a slightly harsh mark on a ranked list is recoverable; an inflated one hides a candidate who deserved a look.
- Copy flag strings VERBATIM from the numbered list above. Never invent a flag.
- The score only advises. A human confirms every shortlist.

Reply with STRICT JSON only — no preamble, no markdown fence:
{"answers":[{"position":1,"grounding":2,"depth":3,"voice":2,"redFlagPenalty":0,"flags":[]}],"note":"2-4 sentences for the organiser on what this candidate argued and how they came across. Plain English, no digits, no score, no rank, no comparison to anyone else. Omit for a blank paper."}',
  'none',
  'job.result',
  false,               -- batch: 180 papers scored between rounds, nobody waiting
  'max',
  'seat_owner',        -- as bug.summarize; the external enqueue path ignores it
  4,                   -- 180 papers x ~40s / 4 in flight = ~30 min of clear lane.
                       -- Kept below reply.draft's 5: MyJKKN internal work has
                       -- priority 100 vs 500 and must not be starved.
  false,
  true,
  40,
  'anthropic',         -- overridden to the Max subscription on the external path
  'sonnet',            -- records intent: judgement about minors, not summarisation
  true,
  'yip-selection',
  '[{"key":"post","type":"textarea","label":"post","required":true},
    {"key":"answers","type":"textarea","label":"answers","required":true}]'::jsonb
)
ON CONFLICT (job_type) DO UPDATE SET
  title            = EXCLUDED.title,
  description      = EXCLUDED.description,
  prompt_template  = EXCLUDED.prompt_template,
  input_schema     = EXCLUDED.input_schema,
  expected_seconds = EXCLUDED.expected_seconds,
  external_allowed = EXCLUDED.external_allowed,
  enabled          = EXCLUDED.enabled,
  updated_at       = now();
```

> **Get the prompt right the first time.** For a *new* job type the prompt goes
> live immediately. For an *existing* one, editing it in MyJKKN's admin UI files
> a **challenger** and leaves the live prompt untouched until a human promotes
> it — but a direct SQL `ON CONFLICT DO UPDATE` bypasses that mechanism
> entirely. Re-running this file replaces the live prompt with no review step.

---

## 4. The console change

Base it on **`jicate/main`** of `Jicate-Solutions/BugReporter` — that is what is
deployed. `JKKN-Institutions/jkkn-centralized-bug-reporter`'s `main` does **not**
contain the AI code at all, and any local `feat/*` branch is likely behind
(mine was 9 commits behind on 2026-08-16).

In `lib/ai/tasks.ts`, append to `FALLBACK_AI_TASKS`:

```ts
  {
    key: 'yip.questionnaire_score',
    label: 'YIP — score a selection questionnaire (external)',
    description: 'Strict-JSON rubric scores for one candidate paper'
  }
```

That single entry clears the `403` gate, because `AI_TASK_KEYS` is derived from
this array. It also fixes new-app auto-grants, which approve every new app for
exactly the hardcoded set.

Nothing else is required. There is no zod enum, no database CHECK constraint and
no SDK constant to update. Three optional extras, only if wanted:

- runnable from the console's own dashboard → `app/api/internal/ai/route.ts`
  (`TRIAGE_TASKS`) and the triage card's label map
- schedulable as a routine → `lib/routines/registry.ts`

Neither applies here: YIP enqueues its own work.

---

## 5. What a human must click

1. Confirm Yi Connect / YIP is registered as an application on the console.
2. On `/org/[slug]/apps/[appSlug]/edit`: turn on **"Enable AI (₹0 Max lane)"**
   and tick **YIP — score a selection questionnaire**.

Existing apps are **not** retroactively granted — `settings.ai.allowed_tasks` is
per-application, so this must be done for Yi Connect specifically.

---

## 6. The contract Yi Connect codes against

**Enqueue**

```
POST https://jkkn-centralized-bug-reporter.vercel.app/api/v1/public/ai/run
Header: X-API-Key: <Yi Connect's existing bug-reporter key>
Body:   { "task": "yip.questionnaire_score",
          "payload": { "post": "Speaker",
                       "answers": "[{\"position\":1,\"question\":\"…\",\"answer\":\"…\"}]" },
          "dedupe_key": "<attemptId>" }
→ 202 { job_id, status: "queued", poll: { url, retry_after: 30 } }
```

`app_id` is set server-side from the API key and must never be sent in the body.
`dedupe_key` should be the attempt id: a re-enqueue while one is still running
returns **409 IN_FLIGHT** rather than paying to score the same paper twice.

**Poll**

```
GET  …/api/v1/public/ai/run?job_id=<id>
→ { status: "queued" | "running" | "done" | "error" | "unknown", result }
```

**Reading the result — the part that needs care.** Output is **not validated**.
The runner returns `{ "answer": "<the model's raw text>" }`, so the strict JSON
asked for above arrives as a **string inside `answer`**, possibly with prose
wrapped around it. The caller must:

1. pull `answer` (defensively — existing readers also try `text`, `result`, `output`)
2. strip any markdown fence
3. `JSON.parse`, and treat a parse failure as a scoring failure for that paper —
   `markAttemptScoringFailed` already exists for exactly this
4. clamp every number regardless. `applyAttemptScores` already re-clamps to the
   rubric's ranges and drops unrecognised flag strings, so a bad response is
   contained; do not weaken that.

Errors worth handling explicitly: `403 ai_not_enabled`, `403 task_not_permitted`
(the hardcoded-list trap), `413` (payload), `409` (already in flight), `503`.

There is **no SDK support** — `packages/bug-reporter-sdk` has no AI surface. This
is a plain `fetch`.

---

## 7. What this replaces, and what it does not

This replaces **§1B of [`yip-ai-routine.md`](./yip-ai-routine.md)** — the
claude.ai routine that polls `/yip/api/questionnaire-scoring`. The endpoint
itself stays useful: it is the natural place to keep `finaliseExpiredAttempts`
and the clamped write-back, and the Max-lane client can call the same
`applyAttemptScores` path.

It does **not** replace the other jobs in that document (participant story,
growth notes, chair narrative, projector moments). Those still run on the
claude.ai routine. Moving them is a separate decision.

---

## 8. Decisions (Director, 2026-08-16)

Taken in a decision interview. Recorded because most cannot be recovered from the
code, and one overrides my recommendation.

| # | Decision | Why it matters |
| --- | --- | --- |
| 1 | **Mark all 180 in one go** — no test batch | **Against my recommendation** (I proposed 10 first). Reasonable on the strength of decision 5: a full re-mark is cheap and non-destructive, so being wrong costs ~30 minutes, not a redone selection. |
| 2 | **Warn on the questionnaire screen when marking hasn't moved for 30 minutes** | The runner is one machine and a pending job never times out. Without this, a cold lane and a working lane look identical. |
| 3 | **Keep BOTH routes** — Max lane and the claude.ai routine | The claude.ai routine stays as the fallback for when the seat is off. The cost is two systems to keep in step, which is the thing a shared engine exists to avoid. §1B of `yip-ai-routine.md` therefore stays live rather than being retired. |
| 4 | **A reply the app can't read flags that paper and marking continues** — no auto-retry | One malformed answer must never hold up the other 179. `markAttemptScoringFailed` and the existing single-paper re-score button already cover recovery. |
| 5 | **A "clear all marks and re-mark" button, per post** | The safety net that makes decision 1 reasonable. Clears scores ONLY — never touches a student's answers. |
| 6 | **Flag only the odd papers before the shortlist is read** — no blanket gate | Two cases worth surfacing: a high scorer carrying red flags, and candidates level on points at the shortlist cut-off. Everything else the organiser simply reads. No extra click in the normal path. |
| 7 | **A blank paper is still marked — zero, and no written note** | So it appears as a real zero instead of going missing, and cannot be confused with a paper that failed to mark. Same principle as the zero-vote fix in #952: standing and scoring nothing is a result, not an absence. |
| 8 | **Live count while marking** (e.g. "96 of 180 marked") | Over ~30 minutes, a silent screen is indistinguishable from a broken one. Deliberately **no** time estimate — papers queue behind MyJKKN's own work, which the app cannot see, so any ETA would be a guess presented as a fact. |

**What decision 3 unblocks immediately.** Because the claude.ai route is staying
rather than being replaced, §1B of `yip-ai-routine.md` is still the fastest way to
get the current 180 papers marked. It needs only the paste and the secret, and
waits on none of the Max-lane work above.

---

## 9. Open questions before anyone builds

- **Is Yi Connect registered on the AI door at all?** Grepping MyJKKN for
  `yi-connect` / `yip` found only unrelated matches. Step 5.1 may be a
  registration, not a toggle.
- **Does the single runner have headroom for 180 papers?** Worth one small batch
  before committing the whole cohort.
- **Should the app fall back?** If the lane is cold, papers sit `pending` with no
  timeout. The current design has no fallback and would simply wait.
