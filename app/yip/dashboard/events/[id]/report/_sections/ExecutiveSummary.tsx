/**
 * YIP Chapter Round Report — Executive Summary (the chair's AI-drafted round
 * narrative). Slotted at the TOP of the report.
 *
 * Self-fetching server component (contract per Overview.tsx):
 *   - default-exported async server component (no "use client" here;
 *     interactivity lives in the ExecutiveSummaryFill "use client" child).
 *   - signature: ({ eventId, canManage }: { eventId: string; canManage: boolean }).
 *   - fetches its OWN data via lib/yip/report/sections/executive-summary.ts.
 *   - returns null when the getter returns null (no-access / missing event), so
 *     it never throws inside the page's Suspense.
 *
 * REVIEW-GATED + DISPUTE-PROOF: the printed report renders the chair-APPROVED
 * narrative ONLY (`approvedText`) — never un-reviewed AI in an official report.
 * The review surface (draft / chips / buttons) is print:hidden and shown only
 * to a manager.
 *
 * Render matrix:
 *   approved + approvedText      → printable prose (+ ✨ label) + a print:hidden
 *                                  "revise" control for managers.
 *   canManage (any other state)  → the ExecutiveSummaryFill review control
 *                                  (request / being-drafted / review draft).
 *   not canManage, not approved  → render nothing (no half-baked AI for viewers
 *                                  or in early/empty events).
 */
import { getExecutiveSummaryData } from "@/lib/yip/report/sections/executive-summary";
import { ExecutiveSummaryFill } from "./ExecutiveSummaryFill";

export default async function ExecutiveSummarySection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getExecutiveSummaryData(eventId);
  if (!data) return null;

  const hasApproved =
    data.status === "approved" && !!data.approvedText;

  // Nothing approved AND the viewer can't manage → render nothing. Keeps the
  // printed report clean for early/empty events and never shows un-reviewed AI.
  if (!hasApproved && !canManage) return null;

  return (
    <div className="space-y-3">
      {hasApproved ? (
        <>
          {/* Printable, chair-approved narrative. */}
          <p className="print:hidden flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#FF9933]">
            <span aria-hidden>✨</span> AI-generated · chair-approved
          </p>
          <div className="whitespace-pre-line text-sm leading-relaxed text-[#1a1a3e]/85">
            {data.approvedText}
          </div>
          {/* A subtle AI attribution that DOES print, so the official report is
              transparent about provenance. */}
          <p className="mt-2 hidden text-[11px] italic text-[#1a1a3e]/40 print:block">
            Narrative AI-drafted from event records and reviewed &amp; approved
            by the chapter chair.
          </p>

          {/* Manager-only revise affordance (print:hidden). */}
          {canManage && (
            <details className="print:hidden mt-2">
              <summary className="cursor-pointer text-xs font-medium text-[#1a1a3e]/55 hover:text-[#1a1a3e]">
                Revise or regenerate this narrative
              </summary>
              <div className="mt-2">
                <ExecutiveSummaryFill
                  eventId={eventId}
                  draftId={data.draftId}
                  status={data.status}
                  draftText={data.approvedText}
                  sourceRefs={data.sourceRefs}
                  modelNote={data.modelNote}
                />
              </div>
            </details>
          )}
        </>
      ) : (
        // No approved narrative yet → manager review surface only (we already
        // returned null above when !canManage).
        <>
          <p className="text-sm text-[#1a1a3e]/40">
            {data.isPending
              ? "An AI executive summary has been requested."
              : "No executive summary yet. Generate an AI draft, review it, then approve to include it in the report."}
          </p>
          <ExecutiveSummaryFill
            eventId={eventId}
            draftId={data.draftId}
            status={data.status}
            draftText={data.draftText}
            sourceRefs={data.sourceRefs}
            modelNote={data.modelNote}
          />
        </>
      )}
    </div>
  );
}
