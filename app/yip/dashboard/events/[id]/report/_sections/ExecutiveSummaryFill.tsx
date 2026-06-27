"use client";

/**
 * Chair review control for the Executive Summary (the AI-drafted round
 * narrative). Cloned from AwardsZeroHourFill.tsx — a small "use client" child
 * that calls its section's server actions and refreshes the route on success.
 * Entirely `print:hidden`: the printed report shows the APPROVED narrative only
 * (rendered by the parent server component), never this review surface.
 *
 * The app NEVER calls an LLM. "Generate draft" only ENQUEUES a request row
 * (requestRoundNarrative) for the hourly out-of-band routine to pick up; the
 * copy says the draft will be ready shortly. Once the routine posts the draft
 * (status → pending_review) the chair sees the draft_text in an editable
 * textarea with citation chips, and can Approve (saves approved_text),
 * Regenerate (re-queues), or Discard (rejects).
 *
 * States (driven by `status` from the section's data helper):
 *   null / "requested" / "generating"  → "Generate draft" button or "being
 *                                         drafted" notice.
 *   "pending_review"                    → review: textarea + chips + Approve /
 *                                         Regenerate / Discard.
 *   "rejected"                          → "Generate draft" button (re-request).
 *   "approved"                          → handled by the parent; a small
 *                                         "Revise / regenerate" affordance is
 *                                         still offered here.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Trash2, Check } from "lucide-react";
import {
  requestRoundNarrative,
  approveDraft,
  rejectDraft,
  regenerate,
} from "@/app/yip/actions/ai-drafts";
import type { AiDraftStatus, AiSourceRef } from "@/lib/yip/ai/types";

export function ExecutiveSummaryFill({
  eventId,
  draftId,
  status,
  draftText,
  sourceRefs,
  modelNote,
}: {
  eventId: string;
  /** The round_narrative draft id; null when no row exists yet. */
  draftId: string | null;
  /** Lifecycle status; null when no row exists yet. */
  status: AiDraftStatus | null;
  /** Raw AI draft awaiting review (only present when status=pending_review). */
  draftText: string | null;
  /** Citations for the draft (anti-hallucination chips). */
  sourceRefs: AiSourceRef[];
  /** Reviewer-only note the routine may attach (e.g. model). */
  modelNote: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(draftText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    fn: () => Promise<{ success: true } | { success: false; error: string }>
  ) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function generate() {
    run(() => requestRoundNarrative(eventId));
  }

  function approve() {
    const text = value.trim();
    if (!text) {
      setError("Cannot approve an empty narrative.");
      return;
    }
    if (!draftId) {
      setError("No draft to approve yet.");
      return;
    }
    run(() => approveDraft(eventId, draftId, text));
  }

  function discard() {
    if (!draftId) return;
    run(() => rejectDraft(eventId, draftId));
  }

  function regen() {
    run(() => regenerate(eventId, "round_narrative"));
  }

  // ── Citation chips (anti-hallucination — the rows the draft was built on) ──
  const chips =
    sourceRefs.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-[#1a1a3e]/45">
          Grounded on:
        </span>
        {sourceRefs.map((ref, i) => (
          <span
            key={`${ref.type}-${ref.id ?? i}`}
            title={ref.type}
            className="inline-flex max-w-[18rem] items-center gap-1 truncate rounded-full border border-[#1a1a3e]/12 bg-[#1a1a3e]/[0.03] px-2 py-0.5 text-[11px] text-[#1a1a3e]/70"
          >
            <span className="font-semibold uppercase tracking-wide text-[#FF9933]">
              {ref.type.replace(/_/g, " ")}
            </span>
            <span className="truncate">{ref.label}</span>
          </span>
        ))}
      </div>
    ) : null;

  // ── State: no draft yet, or it was rejected → offer to generate. ──────────
  if (status === null || status === "rejected") {
    return (
      <div className="print:hidden mt-1 space-y-2">
        <p className="text-sm text-[#1a1a3e]/40">
          {status === "rejected"
            ? "Previous draft was discarded. You can request a fresh one."
            : "No executive summary yet."}
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#FF9933]/40 bg-[#FF9933]/5 px-2.5 py-1 text-xs font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10 disabled:opacity-50"
        >
          <Sparkles className="size-3" />
          {pending ? "Requesting…" : "Generate draft"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[11px] text-[#1a1a3e]/45">
          AI runs hourly off-platform — the draft will be ready shortly for your
          review. Nothing is published until you approve it.
        </p>
      </div>
    );
  }

  // ── State: requested / generating → being drafted, no action yet. ─────────
  if (status === "requested" || status === "generating") {
    return (
      <div className="print:hidden mt-1 space-y-2">
        <p className="flex items-center gap-1.5 text-sm text-[#1a1a3e]/55">
          <Sparkles className="size-3.5 text-[#FF9933]" />
          AI draft requested — it&apos;s being prepared off-platform and will
          appear here for review shortly (within the hour). Refresh later.
        </p>
        <button
          type="button"
          onClick={regen}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1 text-xs font-medium text-[#1a1a3e]/70 transition-colors hover:bg-[#1a1a3e]/5 disabled:opacity-50"
        >
          <RefreshCw className="size-3" />
          Re-request
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── State: pending_review → editable draft + chips + Approve/Regen/Discard ─
  // (Also reachable for status="approved" via the parent's "revise" entry.)
  return (
    <div className="print:hidden mt-1 space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/55">
        <Sparkles className="size-3 text-[#FF9933]" />
        AI-generated draft — review and edit before approving. Only the approved
        text is printed in the official report.
      </p>

      {chips}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={10}
        placeholder="The executive summary narrative…"
        className="w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm leading-relaxed text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />

      {modelNote && (
        <p className="text-[11px] text-[#1a1a3e]/40">{modelNote}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1a1a3e] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
        >
          <Check className="size-3.5" />
          {pending ? "Working…" : "Approve & publish"}
        </button>
        <button
          type="button"
          onClick={regen}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#FF9933]/40 bg-[#FF9933]/5 px-3 py-1.5 text-xs font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10 disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" />
          Regenerate
        </button>
        <button
          type="button"
          onClick={discard}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#1a1a3e]/15 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
}
