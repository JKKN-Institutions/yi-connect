# Role-Specific Leadership UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan slice-by-slice. Build **Slice 1 (Speaker motions) first**, verify, then proceed.

**Goal:** Give YIP leadership roles real in-app powers instead of the uniform participant dashboard — starting with the **Speaker/Deputy Speaker processing motions**, then Cabinet ministers, Leader of Opposition, PM/Deputy PM, and Shadow ministers. Each role acts on the **existing** `motions` / `questions` / `bills` tables; the organiser dashboard keeps full control and can **overrule**.

**Architecture:** Every leadership action is a NEW server action gated by `requireParticipantSession(participantId, eventId)` (the caller owns that participant) **plus a server-side `parliament_role` check** (a shared `requireLeadershipRole` helper). Actions write the same columns the organiser dashboard already writes (e.g. `motions.speaker_ruling`/`status`/`ruled_by`). **No locking, last-write-wins** — both the role and the organiser can act; the organiser overrules simply by acting after (its `canManage` actions are unchanged). New screens live under `app/yip/me/<role>/`; a role-aware "Your leadership desk" card on `/yip/me` links each leader to their screen.

**Tech Stack:** Next.js 15 App Router + React 19 server actions, Supabase (schema `yip`, service-role writes behind the participant+role gate), Tailwind v4. Verification: `tsc --noEmit`, adversarial-verify vs live DB (role gate can't be bypassed, non-leaders get nothing, organiser can still overrule), live browser as a role QA participant.

---

## Current State (surveyed 2026-06-13 @ origin/master 78bc2ab3)

- **The app is organiser-driven.** Students (incl. leadership) all see the same `/yip/me`; `parliament_role` only sets a badge + `ministry` label. The single role-functional branch today is `bill_committee` (gets a bill card).
- **Motions** (`app/yip/actions/motions.ts`): students submit via `raiseMotion` (participant-gated). Processing — `admitMotion`, `rejectMotion`, `recordMotionVote`, `recordMinisterResponse` — is **`canManage`-only** and surfaced **only** in the organiser dashboard `app/yip/dashboard/events/[id]/motions/`. **The student-Speaker has no motion UI.**
- **`motions` table is ready** for role actions: `status`, `speaker_ruling`, `speaker_note`, `ruled_at`, `ruled_by (uuid)`, `votes_for/against/abstain`, `outcome`, `minister_response`, `directed_to_ministry`, `raised_by_*`, `motion_type`.
  - `admitMotion`: status → `voting` if `motion_type==='no_confidence'` else `discussing`; `speaker_ruling='admitted'`; `ruled_by = auth user id`.
  - `rejectMotion`: status → `rejected`; `speaker_ruling='rejected'`; `resolved_at` set.
  - `recordMotionVote`: sets votes + `outcome` (`for>against` ? passed : rejected, tie=rejected) + status `resolved`.
  - `recordMinisterResponse`: sets `minister_response` (+ resolve).
- **Motion enums** (`lib/yip/motions.ts`): types `adjournment | calling_attention | breach_of_privilege | no_confidence | short_duration | obituary` (each has `goesToVote`, `needsMinistry`); statuses include `submitted | discussing | voting | resolved | rejected` (confirm full list in `MOTION_STATUS_LABELS`/`MOTION_STATUS_COLORS`). Reuse these labels/colors in the Speaker UI.
- **Parliament roles** (`lib/yip/constants.ts` `PARLIAMENT_ROLES` + `ROLE_LABELS`): `speaker, nominated_speaker, deputy_speaker, prime_minister, deputy_prime_minister, leader_of_opposition, cabinet_minister, shadow_minister, bill_committee, mp, independent_mp`.
- **Sessions** (`lib/yip/auth/yip-session.ts`): `requireParticipantSession(participantId, eventId)` → `{ok}` (verifies the cookie owns that participant + event). Participants have NO auth user — so `ruled_by` for a Speaker action must be the **speaker's participant id** (provenance), not an auth uid.

## Key Decisions (locked 2026-06-13, product owner)

1. **Role-specific UI for all leadership roles**, as much as the data model allows.
2. **Both the role AND the organiser can act on a motion; the organiser can overrule.** → Shared columns, **no locking, last-write-wins**. The organiser's existing `canManage` actions are untouched; acting after the Speaker overwrites the ruling.
3. **In-app actions** (not just better visibility): the student-Speaker actually rules; ministers actually respond.
4. Reuse the existing tables + mirror the existing organiser actions' field-writes (don't invent a parallel data model).
5. Build **Speaker motions first** (named gap, data ready), then iterate role by role.

