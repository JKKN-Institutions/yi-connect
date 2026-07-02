import "server-only";

/**
 * yip.projector_moments plumbing — the LAST mile between a reviewed AI draft
 * and the venue projector.
 *
 * Doctrine enforced HERE, by construction:
 *   • Nothing reaches the big screen without the director's explicit Project
 *     tap (these functions are called only from canManage-gated actions).
 *   • kind='projector_quotes' payloads are built by copying the VERBATIM
 *     question text from yip.questions — the model only chose ids. A reworded
 *     quote is impossible.
 *   • AI-written text scenes may not contain digits (Director no-numbers
 *     doctrine — the projector is a participant-facing surface). The House's
 *     own verbatim words are exempt (they are not AI text).
 *
 * Table not in generated types → loose casts, same pattern as drafts.ts.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { effectiveMinistries, ministryLabel } from "@/lib/yip/cabinet";
import { setAiDraftReview } from "./drafts";
import {
  isProjectorAiKind,
  type AiDraftRow,
  type AiSourceRef,
  type ProjectorAiKind,
  type ProjectorMomentPayload,
  type ProjectorMomentRow,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Loose = any;

const DRAFT_COLS =
  "id, event_id, kind, subject_id, agenda_item_id, status, draft_text, source_refs, model_note, generated_at, reviewed_by, approved_text, reviewed_at, is_mock, created_at, updated_at";

/** The one currently-projected moment for an event (null when screen is clear). */
export async function getProjectedMoment(
  eventId: string
): Promise<ProjectorMomentRow | null> {
  const svc = (await createServiceClient()) as Loose;
  const { data } = await svc
    .from("projector_moments")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "projected")
    .order("updated_at", { ascending: false })
    .limit(1);
  const row = (data as ProjectorMomentRow[] | null)?.[0];
  return row ?? null;
}

/** Every projector-kind ai_draft for the event (for the control-panel card). */
export async function listProjectorDrafts(
  eventId: string
): Promise<AiDraftRow[]> {
  const svc = (await createServiceClient()) as Loose;
  const { data } = await svc
    .from("ai_drafts")
    .select(DRAFT_COLS)
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false });
  return ((data as AiDraftRow[]) ?? []).filter((r) =>
    isProjectorAiKind(r.kind)
  );
}

function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•*\-–—]+/, "").trim())
    .filter(Boolean);
}

