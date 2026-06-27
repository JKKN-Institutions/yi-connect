"use client";

/**
 * Chair / organiser control for the participant "Your Day in the House" AI
 * cards. Rendered on the report toolbar ONLY when canManage is true, and hidden
 * from the printout (`print:hidden`).
 *
 * Two actions, both gated server-side via getYipEventAccess(eventId).canManage:
 *   1. Enable toggle — flips events.ai_enabled (setEventAiEnabled). OFF by
 *      default because the cards are shown to minors; nothing auto-shows until
 *      the chair turns this on.
 *   2. "Prepare Day-2 cards" — enqueues one participant_story request per
 *      participant (requestParticipantStories). The hourly out-of-band routine
 *      drafts them; once each is "ready" AND ai_enabled, the student's card
 *      auto-shows. No LLM runs in the app.
 *
 * Mirrors the AwardsZeroHourFill pattern: useState + useTransition, calls the
 * server action, router.refresh() on success, brand colors #FF9933 / #1a1a3e.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check } from "lucide-react";
import {
  setEventAiEnabled,
  requestParticipantStories,
} from "@/app/yip/actions/ai-drafts";

export function ParticipantCardsControl({
  eventId,
  initialEnabled,
  readyCount,
  totalCount,
}: {
  eventId: string;
  initialEnabled: boolean;
  /** participant_story drafts already in a showable state. */
  readyCount: number;
  /** participants in the event (the denominator for "X of N ready"). */
  totalCount: number;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [togglePending, startToggle] = useTransition();
  const [prepPending, startPrep] = useTransition();

  function toggle() {
    setError(null);
    setNote(null);
    const next = !enabled;
    startToggle(async () => {
      const res = await setEventAiEnabled(eventId, next);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setEnabled(next);
      router.refresh();
    });
  }

  function prepare() {
    setError(null);
    setNote(null);
    startPrep(async () => {
      const res = await requestParticipantStories(eventId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      const enq = typeof res.enqueued === "number" ? res.enqueued : 0;
      setNote(
        enq > 0
          ? `Requested ${enq} card${enq === 1 ? "" : "s"}. The AI routine fills these hourly — they appear on students' dashboards once ready.`
          : "All participant cards are already requested or ready."
      );
      router.refresh();
    });
  }

  return (
    <div className="print:hidden rounded-lg border border-[#FF9933]/30 bg-[#FF9933]/[0.04] px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-[#FF9933]" />
          <span className="text-sm font-semibold text-[#1a1a3e]">
            Day-2 AI recap cards
          </span>
        </div>

        {/* Enable toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={togglePending}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-[#FF9933]" : "bg-[#1a1a3e]/20"
          }`}
        >
          <span
            className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-xs text-[#1a1a3e]/60">
          {enabled ? "On — students see their card" : "Off — cards hidden"}
        </span>

        {/* Ready status + prepare button */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-medium text-[#1a1a3e]/70">
            {readyCount} of {totalCount} ready
          </span>
          <button
            type="button"
            onClick={prepare}
            disabled={prepPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1a3e] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
          >
            {prepPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : readyCount > 0 ? (
              <Check className="size-3" />
            ) : (
              <Sparkles className="size-3" />
            )}
            {prepPending ? "Requesting…" : "Prepare Day-2 cards"}
          </button>
        </div>
      </div>

      {note && <p className="mt-2 text-xs text-emerald-700">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <p className="mt-2 text-[11px] leading-snug text-[#1a1a3e]/45">
        Cards show each student a warm, dispute-proof recap of their own
        participation — no scores, no rank. Generated out-of-band by an hourly
        routine; turn the toggle on to reveal them.
      </p>
    </div>
  );
}

export default ParticipantCardsControl;
