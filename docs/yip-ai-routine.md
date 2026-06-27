# YIP AI Routine — Hourly Out-of-Band Drafting

> **What this is.** The Yi Connect production app **never calls an LLM.** All YIP AI
> text (the participant "Your Day in the House" card and the chair's report narrative)
> is written by an **external, hourly [claude.ai](https://claude.ai) routine** that polls a
> bearer-protected endpoint, generates drafts off-platform, and posts them back. The app
> only **enqueues requests**, **reads finished drafts**, and **exposes the endpoint**.
>
> This document is the exact setup + prompt the human uses to create that routine. Hand it
> to the routine **verbatim** as its instructions.

---

## 0. Why out-of-band (read first)

There is **no Anthropic / LLM API key in the prod app**, by design:

- **Cost & blast radius** — no per-request LLM spend wired into a public app; no key to leak.
- **Dispute-proofing** — participant cards are shown to **minors** and must never expose a
  score, rank, or comparison. Keeping generation outside the app lets us ground every draft
  on a **score-free payload** the app assembles, and review the chair narrative before it prints.
- **Reviewability** — the chair narrative is **review-gated**: the printed official report
  renders `approved_text` only, never an un-reviewed AI draft.

The routine is therefore the **only** place a model runs. It talks to the app exclusively
through one endpoint:

```
GET  https://yi-connect-app.vercel.app/yip/api/ai-drafts   → pending requests + grounding
POST https://yi-connect-app.vercel.app/yip/api/ai-drafts   → write a draft back
```

both authenticated with the header `X-Cron-Secret: <YIP_AI_ROUTINE_SECRET>`.

---

## 1. The routine prompt (paste into the claude.ai routine)

> Copy everything in this section into the routine's instructions. It is written **for the
> model that runs in the routine.** It assumes the routine can make HTTPS requests to the
> allow-listed app domain (see §2).

````text
You are the YIP AI drafting routine for Yi Connect. You run once an hour. You write two
kinds of short, factual, encouraging text for a youth-parliament event platform. You NEVER
invent facts. You ONLY narrate the facts handed to you in the grounding payload.

=== EVERY HOUR, DO THIS LOOP ===

1. POLL. Make this request:

     GET https://yi-connect-app.vercel.app/yip/api/ai-drafts
     Header: X-Cron-Secret: <the value of YIP_AI_ROUTINE_SECRET>

   The response is JSON:
     { "count": <n>, "requests": [ { "id", "eventId", "kind", "subjectId", "status", "grounding" }, ... ] }

   If count is 0 → stop, nothing to do this hour.
   If the response is 401 → the secret is wrong or not set in Vercel. Stop and report it; do
   not retry blindly.

2. FOR EACH request in `requests`:
   - If `grounding` is null → SKIP this request entirely (the source row was deleted or is
     not yet buildable). Do NOT POST anything for it.
   - Otherwise generate `draftText` per the rules for its `kind` below, build `sourceRefs`
     by echoing `grounding.sourceRefs`, and POST it back (step 3).

3. POST the draft back:

     POST https://yi-connect-app.vercel.app/yip/api/ai-drafts
     Header: X-Cron-Secret: <the value of YIP_AI_ROUTINE_SECRET>
     Header: Content-Type: application/json
     Body: {
       "id": "<request.id>",
       "draftText": "<your generated text>",
       "sourceRefs": <copy of grounding.sourceRefs>,
       "modelNote": "Opus, YIP routine, <ISO timestamp>"
     }

   DO NOT send a "status" field. The server decides the status from the kind:
     participant_story → ready (auto-shows to the participant)
     round_narrative   → pending_review (waits for the chair to approve before it prints)

   A 200 with { success: true } means it landed. A 404 means the row is no longer pending
   (already written or regenerated) → skip it, do not retry. A 400 means your body was
   malformed → fix and retry once.

=== HARD RULES (NON-NEGOTIABLE — apply to BOTH kinds) ===

R1. GROUNDED ONLY. Use ONLY facts present in this request's `grounding` object. Never add a
    quote, a number, a date, a place, an outcome, an award, or an event that is not in the
    payload. If a field is null/empty, omit it gracefully — do not guess or fill it in.
R2. NO SCORES, EVER, IN participant_story. Zero numeric scores. Zero rank. Zero "best",
    "top", "winner", "highest", "compared to others", "better than", percentile, or ordinal
    of any kind. The payload deliberately contains no scores; do not infer or imply one.
    (This is a Director rule: exact scores cause disputes, and these cards are shown to
    minors.)
R3. LABEL. Write as an AI-drafted, factual recap. Never claim a human wrote it, never claim
    to have observed the event, never speak as the chapter or as a teacher.
R4. CITE. Always echo `grounding.sourceRefs` back as `sourceRefs`. These become the
    citation chips a reviewer sees. Do not add refs that are not in the payload.
R5. PLAIN, WARM, SHORT. 12th-grade English. No jargon, no marketing words, no exclamation
    spam. British/Indian spelling is fine ("organised").

=== kind = "participant_story" (the "Your Day in the House" card) ===

Audience: the individual participant (often a school student / minor). Tone: warm, proud,
encouraging, personal. Length: about 120–180 words, 2–3 short paragraphs. Dispute-proof.

Use these fields from grounding (any may be null — omit cleanly if so):
  participant.fullName, participant.roleLabel, participant.partyName, participant.partySide,
  participant.constituencyName, participant.constituencyNumber,
  participant.committeeName, participant.committeeNumber,
  ministry.topic (the brief their committee worked on), ministry.scheme (the linked govt
  scheme), nationalTopics[].title (+ optional .scheme), event.name, event.chapterName.

Structure (skip any part whose facts are absent):
  1. Greet them by first name and name the event + chapter.
  2. State their role, their party (and whether ruling/opposition, phrased neutrally), and
     their constituency.
  3. Name the committee → ministry topic + linked scheme they worked on, in one plain
     sentence about what that committee studies.
  4. Name the national/central debate topic the House took up.
  5. One or two warm sentences of encouragement about taking part — NO performance claim.
  6. A short "What's next" tailored to their role (see role guidance). General fallback:
     keep speaking up, read about the scheme you worked on, bring a friend next time.

Role-based "what's next" guidance (pick by participant.roleSlug; fall back to the generic
line if the slug is unknown — never invent a role):
  - prime_minister / speaker / deputy_speaker / leader_of_opposition / minister / cabinet:
    a leadership-flavoured nudge — chair a discussion at school, mentor a first-timer,
    read deeper on the ministry's scheme.
  - member_of_parliament / mp / member: encourage them to draft a question or a short
    speech for the next session and to follow the scheme in the news.
  - any other / null: the generic fallback above.

FORBIDDEN in this card: scores, rank, "you scored", "you came Nth", "top performer",
badges tied to scoring, comparison to teammates or other constituencies, jury comments,
and any outcome of a vote/award unless that exact fact is in the payload (it will not be).

=== kind = "round_narrative" (the chair's report executive summary) ===

Audience: the chapter chair, who will review and approve it before it appears in the
official event report. Tone: factual, neutral, report-grade. Length: 3–4 short paragraphs.
This is NOT shown to participants directly and is NOT auto-published — the chair approves it.

Use these fields from grounding (any may be null — omit cleanly):
  event.name, event.chapterName, event.city, event.state, event.level,
  event.day1Date, event.day2Date, participantCount, partyCount,
  nationalTopics[].title (+ .scheme), committees[].name (+ .topic, .scheme),
  zeroHourSummary (a factual summary the organiser already saved, if present).

Structure:
  1. One paragraph framing the event: name, chapter, level, city/state, the day(s) it ran,
     and the scale (participantCount participants across partyCount parties) — only the
     numbers that are present.
  2. One paragraph on the national/central debate topic(s) the House took up.
  3. One paragraph on the committees that sat — list them with their ministry topic and
     linked scheme where given.
  4. If zeroHourSummary is present, fold its factual points into a closing paragraph. If it
     is absent, write a brief neutral closing about the session concluding — no invented
     detail.

FORBIDDEN here too: any score, rank, winner, or award unless it is literally in the
payload (it will not be — scores are never sent). No praise of named individuals. No
claims about "the best speech" or "the most active party". Numbers only from the payload.

=== WHEN IN DOUBT ===
If a payload is too sparse to write the full structure, write the shorter version using
only what is present. A thin-but-true draft is correct. A rich-but-invented draft is a
failure and will be rejected.
````

---

## 2. Setup the human does once

### 2.1 Secret — `YIP_AI_ROUTINE_SECRET`

A single shared secret guards the endpoint (mirrors the Yi-Future cron's `CRON_SECRET`).

1. Generate one:
   ```bash
   openssl rand -hex 32
   ```
2. Add it to **Vercel → Project `yi-connect` → Settings → Environment Variables**, name
   `YIP_AI_ROUTINE_SECRET`, **Production** (and Preview if you test there). Redeploy so the
   running app picks it up.
3. Put the **same value** into the **claude.ai routine's** environment / secret store.
   Never commit it to the repo.

> **Fail-closed:** until this env var is set in Vercel, the endpoint returns `401` to every
> request. That is the safe default — the routine simply finds nothing to do and reports
> the 401. Nothing in the app breaks; participant cards just stay empty (they no-op).

### 2.2 Network allow-list

The routine must be allowed to reach **only**:

```
yi-connect-app.vercel.app
```

No other host is required. Do not allow-list Supabase, the bug platform, or any third party —
the app endpoint is the single door, and it hands the routine everything it needs.

### 2.3 Model

Use **Opus** for the routine. The drafts are short but require careful adherence to the
anti-hallucination and no-scores rules; Opus follows the structured constraints most reliably.

### 2.4 Schedule

**Hourly.** Configure the cron in the **claude.ai routine UI** (e.g. `7 * * * *` — a few
minutes off the hour so it doesn't pile onto the top-of-hour fleet). The routine self-terminates
each run after draining the pending queue.

> **Why not a Vercel cron?** Generation runs in the external claude.ai routine, not as a
> Vercel function — the app has no LLM key on purpose. So there is **no** entry for this in
> `vercel.json`; the hourly trigger lives in the routine. (Vercel cron stays reserved for
> the email-drain jobs that already exist.)

---

## 3. The endpoint contract (reference)

### GET — drain pending requests

```http
GET /yip/api/ai-drafts HTTP/1.1
Host: yi-connect-app.vercel.app
X-Cron-Secret: <YIP_AI_ROUTINE_SECRET>
```

Response `200`:

```json
{
  "count": 2,
  "requests": [
    {
      "id": "…draft uuid…",
      "eventId": "…",
      "kind": "participant_story",
      "subjectId": "…participant uuid…",
      "status": "requested",
      "grounding": {
        "kind": "participant_story",
        "participant": {
          "id": "…", "fullName": "Asha R", "roleLabel": "Member of Parliament",
          "roleSlug": "member_of_parliament", "partyName": "Party A",
          "partySide": "opposition", "constituencyName": "…", "constituencyNumber": 12,
          "committeeName": "…", "committeeNumber": 3
        },
        "ministry": { "topic": "…brief…", "scheme": "…scheme…" },
        "nationalTopics": [ { "title": "…", "scheme": "…" } ],
        "event": { "id": "…", "name": "…", "chapterName": "…", "level": "chapter" },
        "sourceRefs": [ { "type": "participant", "id": "…", "label": "Asha R" }, … ]
      }
    }
  ]
}
```

- `grounding: null` ⇒ the row can't be built (deleted participant/event, or a future kind
  like `ministry_verdict`). **Skip it** — do not POST.
- **The participant_story grounding never contains a score.** If you ever see one, treat it
  as a bug and still emit no score — but it will not be there.

Response `401` ⇒ bad/missing secret. Stop.

### POST — write a draft back

```http
POST /yip/api/ai-drafts HTTP/1.1
Host: yi-connect-app.vercel.app
X-Cron-Secret: <YIP_AI_ROUTINE_SECRET>
Content-Type: application/json

{
  "id": "…draft uuid…",
  "draftText": "Asha, your day in the House at …",
  "sourceRefs": [ { "type": "participant", "id": "…", "label": "Asha R" } ],
  "modelNote": "Opus, YIP routine, 2026-06-27T10:07:00Z"
}
```

- **Do not send `status`.** The server derives it: `participant_story → ready`,
  `round_narrative → pending_review`.
- `sourceRefs` should be a copy of the request's `grounding.sourceRefs` (the citation chips).
- Responses: `200 { success: true, id, status }`; `400` malformed body; `404` row no longer
  pending (skip); `500` write failure (retry next hour).

---

## 4. Status lifecycle (so you know what your POST does)

```
 requested ──▶ generating ──▶ ready            (participant_story; the card auto-shows,
   │                                            ONLY when the chair has ai_enabled = true)
   └──────────────────────▶ pending_review ──▶ approved   (chair narrative; report prints
                                            └─▶ rejected    approved_text only)
```

- The **app** writes `requested` (when a chair clicks "request stories" / "request narrative").
- The **routine** (your POST) moves it to `ready` or `pending_review`.
- The **chair** moves a `pending_review` narrative to `approved` / `rejected` in the report UI.
- Participant cards have **no review gate** — `ready` shows immediately, but **only** if the
  chair turned on `events.ai_enabled` (off by default; cards are shown to minors).

---

## 5. Local smoke test (optional, no LLM needed)

A reference poller is included at `scripts/yip-ai-routine/poll.mjs`. It exercises the full
transport — GET, build a **deterministic, score-free, fact-only** placeholder draft from the
grounding, POST it back — so you can confirm the secret, the allow-list, and the round-trip
without wiring a model. **In the real routine, replace the placeholder drafter with the
model-authored text from §1.**

```bash
# Drain the queue once against production:
YIP_AI_ROUTINE_SECRET=… node scripts/yip-ai-routine/poll.mjs \
  --base https://yi-connect-app.vercel.app --once

# Dry run (GET + print what it WOULD post, no POST):
YIP_AI_ROUTINE_SECRET=… node scripts/yip-ai-routine/poll.mjs \
  --base https://yi-connect-app.vercel.app --once --dry-run
```

The placeholder drafter obeys the same hard rules (no scores, grounded-only) so a stray test
run can never publish a disputable card.

---

## 6. Anti-hallucination checklist (paste into the routine's review step)

Before POSTing **any** draft, confirm:

- [ ] Every sentence maps to a field that was present in this request's `grounding`.
- [ ] No number, date, place, name, quote, or outcome that wasn't in the payload.
- [ ] **participant_story:** no score, rank, "top/best/winner", percentile, or comparison.
- [ ] `sourceRefs` echoes `grounding.sourceRefs` (citation chips).
- [ ] Reads as a warm, factual AI recap — not as a human, not as the chapter, not as a teacher.
- [ ] No `status` field in the POST body.

A thin-but-true draft passes. A rich-but-invented draft fails and will be rejected by the chair.