## Authority / concurrency model

- Speaker action and organiser action write the **same** `motions` row fields. Whoever writes last wins. `ruled_by` records the actor (organiser auth uid, or speaker participant id). `ruled_at` timestamps it. The organiser dashboard already renders the current ruling, so an overrule is visible immediately.
- No optimistic lock / version column. Acceptable per decision #2 (organiser is the backstop). If we later want an audit trail of *who overruled whom*, add a `motion_rulings` history table — **out of scope** for v1.

## Risks & Gotchas

- **Role check MUST be server-side** in every leadership action (not just hiding the screen). `yip.motions` UPDATE is reachable; the action is the gate. Pattern: `requireParticipantSession` + re-fetch the participant row + assert `parliament_role ∈ allowed`. Fail closed.
- **`ruled_by` is a uuid with no FK** — safe to store the speaker's participant id. Do not assume it resolves to an auth user in any UI. (The organiser dashboard shows `speaker_ruling`/`speaker_note`, not a join on `ruled_by`, so this is fine — confirm during build.)
- **Deputy Speaker shares Speaker powers**; `nominated_speaker` does NOT (they're only a candidate). Allowed presiding set = `{speaker, deputy_speaker}`.
- **Motion belongs to the event**: every action must verify `motion.event_id === eventId` (no cross-event IDOR via a forged motionId).
- **Minors / PII**: leadership screens show only what the organiser dashboard already shows for motions (subject/details/raiser name+role) — no contact PII. Minister/question screens must not expose student contact info.
- **`directed_to_ministry` matching**: a Cabinet minister sees items where `directed_to_ministry === participant.ministry`. A participant with null ministry sees none (fail closed).
- **Status transition sanity**: only admit a `submitted` motion; only record a vote on a `voting` motion; guard against double-processing (re-check status server-side, return a friendly error otherwise).
- **No new anon surface**: these are participant-session reads/writes via service-role server actions; add no table grants.
- **Migration**: none needed for Slice 1 (all columns exist). Later slices: confirm `questions`/`bills` have response fields before promising minister/PM answer actions.
- **tsc in worktree** may show false module noise; authoritative gate is main-tree tsc after merge + Vercel green.
- **Commit per file**; verify each slice before the next.

---

## Slices (build in order; ship slice-by-slice)

```
Slice 1  Speaker / Deputy Speaker — motion processing      ← BUILD FIRST
Slice 2  Cabinet minister — ministry Q&A + motion response
Slice 3  Leader of Opposition — no-confidence + bill response
Slice 4  PM / Deputy PM — government bills + cross-ministry answers
Slice 5  Shadow minister — counter view of their ministry
Slice 6  Leadership entry card/nav on /yip/me (role-aware)   (can fold into each slice)
```

---

## SLICE 1 — Speaker / Deputy Speaker motion processing (FULL DETAIL)

### Task 1.1: Shared leadership-role gate helper

**Files:** Create `lib/yip/auth/leadership.ts`

```ts
import "server-only";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";

export type LeadershipGate =
  | { ok: true; participant: { id: string; event_id: string; parliament_role: string | null; ministry: string | null; full_name: string } }
  | { ok: false; error: string };

/**
 * Gate a leadership action: the caller's participant session must own
 * `participantId` for `eventId`, AND that participant's parliament_role must be
 * in `allowed`. Server-side only — the UI hiding the screen is NOT the gate.
 */
export async function requireLeadershipRole(
  participantId: string,
  eventId: string,
  allowed: readonly string[]
): Promise<LeadershipGate> {
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { ok: false, error: sess.error };

  const supabase = await createServiceClient();
  const { data: p } = await supabase
    .from("participants")
    .select("id, event_id, parliament_role, ministry, full_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!p) return { ok: false, error: "Participant not found for this event" };
  if (!p.parliament_role || !allowed.includes(p.parliament_role)) {
    return { ok: false, error: "Your role does not have access to this action." };
  }
  return { ok: true, participant: p };
}

export const PRESIDING_ROLES = ["speaker", "deputy_speaker"] as const;
```

- Step: write it. Step: `npx tsc --noEmit` (expect clean). Step: commit.

### Task 1.2: Speaker motion actions

**Files:** Create `app/yip/actions/speaker.ts`

Mirror the organiser `admitMotion`/`rejectMotion`/`recordMotionVote` field-writes, but gate with `requireLeadershipRole(..., PRESIDING_ROLES)`, verify `motion.event_id === eventId`, set `ruled_by = participantId`, and re-check status before acting.

```ts
"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireLeadershipRole, PRESIDING_ROLES } from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";
import type { Motion } from "@/app/yip/actions/motions"; // exported list item type

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

/** All motions for the event, for the presiding officer's queue. Participant+role gated. */
export async function getSpeakerMotions(
  eventId: string,
  participantId: string
): Promise<ActionResult<Motion[]>> {
  const gate = await requireLeadershipRole(participantId, eventId, PRESIDING_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("motions")
    .select("*")
    .eq("event_id", eventId)
    .order("raised_at", { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as unknown as Motion[] };
}

async function loadMotionForSpeaker(eventId: string, participantId: string, motionId: string) {
  const gate = await requireLeadershipRole(participantId, eventId, PRESIDING_ROLES);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const supabase = await createServiceClient();
  const { data: motion } = await supabase
    .from("motions")
    .select("id, event_id, motion_type, status")
    .eq("id", motionId)
    .eq("event_id", eventId) // no cross-event IDOR
    .maybeSingle();
  if (!motion) return { ok: false as const, error: "Motion not found for this event" };
  return { ok: true as const, supabase, motion, speakerId: participantId };
}

export async function speakerAdmitMotion(
  eventId: string,
  participantId: string,
  motionId: string,
  speakerNote?: string
): Promise<ActionResult> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.status !== "submitted") {
    return { success: false, error: "This motion has already been processed." };
  }
  const { error } = await r.supabase
    .from("motions")
    .update({
      status: r.motion.motion_type === "no_confidence" ? "voting" : "discussing",
      speaker_ruling: "admitted",
      speaker_note: speakerNote ?? null,
      ruled_at: new Date().toISOString(),
      ruled_by: r.speakerId,
    })
    .eq("id", motionId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: null };
}

export async function speakerRejectMotion(
  eventId: string,
  participantId: string,
  motionId: string,
  speakerNote: string
): Promise<ActionResult> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.status !== "submitted") {
    return { success: false, error: "This motion has already been processed." };
  }
  const now = new Date().toISOString();
  const { error } = await r.supabase
    .from("motions")
    .update({
      status: "rejected",
      speaker_ruling: "rejected",
      speaker_note: speakerNote,
      ruled_at: now,
      ruled_by: r.speakerId,
      resolved_at: now,
    })
    .eq("id", motionId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: null };
}

export async function speakerRecordMotionVote(
  eventId: string,
  participantId: string,
  motionId: string,
  votes: { for: number; against: number; abstain: number }
): Promise<ActionResult<{ outcome: "passed" | "rejected" }>> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.status !== "voting") {
    return { success: false, error: "This motion is not open for a vote." };
  }
  const outcome = votes.for > votes.against ? "passed" : "rejected";
  const { error } = await r.supabase
    .from("motions")
    .update({
      votes_for: votes.for,
      votes_against: votes.against,
      votes_abstain: votes.abstain,
      outcome,
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", motionId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: { outcome } };
}
```

- Confirm the `Motion` type is exported from `motions.ts` (it is — `listMotions` returns `Motion[]`). If not exported, export it.
- Step: tsc clean. Step: commit.

### Task 1.3: Speaker screen

**Files:** Create `app/yip/me/speaker/page.tsx` (server) + `app/yip/me/speaker/speaker-client.tsx` (client)

- `page.tsx`: read `getYipSession()`; require `type === "participant"`; fetch the participant (service client) and **redirect to `/yip/me` unless `parliament_role ∈ {speaker, deputy_speaker}`** (with a small "not the Speaker" message rather than a silent bounce — per CLAUDE.md rule 27). Pass `eventId`, `participantId`, role label.
- `speaker-client.tsx`: on mount call `getSpeakerMotions`. Group by status (Pending = `submitted`, Discussing/Voting, Resolved/Rejected). For a `submitted` motion show **Admit** / **Reject** (Reject opens a note field). For a `voting` motion show a **Record vote** form (for/against/abstain → `speakerRecordMotionVote`). Reuse `MOTION_TYPES` (label/description/color) + `MOTION_STATUS_LABELS`/`MOTION_STATUS_COLORS` from `lib/yip/motions.ts`. Mirror the visual language of the existing organiser `motions-client.tsx`. Optimistic update + refresh; inline error banner on failure (no `alert`).
- Show `speaker_ruling`/`speaker_note`/`outcome` on processed rows so an organiser overrule is visible on next load.

### Task 1.4: Entry point on /yip/me

**Files:** Modify `app/yip/me/page.tsx`

- When `participant.parliament_role ∈ {speaker, deputy_speaker}`, render a prominent **"Preside — Motion Queue"** card linking to `/yip/me/speaker` (gavel icon, amber/Speaker gradient). Place it near the top (above Question Hour). Leave every other role's view unchanged for now.

### Task 1.5: Verify Slice 1

- `npx tsc --noEmit` clean (main tree after merge).
- **Adversarial-verify (Agent) vs live DB:** (a) a non-presiding participant calling `speakerAdmitMotion` is rejected ("role does not have access"); (b) a presiding officer cannot act on a motion from another event (forged motionId, cross-event) ; (c) admit/reject only from `submitted`, vote only from `voting`; (d) the organiser `admitMotion` still works and **overrules** a Speaker ruling (last-write-wins); (e) no new anon surface.
- **Live browser:** seed/borrow a QA participant with `parliament_role='speaker'` on the ZZZ QA clone (`6ecd54d8`) + a couple of `submitted` motions; sign in via access code at `/yip/join`; open the Speaker card → admit one, reject one (with note), record a vote on a no-confidence; DB-verify each write; then as organiser overrule one from the dashboard and confirm it flips. Revert QA data after.
- Commit + PR + Vercel verify.

---

## SLICE 2 — Cabinet minister: ministry Q&A + motion response (SPEC)

- **Build-time survey first:** read `app/yip/actions/questions.ts` + the `questions` table for an answer/response field (does a minister-answer column exist, or only `motions.minister_response`?). Confirm `questions.directed_to_ministry` + how answers are stored.
- New actions (gated `requireLeadershipRole(..., ['cabinet_minister'])` + `ministry` match):
  - `getMyMinistryItems(eventId, participantId)` → questions + motions where `directed_to_ministry === participant.ministry`.
  - `ministerRespondToMotion(...)` → writes `motions.minister_response` (mirror `recordMinisterResponse` field-writes, participant+ministry gated).
  - `ministerAnswerQuestion(...)` → writes the questions answer field (per survey).
- Screen `app/yip/me/ministry/` — "Directed to your ministry (<name>)" list → respond inline. Entry card on `/yip/me` when role is `cabinet_minister`.
- PM/Deputy PM (Slice 4) may reuse this with cross-ministry scope (see all ministries).

## SLICE 3 — Leader of Opposition (SPEC)

- Gated `['leader_of_opposition']`. One-tap **"Move No-Confidence Motion"** (pre-fills `raiseMotion` with `motion_type='no_confidence'`), plus a **respond-to-bill** affordance (survey `bills`/`app/yip/me/bill` for a response field). Opposition view of government bills. Entry card when role matches.

## SLICE 4 — PM / Deputy PM (SPEC)

- Gated `['prime_minister','deputy_prime_minister']`. Present government bills (survey bill-presentation flow), answer questions across ALL ministries (reuse Slice 2 actions with cross-ministry scope). Entry card.

## SLICE 5 — Shadow minister (SPEC)

- Gated `['shadow_minister']`. Read their counterpart ministry's questions + minister responses; file a follow-up/counter (a question or short-duration motion). Entry card.

## SLICE 6 — Leadership entry/nav (SPEC, or fold into each slice)

- A single role-aware "Your leadership desk" block on `/yip/me` that routes each leader to their screen, so the entry isn't scattered. Optional once 2+ slices exist.

---

## Done = (per slice)
- [ ] Server-side role gate enforced (adversarial-verify: non-role denied, cross-event denied, organiser can still overrule).
- [ ] `tsc --noEmit` clean on main tree.
- [ ] Live browser pass as the role's QA participant; writes DB-confirmed; organiser overrule confirmed (Slice 1).
- [ ] PR merged; Vercel deploy verified via commit-status "Vercel".
