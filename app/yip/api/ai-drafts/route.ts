/**
 * Bearer-protected endpoint for the OUT-OF-BAND YIP AI routine.
 *
 * The prod app NEVER calls an LLM. An hourly Claude Code routine polls this
 * endpoint to do all generation off-platform:
 *   GET  → returns pending request rows (status requested|generating) each with
 *          its NON-SCORE grounding payload assembled from live event data.
 *   POST → writes back { id, draftText, sourceRefs?, modelNote? } and advances
 *          status (participant_story → ready; round_narrative → pending_review).
 *
 * Auth: a single shared secret in the `X-Cron-Secret` header compared to
 * process.env.YIP_AI_ROUTINE_SECRET. Mirrors
 * app/yi-future/api/cron/auto-assign-problems/route.ts exactly. The caller is
 * trusted ONLY for the secret — everything else is server-derived. Uses the
 * service client; no user session.
 *
 * Spec for the routine (prompt, env, network allow-list, cron):
 * docs/yip-ai-routine.md.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  enqueueAiDraft,
  listPendingAiDrafts,
  writeAiDraft,
} from "@/lib/yip/ai/drafts";
import {
  buildBillFeedbackGrounding,
  buildParticipantStoryGrounding,
  buildRoundNarrativeGrounding,
  buildSessionFeedbackGrounding,
  getBillFeedbackWork,
  getSessionFeedbackWork,
  listAiEnabledEventIds,
} from "@/lib/yip/ai/grounding";
import type {
  AiDraftStatus,
  AiGrounding,
  AiSourceRef,
  PendingAiRequest,
} from "@/lib/yip/ai/types";

// This route does live DB reads/writes — never cache it.
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.YIP_AI_ROUTINE_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  return request.headers.get("x-cron-secret") === secret;
}

/**
 * GET — drain pending requests. For each row, assemble its grounding payload
 * (NON-SCORE) so the routine has everything it needs to draft with citations.
 * Rows whose grounding cannot be built (deleted participant/event) are returned
 * with grounding=null so the routine can skip them.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SELF-RUNNING LOOP — before draining, detect newly-scored sessions that have
  // no session_feedback draft yet and enqueue a 'requested' row for each. The
  // candidate set is every AI-opted-in event (events.ai_enabled = true) — an
  // intentionally small, opt-in set, NOT the pending-draft set. This is the key
  // fix: in steady state an event's participant_story / round_narrative rows are
  // already 'ready'/'approved' (no longer pending), so sourcing candidates from
  // the pending set would never sweep them and the loop would silently stop.
  // For each ai_enabled event, getSessionFeedbackWork() finds its scored-but-
  // unfed (participant, session) pairs (and no-ops when the event has no scores
  // yet), so a freshly-scored session yields a growth note next cycle with no
  // manual button. Detection is best-effort and must never block draining.
  try {
    const aiEventIds = await listAiEnabledEventIds();
    for (const eventId of aiEventIds) {
      const work = await getSessionFeedbackWork(eventId);
      for (const w of work) {
        await enqueueAiDraft({
          eventId,
          kind: "session_feedback",
          subjectId: w.participantId,
          agendaItemId: w.agendaItemId,
        });
      }
      // SAME-LOOP companion: detect drafted-but-unfed bills and enqueue one
      // bill_feedback row each (subject_id=bill.id, agenda_item_id NULL). Coexists
      // with the session_feedback enqueue inside this try block.
      const billWork = await getBillFeedbackWork(eventId);
      for (const b of billWork) {
        await enqueueAiDraft({
          eventId,
          kind: "bill_feedback",
          subjectId: b.billId,
        });
      }
    }
  } catch {
    // A failure here must not block draining existing requests; the next hourly
    // run retries.
  }

  const pending = await listPendingAiDrafts(100);

  const requests: PendingAiRequest[] = [];
  for (const row of pending) {
    let grounding: AiGrounding | null = null;
    try {
      if (row.kind === "participant_story" && row.subject_id) {
        grounding = await buildParticipantStoryGrounding(
          row.event_id,
          row.subject_id
        );
      } else if (row.kind === "round_narrative") {
        grounding = await buildRoundNarrativeGrounding(row.event_id);
      } else if (
        row.kind === "session_feedback" &&
        row.subject_id &&
        row.agenda_item_id
      ) {
        // ROUTINE-ONLY grounding: carries the participant's own per-criterion
        // pattern (self-referential ratios), never another participant, never a
        // rank. Reached ONLY here behind the bearer secret.
        grounding = await buildSessionFeedbackGrounding(
          row.event_id,
          row.subject_id,
          row.agenda_item_id
        );
      } else if (row.kind === "bill_feedback" && row.subject_id) {
        // CONTENT-SAFE grounding: reads ONLY the bill's own craft fields +
        // event/committee context, never yip.scores/results, never the bill's
        // drafting people. subject_id = bills.id; agenda_item_id is NULL.
        grounding = await buildBillFeedbackGrounding(
          row.event_id,
          row.subject_id
        );
      }
      // ministry_verdict and any unknown kind → grounding stays null (skipped).
    } catch {
      grounding = null;
    }
    requests.push({
      id: row.id,
      eventId: row.event_id,
      kind: row.kind,
      subjectId: row.subject_id,
      agendaItemId: row.agenda_item_id,
      status: row.status,
      grounding,
    });
  }

  return NextResponse.json({ count: requests.length, requests });
}

/**
 * POST — the routine writes a generated draft back.
 * Body: { id, draftText, sourceRefs?, modelNote? }
 *
 * Target status is decided HERE by kind (the routine does not choose it):
 *   participant_story → "ready"          (auto-shows on the participant card)
 *   round_narrative   → "pending_review" (awaits chair approval in the report)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = (body ?? {}) as {
    id?: unknown;
    kind?: unknown;
    draftText?: unknown;
    sourceRefs?: unknown;
    modelNote?: unknown;
  };

  const id = typeof b.id === "string" ? b.id : "";
  const draftText = typeof b.draftText === "string" ? b.draftText : "";
  if (!id || !draftText.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: id, draftText" },
      { status: 400 }
    );
  }

  // Re-read the row to authoritatively derive its kind → target status (never
  // trust the caller for status). We find it among the pending set; if it is no
  // longer pending (already written), treat it as a conflict.
  const pending = await listPendingAiDrafts(500);
  const row = pending.find((r) => r.id === id);
  if (!row) {
    return NextResponse.json(
      { error: "Draft not found or no longer pending" },
      { status: 404 }
    );
  }

  // The chair narrative is the ONLY review-gated kind. participant_story and
  // session_feedback both auto-show ('ready') — they are dispute-proof / number-
  // free by construction and gated on events.ai_enabled at the card.
  const targetStatus: AiDraftStatus =
    row.kind === "round_narrative" ? "pending_review" : "ready";

  const sourceRefs: AiSourceRef[] = Array.isArray(b.sourceRefs)
    ? (b.sourceRefs as AiSourceRef[])
    : row.source_refs;
  const modelNote = typeof b.modelNote === "string" ? b.modelNote : null;

  const res = await writeAiDraft({
    id,
    draftText: draftText.trim(),
    sourceRefs,
    modelNote,
    status: targetStatus,
  });
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, id, status: targetStatus });
}
