import "server-only";

/**
 * "Feedback on Your Bill" — the AI craft-coaching card on the participant bill
 * page (/yip/me/bill), shown to the committee's drafting team.
 *
 * WHAT IT IS: after a committee's bill has enough drafted content, the hourly
 * out-of-band routine writes ONE warm, constructive note about the BILL's CRAFT
 * (kind='bill_feedback') — one genuine strength of the bill plus one concrete way
 * to strengthen it, with a nod to how it might better answer the opposition or
 * its implementation. This card reads that note and renders it for the drafters.
 *
 * CONTENT-SAFE (Director rule, NON-NEGOTIABLE — enforced by construction):
 *   • It is about the BILL (problem framing, provisions, expected impact,
 *     implementation, how it could answer the opposition) — NEVER a score, rank,
 *     percentage, jury comment, or comparison of PEOPLE/parties/drafters. It
 *     never names or blames an individual.
 *   • It MAY state the bill's own public vote outcome factually (passed /
 *     rejected) but frames it as learning, never judgement. No "best/worst bill",
 *     no cross-bill ranking.
 *   • The grounding that produced it (lib/yip/ai/grounding.ts
 *     buildBillFeedbackGrounding) reads ONLY yip.bills (+ event context) and
 *     NEVER yip.scores / yip.results.
 *
 * Gating (the card renders NOTHING when the event is not opted in):
 *   1. events.ai_enabled is true (chair opted the event in — OFF by default).
 *   2. A bill exists for this committee. Otherwise render nothing.
 * When opted in + a bill exists but no ready note yet → a soft placeholder so
 * the surface is discoverable while the routine catches up.
 *
 * Server-rendered. Reads everything through lib/yip/ai/* — never touches
 * yip.scores / yip.results.
 */
import { ScrollText, Sparkles, Lightbulb } from "lucide-react";
import {
  getBillFeedbackForCommittee,
  getEventAiEnabled,
} from "@/lib/yip/ai/drafts";

/** The text a drafter sees — prose only, never a score. */
function feedbackTextOf(text: string | null): string {
  return (text ?? "").trim();
}

export async function BillFeedbackCard({
  eventId,
  committeeName,
}: {
  eventId: string;
  /** The viewing participant's committee — the join key to their bill. */
  committeeName: string | null;
}) {
  // Gate 1 — chair opt-in. Cheap boolean; short-circuit when off so the card is
  // entirely absent for events that have not enabled AI.
  const aiEnabled = await getEventAiEnabled(eventId);
  if (!aiEnabled) return null;

  // No committee → no bill to coach. Render nothing (non-committee roles).
  if (!committeeName || !committeeName.trim()) return null;

  // Resolve THIS committee's bill_feedback draft (if any). The reader resolves
  // committee → bill → its bill_feedback row; returns null when there is no bill
  // or no draft yet. Reads ONLY ai_drafts + bills — never yip.scores.
  const row = await getBillFeedbackForCommittee(eventId, committeeName);

  // Showable state: ready/approved with usable prose. bill_feedback auto-shows
  // ('ready'); approved_text stays null unless a future review flow sets it.
  const note =
    row && (row.status === "ready" || row.status === "approved")
      ? feedbackTextOf(row.approved_text ?? row.draft_text)
      : "";

  // The bill the note cites, for a tidy header line.
  const billTitle =
    row?.source_refs.find((r) => r.type === "bill")?.label?.trim() || null;

  // ── Empty state ──────────────────────────────────────────────────────
  // Opted in but no ready note yet (bill too thin, or the routine has not caught
  // up). A warm placeholder so the team knows feedback is coming.
  if (!note) {
    return (
      <section className="rounded-2xl border border-dashed border-sky-400/45 bg-sky-50/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-100">
            <ScrollText className="size-4 text-sky-600" />
          </span>
          <h2 className="text-sm font-bold text-[#1a1a3e]">
            Feedback on Your Bill
          </h2>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[#1a1a3e]/55">
          Once your committee has drafted enough of the bill, a short, friendly
          note will appear here — one strength of your bill and one idea to make
          it even stronger. Keep drafting!
        </p>
        <p className="mt-2.5 text-[10.5px] leading-snug text-sky-700/70">
          ✨ Constructive feedback from AI on your bill&apos;s craft — never a
          score, rank, or comparison of people.
        </p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/40 px-5 py-5 shadow-sm">
      {/* sky → indigo accent bar (craft → polish) */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-300 to-[#FF9933]" />

      {/* Header + AI label */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-100">
            <ScrollText className="size-4 text-sky-600" />
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight text-[#1a1a3e]">
              Feedback on Your Bill
            </h2>
            <p className="text-[11px] leading-tight text-[#1a1a3e]/50">
              {billTitle
                ? `On: ${billTitle}`
                : "How your committee can sharpen the bill"}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
          <Sparkles className="size-2.5" />
          AI feedback
        </span>
      </div>

      {/* The constructive note (strength + one way to strengthen). */}
      <div className="mt-4 rounded-xl border border-sky-200/60 bg-white/70 px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="size-3.5 text-[#FF9933]" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#FF9933]">
            What&apos;s strong &amp; how to strengthen it
          </span>
        </div>
        <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-[#1a1a3e]/90">
          {note}
        </p>
      </div>

      {/* Content-safe framing footer. */}
      <p className="mt-4 border-t border-sky-200/60 pt-3 text-[10.5px] leading-snug text-[#1a1a3e]/45">
        ✨ Constructive feedback from AI on your bill&apos;s craft — its problem
        framing, provisions, impact, and implementation. It is about the bill,
        never a score, rank, or comparison of people.
      </p>
    </section>
  );
}

export default BillFeedbackCard;

