"use server";

/**
 * Server actions for the YIP AI layer.
 *
 * "use server" file → exports ONLY async functions. All types/consts live in
 * lib/yip/ai/types.ts; all DB plumbing in lib/yip/ai/drafts.ts. NONE of these
 * call an LLM — they ONLY enqueue request rows, flip the chair opt-in flag, and
 * gate the chair's review of a generated narrative. Generation is entirely
 * out-of-band (the hourly routine via app/yip/api/ai-drafts).
 *
 * Every action gates with getYipEventAccess(eventId).canManage and returns a
 * structured { success, error } result — NEVER throws / redirects.
 */
import { revalidatePath } from "next/cache";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  enqueueAiDraft,
  setAiDraftReview,
  writeEventAiEnabled,
  getAiDraft,
} from "@/lib/yip/ai/drafts";

type ActionResult =
  | { success: true; [k: string]: unknown }
  | { success: false; error: string };

/**
 * Enqueue one participant_story request per participant in the event (chair/
 * organiser action). Idempotent: participants already with an in-flight or
 * completed draft are not re-queued unless force is set. Returns how many were
 * enqueued.
 */
export async function requestParticipantStories(
  eventId: string,
  force = false
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const svc = await createServiceClient();
  const { data: participants, error } = await svc
    .from("participants")
    .select("id")
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  let enqueued = 0;
  let failed = 0;
  for (const p of (participants as Array<{ id: string }>) ?? []) {
    const res = await enqueueAiDraft({
      eventId,
      kind: "participant_story",
      subjectId: p.id,
      force,
    });
    if ("error" in res) failed += 1;
    else enqueued += 1;
  }

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, enqueued, failed };
}

/**
 * Enqueue the single event-level round_narrative request (chair/organiser).
 */
export async function requestRoundNarrative(
  eventId: string,
  force = false
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const res = await enqueueAiDraft({
    eventId,
    kind: "round_narrative",
    subjectId: null,
    force,
  });
  if ("error" in res) return { success: false, error: res.error };
  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true, id: res.id };
}

/**
 * Approve a draft: copy draft_text → approved_text (optionally chair-edited)
 * and set status='approved'. The report renders approved_text ONLY.
 * `editedText` lets the chair tweak before approving (the review component
 * passes the textarea value).
 */
export async function approveDraft(
  eventId: string,
  draftId: string,
  editedText: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  // Guard: the draft must belong to this event.
  const existing = await getAiDraft(eventId, "round_narrative", null);
  if (!existing || existing.id !== draftId) {
    return { success: false, error: "Draft not found for this event." };
  }
  const text = (editedText ?? "").trim();
  if (!text) {
    return { success: false, error: "Cannot approve an empty narrative." };
  }
  const res = await setAiDraftReview({
    id: draftId,
    status: "approved",
    approvedText: text,
  });
  if (!res.success) return res;
  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true };
}

/** Reject/discard a draft: status='rejected', approved_text cleared. */
export async function rejectDraft(
  eventId: string,
  draftId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const existing = await getAiDraft(eventId, "round_narrative", null);
  if (!existing || existing.id !== draftId) {
    return { success: false, error: "Draft not found for this event." };
  }
  const res = await setAiDraftReview({
    id: draftId,
    status: "rejected",
    approvedText: null,
  });
  if (!res.success) return res;
  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true };
}

/**
 * Regenerate a draft: reset it to status='requested' (clearing the old draft +
 * review) so the routine re-drafts it on its next poll. Works for either kind.
 */
export async function regenerate(
  eventId: string,
  kind: "participant_story" | "round_narrative",
  subjectId: string | null = null
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const res = await enqueueAiDraft({ eventId, kind, subjectId, force: true });
  if ("error" in res) return { success: false, error: res.error };
  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, id: res.id };
}

/**
 * Chair opt-in toggle for AI features on the event. OFF by default. When OFF,
 * participant cards do NOT auto-show (gated in the card component). When the
 * chair turns it ON, you may want to also call requestParticipantStories — the
 * UI does that; this action only flips the flag.
 */
export async function setEventAiEnabled(
  eventId: string,
  on: boolean
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const res = await writeEventAiEnabled(eventId, on);
  if (!res.success) return res;
  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, ai_enabled: on };
}
