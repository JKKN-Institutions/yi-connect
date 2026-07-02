"use server";

/**
 * Server actions for PROJECTOR AI MOMENTS (director-triggered big-screen AI).
 *
 * "use server" file → exports ONLY async functions. Types/consts live in
 * lib/yip/ai/types.ts; DB plumbing in lib/yip/ai/projector-moments.ts. NONE of
 * these call an LLM — they enqueue request rows, optionally PING the
 * out-of-band routine awake (fire-and-forget webhook, no key, no payload), and
 * copy director-approved content to yip.projector_moments.
 *
 * Every action gates with getYipEventAccess(eventId).canManage and returns a
 * structured { success, error } result — NEVER throws / redirects.
 *
 * THE LIVE PATH: pressing "Generate" both enqueues the ai_drafts row AND POSTs
 * to YIP_AI_LIVE_TRIGGER_URL (a claude.ai routine API trigger). The routine
 * session then drains within ~1–2 minutes instead of the 3-hour schedule. If
 * the env is unset or the ping fails, the request still sits queued for the
 * next scheduled run — the ping is an accelerator, never a dependency.
 */
import { revalidatePath } from "next/cache";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { enqueueAiDraft, setAiDraftReview } from "@/lib/yip/ai/drafts";
import {
  getProjectedMoment,
  listProjectorDrafts,
  projectDraft,
  retireProjectedMoments,
} from "@/lib/yip/ai/projector-moments";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  isProjectorAiKind,
  type AiDraftRow,
  type ProjectorAiKind,
  type ProjectorMomentRow,
} from "@/lib/yip/ai/types";

type ActionResult =
  | { success: true; [k: string]: unknown }
  | { success: false; error: string };

/**
 * Fire-and-forget wake-up ping to the out-of-band routine. Carries NO event
 * data — it only tells the routine "there is work; poll the endpoint now".
 * Returns whether a ping was actually sent (UI copy: "generating now" vs
 * "queued for the next scheduled run").
 */
async function pingLiveTrigger(): Promise<boolean> {
  const url = process.env.YIP_AI_LIVE_TRIGGER_URL;
  if (!url) return false;
  const token = process.env.YIP_AI_LIVE_TRIGGER_TOKEN;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false; // accelerator only — the scheduled run will catch the queue
  }
}

/**
 * Enqueue one projector-moment generation and wake the routine.
 * subjectId: bills.id for projector_bill_summary, agenda.id for
 * projector_framing, null otherwise.
 */
export async function requestProjectorMoment(
  eventId: string,
  kind: string,
  subjectId: string | null = null
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  if (!isProjectorAiKind(kind)) {
    return { success: false, error: "Unknown projector moment kind." };
  }
  if (
    (kind === "projector_bill_summary" || kind === "projector_framing") &&
    !subjectId
  ) {
    return { success: false, error: "Pick a target first." };
  }

  const res = await enqueueAiDraft({
    eventId,
    kind: kind as ProjectorAiKind,
    subjectId,
    force: true, // director pressed the button — regenerate even if one exists
  });
  if ("error" in res) return { success: false, error: res.error };

  const pinged = await pingLiveTrigger();
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, id: res.id, pinged };
}

/** Control-card state: all projector drafts + what is currently on screen. */
export async function getProjectorAiState(eventId: string): Promise<
  | {
      success: true;
      drafts: AiDraftRow[];
      projected: ProjectorMomentRow | null;
      liveTriggerConfigured: boolean;
    }
  | { success: false; error: string }
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const [drafts, projected] = await Promise.all([
    listProjectorDrafts(eventId),
    getProjectedMoment(eventId),
  ]);
  return {
    success: true,
    drafts,
    projected,
    liveTriggerConfigured: Boolean(process.env.YIP_AI_LIVE_TRIGGER_URL),
  };
}

/** Targets for the two subject-scoped kinds (bill picker + agenda picker). */
export async function getProjectorTargets(eventId: string): Promise<
  | {
      success: true;
      bills: { id: string; title: string }[];
      agendaItems: { id: string; title: string; day: number | null }[];
    }
  | { success: false; error: string }
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const svc = await createServiceClient();
  const [{ data: bills }, { data: agenda }] = await Promise.all([
    svc.from("bills").select("id, title").eq("event_id", eventId),
    svc
      .from("agenda")
      .select("id, title, day, sequence_order")
      .eq("event_id", eventId)
      .order("day")
      .order("sequence_order"),
  ]);
  return {
    success: true,
    bills: ((bills as Array<{ id: string; title: string | null }>) ?? []).map(
      (b) => ({ id: b.id, title: b.title?.trim() || "Untitled Bill" })
    ),
    agendaItems: (
      (agenda as Array<{ id: string; title: string; day: number | null }>) ?? []
    ).map((a) => ({ id: a.id, title: a.title, day: a.day })),
  };
}

/**
 * THE HUMAN GATE: the director reviewed the draft (and possibly edited the
 * text) and taps "Project". Copies content into yip.projector_moments — the
 * only table the venue kiosk reads.
 */
export async function projectMomentToScreen(
  eventId: string,
  draftId: string,
  finalText: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const res = await projectDraft({ eventId, draftId, finalText });
  if (!res.success) return res;
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true };
}

/** Clear the projected moment (back to the normal agenda display). */
export async function clearProjectedMoment(
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const res = await retireProjectedMoments(eventId);
  if (!res.success) return res;
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true };
}

/** Discard a generated moment the director doesn't want (status → rejected). */
export async function discardProjectorDraft(
  eventId: string,
  draftId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  // Scope check: the draft must belong to this event and be a projector kind.
  const drafts = await listProjectorDrafts(eventId);
  const draft = drafts.find((d) => d.id === draftId);
  if (!draft) {
    return { success: false, error: "Draft not found for this event." };
  }
  const res = await setAiDraftReview({
    id: draftId,
    status: "rejected",
    approvedText: null,
  });
  if (!res.success) return res;
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true };
}
