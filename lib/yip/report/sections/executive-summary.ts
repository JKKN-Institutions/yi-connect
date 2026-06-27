import "server-only";

/**
 * YIP Chapter Round Report — data helper for the Executive Summary (the
 * chair's AI-drafted round narrative).
 *
 * Mirrors lib/yip/report/sections/awards-zero-hour.ts EXACTLY:
 *   1. `import "server-only"` — a data module (NOT "use server"); may export
 *      types + an async getter.
 *   2. gate with getYipEventAccess(eventId); if !canView return null so the
 *      section renders nothing (no-access / missing event never throws in the
 *      page's Suspense).
 *
 * The narrative itself is generated OUT-OF-BAND (the hourly Claude Code routine
 * via app/yip/api/ai-drafts). The app NEVER calls an LLM. This helper only
 * READS the round_narrative draft row (via lib/yip/ai/drafts.getAiDraft) and
 * shapes it for the section component:
 *   - status === "approved" + approved_text → render it as printable prose.
 *   - status === "pending_review" (+ canManage) → chair reviews draft_text.
 *   - requested / generating → "being drafted" notice (canManage only).
 *   - no row → "request AI narrative" entry point (canManage only).
 *
 * DISPUTE-PROOF / REVIEW-GATED: the printed official report renders
 * approved_text ONLY — never un-reviewed AI. The review surface (draft_text,
 * citation chips) is print:hidden and only ever shown to a manager.
 */
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getAiDraft } from "@/lib/yip/ai/drafts";
import type { AiDraftStatus, AiSourceRef } from "@/lib/yip/ai/types";

export type ExecutiveSummaryData = {
  /** The round_narrative draft id, when a row exists (needed for review actions). */
  draftId: string | null;
  /** Lifecycle status of the narrative draft; null when no row exists yet. */
  status: AiDraftStatus | null;
  /**
   * The chair-approved final narrative. The printed report renders THIS ONLY.
   * Null until the chair approves a draft.
   */
  approvedText: string | null;
  /**
   * The raw AI draft awaiting review. Surfaced ONLY to a manager in the review
   * control (print:hidden) — never printed. Null unless a draft has been
   * generated.
   */
  draftText: string | null;
  /** Anti-hallucination citations for the draft, shown as chips to the reviewer. */
  sourceRefs: AiSourceRef[];
  /** A short note the routine may attach (e.g. model used) — reviewer-only. */
  modelNote: string | null;
  /** True when status is requested/generating (the routine hasn't posted yet). */
  isPending: boolean;
};

/**
 * Fetch everything the Executive Summary section renders. Returns `null` when
 * the caller lacks view access (the section then renders nothing).
 *
 * Reads the single event-level round_narrative draft (subject_id = null).
 */
export async function getExecutiveSummaryData(
  eventId: string
): Promise<ExecutiveSummaryData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const draft = await getAiDraft(eventId, "round_narrative", null);

  if (!draft) {
    return {
      draftId: null,
      status: null,
      approvedText: null,
      draftText: null,
      sourceRefs: [],
      modelNote: null,
      isPending: false,
    };
  }

  const approvedText =
    draft.status === "approved" &&
    typeof draft.approved_text === "string" &&
    draft.approved_text.trim().length > 0
      ? draft.approved_text
      : null;

  const draftText =
    typeof draft.draft_text === "string" && draft.draft_text.trim().length > 0
      ? draft.draft_text
      : null;

  return {
    draftId: draft.id,
    status: draft.status,
    approvedText,
    draftText,
    sourceRefs: Array.isArray(draft.source_refs) ? draft.source_refs : [],
    modelNote: draft.model_note ?? null,
    isPending: draft.status === "requested" || draft.status === "generating",
  };
}
