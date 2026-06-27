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
  listPendingAiDrafts,
  writeAiDraft,
} from "@/lib/yip/ai/drafts";
import {
  buildParticipantStoryGrounding,
  buildRoundNarrativeGrounding,
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