/** Retire every projected moment for the event (clears the screen). */
export async function retireProjectedMoments(
  eventId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const svc = (await createServiceClient()) as Loose;
  const { error } = await svc
    .from("projector_moments")
    .update({ status: "retired", updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("status", "projected");
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Project a reviewed draft onto the venue screen: build the payload
 * server-side, retire whatever is currently projected, insert the new moment,
 * and mark the draft approved with the exact projected text.
 *
 * `finalText` is the director-reviewed (possibly edited) text for the text
 * kinds; ignored for projector_quotes (verbatim by construction).
 */
export async function projectDraft(args: {
  eventId: string;
  draftId: string;
  finalText: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { eventId, draftId } = args;
  const svc = (await createServiceClient()) as Loose;

  const { data: draftRow } = await svc
    .from("ai_drafts")
    .select(DRAFT_COLS)
    .eq("id", draftId)
    .eq("event_id", eventId)
    .maybeSingle();
  const draft = draftRow as AiDraftRow | null;
  if (!draft) return { success: false, error: "Draft not found for this event." };
  if (!isProjectorAiKind(draft.kind)) {
    return { success: false, error: "Not a projector draft." };
  }
  if (!["pending_review", "approved", "ready"].includes(draft.status)) {
    return {
      success: false,
      error: "Draft has no generated content yet — generate it first.",
    };
  }

  const kind = draft.kind as ProjectorAiKind;
  let payload: ProjectorMomentPayload;
  let approvedText: string;

  if (kind === "projector_quotes") {
    const built = await buildQuotesPayload(svc, eventId, draft.source_refs);
    if ("error" in built) return { success: false, error: built.error };
    payload = built.payload;
    approvedText = draft.draft_text ?? "Voices of the House";
  } else {
    const finalText = (args.finalText ?? "").trim();
    if (!finalText) {
      return { success: false, error: "Cannot project empty text." };
    }
    // Director no-numbers doctrine: AI text on a participant-facing surface may
    // not carry digits. (Verbatim quotes are the kids' own words — exempt.)
    if (/[0-9]/.test(finalText)) {
      return {
        success: false,
        error:
          "Projector text may not contain digits — edit them out before projecting.",
      };
    }
    const lines = splitLines(finalText);
    if (lines.length === 0) {
      return { success: false, error: "Cannot project empty text." };
    }
    const heading = await buildTextHeading(svc, eventId, draft);
    payload = { title: heading.title, subtitle: heading.subtitle, lines };
    approvedText = finalText;
  }

  const retire = await retireProjectedMoments(eventId);
  if (!retire.success) return retire;

  const { error: insErr } = await svc.from("projector_moments").insert({
    event_id: eventId,
    kind,
    payload,
    status: "projected",
    source_draft_id: draft.id,
    is_mock: draft.is_mock ?? false,
  });
  if (insErr) return { success: false, error: insErr.message };

  // Record the review outcome on the draft (approved_text = exactly what the
  // director projected).
  await setAiDraftReview({
    id: draft.id,
    status: "approved",
    approvedText,
  });

  return { success: true };
}

/** Per-kind headings for the text scenes. */
async function buildTextHeading(
  svc: Loose,
  eventId: string,
  draft: AiDraftRow
): Promise<{ title: string; subtitle: string | null }> {
  if (draft.kind === "projector_bill_summary" && draft.subject_id) {
    const { data: bill } = await svc
      .from("bills")
      .select("title, committee_name")
      .eq("id", draft.subject_id)
      .eq("event_id", eventId)
      .maybeSingle();
    const b = bill as { title: string | null; committee_name: string | null } | null;
    return {
      title: b?.title?.trim() || "The Bill Before the House",
      subtitle: b?.committee_name ?? null,
    };
  }
  if (draft.kind === "projector_framing" && draft.subject_id) {
    const { data: item } = await svc
      .from("agenda")
      .select("title")
      .eq("id", draft.subject_id)
      .eq("event_id", eventId)
      .maybeSingle();
    const i = item as { title: string | null } | null;
    return { title: i?.title?.trim() || "Up Next", subtitle: "Up next in the House" };
  }
  if (draft.kind === "projector_house_mind") {
    return { title: "What This House Cared About", subtitle: null };
  }
  if (draft.kind === "projector_qh_themes") {
    return { title: "The House Is Asking", subtitle: "Question Hour" };
  }
  return { title: "From the House", subtitle: null };
}

/**
 * VERBATIM-BY-CONSTRUCTION quotes payload: read the question ids the routine
 * selected (sourceRefs type="question"), then copy text + asker straight from
 * the DB. Model output contributes NOTHING to what is displayed.
 */
async function buildQuotesPayload(
  svc: Loose,
  eventId: string,
  sourceRefs: AiSourceRef[]
): Promise<{ payload: ProjectorMomentPayload } | { error: string }> {
  const ids = (sourceRefs ?? [])
    .filter((r) => r.type === "question" && typeof r.id === "string" && r.id)
    .map((r) => r.id as string)
    .slice(0, 8);
  if (ids.length === 0) {
    return { error: "The draft selected no questions to quote." };
  }

  const { data: evRow } = await svc
    .from("events")
    .select("name, chapter_name, cabinet_ministries")
    .eq("id", eventId)
    .maybeSingle();
  const ev = evRow as {
    name: string;
    chapter_name: string | null;
    cabinet_ministries: unknown;
  } | null;
  const ministries = effectiveMinistries(ev?.cabinet_ministries);

  const { data: qRows } = await svc
    .from("questions")
    .select("id, question_text, directed_to_ministry, submitted_by, status")
    .eq("event_id", eventId)
    .in("id", ids);
  const questions = ((qRows as Array<{
    id: string;
    question_text: string | null;
    directed_to_ministry: string | null;
    submitted_by: string | null;
    status: string | null;
  }>) ?? []).filter(
    (q) => q.status !== "rejected" && (q.question_text ?? "").trim()
  );
  if (questions.length === 0) {
    return { error: "None of the selected questions are still quotable." };
  }

  const participantIds = Array.from(
    new Set(questions.map((q) => q.submitted_by).filter((x): x is string => !!x))
  );
  const { data: pRows } = participantIds.length
    ? await svc
        .from("participants")
        .select("id, full_name, constituency_name")
        .in("id", participantIds)
    : { data: [] };
  const byId = new Map(
    ((pRows as Array<{
      id: string;
      full_name: string | null;
      constituency_name: string | null;
    }>) ?? []).map((p) => [p.id, p])
  );

  // Preserve the routine's curation order (the order of ids in sourceRefs).
  const order = new Map(ids.map((id, i) => [id, i]));
  questions.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  return {
    payload: {
      title: "Voices of the House",
      subtitle: ev?.chapter_name ?? ev?.name ?? null,
      quotes: questions.map((q) => {
        const p = q.submitted_by ? byId.get(q.submitted_by) : undefined;
        return {
          text: (q.question_text ?? "").trim(),
          name: p?.full_name ?? "A Member of the House",
          constituency: p?.constituency_name ?? null,
          ministry: q.directed_to_ministry
            ? ministryLabel(q.directed_to_ministry, ministries)
            : null,
        };
      }),
    },
  };
}
