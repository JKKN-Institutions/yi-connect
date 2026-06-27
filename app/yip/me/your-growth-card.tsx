import "server-only";

/**
 * "Your Growth" — the per-session AI coaching timeline on the participant
 * dashboard (/yip/me).
 *
 * THE SELF-IMPROVING LOOP (participant-facing surface): after every scored
 * session, the hourly out-of-band routine writes a warm, self-referential
 * coaching note (kind='session_feedback'). This card reads THIS participant's
 * ordered notes and renders them as an encouraging per-session JOURNEY — each
 * scored session is one stop on a vertical timeline — and pulls the LATEST
 * "focus for next time" to the top so the student knows what to work on next.
 *
 * ABSOLUTE (Director rule, NON-NEGOTIABLE — enforced by construction):
 *   • ZERO numbers ever — no score, no rank, no average, no percentage, no
 *     count-of-judges, nothing numeric derived from scores. The card renders
 *     draft_text alone (free prose written by the routine) + a session title.
 *   • NEVER reads yip.scores / yip.results. It reads ONLY ai_drafts + agenda
 *     (for ordering, inside the data layer) via getParticipantSessionFeedback.
 *     It does NOT import lib/yip/scoring/* or touch a score row.
 *   • NEVER comparative. The notes coach the participant against THEIR OWN
 *     other criteria/sessions — never against another participant. The footer
 *     reinforces this so the framing is unambiguous to a minor.
 *
 * Gating (the card renders NOTHING when the event is not opted in):
 *   1. events.ai_enabled is true (chair opted the event in — OFF by default
 *      because the audience is minors).
 *   2. Otherwise it always renders — a soft "notes appear after each scored
 *      session" placeholder until the first note is ready, so the journey
 *      surface is discoverable from the start.
 *
 * Server-rendered. Visually DISTINCT from the navy your-day-card: a light,
 * uplifting growth motif (emerald sprout, a vertical timeline rail with saffron
 * nodes) so the two AI cards never read as duplicates.
 */
import { Sprout, Sparkles, Target, MessageCircleHeart } from "lucide-react";
import { getEventAiEnabled, getParticipantSessionFeedback } from "@/lib/yip/ai/drafts";
import type { AiDraftRow } from "@/lib/yip/ai/types";

/** Pull the human session title from a draft's grounded source_refs. */
function sessionTitleOf(row: AiDraftRow): string | null {
  const ref = row.source_refs.find((r) => r.type === "session");
  const label = ref?.label?.trim();
  return label && label.length > 0 ? label : null;
}

/** The text a participant sees for one note — prose only, never a score. */
function noteTextOf(row: AiDraftRow): string {
  // session_feedback has NO chair-review gate, so approved_text stays null and
  // draft_text is canonical. Prefer approved_text defensively if a future flow
  // ever populates it.
  return (row.approved_text ?? row.draft_text ?? "").trim();
}

export async function YourGrowthCard({
  eventId,
  participantId,
}: {
  eventId: string;
  participantId: string;
}) {
  // Gate — chair opt-in. Cheap boolean read; short-circuit when off so the
  // card is entirely absent for events that have not enabled AI.
  const aiEnabled = await getEventAiEnabled(eventId);
  if (!aiEnabled) return null;

  // Every session_feedback note for this participant, ALREADY ordered by the
  // session's (agenda.day, agenda.sequence_order) inside the data layer. This
  // reader touches ONLY ai_drafts + agenda — never yip.scores.
  const allRows = await getParticipantSessionFeedback(eventId, participantId);

  // Only show rows that are actually ready (auto-shows; no chair gate) AND
  // carry usable prose. requested/generating rows are dropped silently so the
  // timeline only ever shows finished, encouraging notes.
  const notes = allRows
    .filter(
      (r) =>
        (r.status === "ready" || r.status === "approved") && noteTextOf(r).length > 0
    )
    .map((r) => ({
      id: r.id,
      title: sessionTitleOf(r),
      text: noteTextOf(r),
    }));

  // ── Empty state ──────────────────────────────────────────────────────
  // Event is opted in but no note is ready yet (early event / first session
  // not scored, or the routine has not caught up). Show a warm placeholder so
  // the student knows growth notes are coming after each scored session.
  if (notes.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-emerald-400/45 bg-emerald-50/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <Sprout className="size-4 text-emerald-600" />
          </span>
          <h2 className="text-sm font-bold text-[#1a1a3e]">Your Growth</h2>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[#1a1a3e]/55">
          Your personal coaching notes will appear here after each scored
          session — one warm tip on a strength you showed and one focus for
          next time. Keep going!
        </p>
        <p className="mt-2.5 text-[10.5px] leading-snug text-emerald-700/70">
          ✨ Personal coaching from AI, based on your own sessions — never a
          score, rank or comparison.
        </p>
      </section>
    );
  }

  // The most recent note's "focus for next time" is the headline. We surface
  // the WHOLE latest note at the top (it already contains the strength + the
  // forward-looking focus the routine wrote), then list the journey below.
  const latest = notes[notes.length - 1];
  const journey = notes; // full timeline, oldest → newest

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/40 px-5 py-5 shadow-sm">
      {/* emerald → saffron accent bar (growth → energy) */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-amber-300 to-[#FF9933]" />

      {/* Header + AI label */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <Sprout className="size-4 text-emerald-600" />
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight text-[#1a1a3e]">
              Your Growth
            </h2>
            <p className="text-[11px] leading-tight text-[#1a1a3e]/50">
              Your journey through the House, session by session
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          <Sparkles className="size-2.5" />
          AI coaching
        </span>
      </div>

      {/* ── Latest "focus for next time" — pulled to the top ────────────── */}
      <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50/70 px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <Target className="size-3.5 text-[#FF9933]" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#FF9933]">
            Your focus for next time
          </span>
        </div>
        {latest.title && (
          <p className="mt-1 text-[11px] font-medium text-[#1a1a3e]/55">
            After: {latest.title}
          </p>
        )}
        <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-[#1a1a3e]/90">
          {latest.text}
        </p>
      </div>

      {/* ── The journey timeline (all notes, oldest → newest) ───────────── */}
      {journey.length > 1 && (
        <div className="mt-5">
          <div className="flex items-center gap-1.5">
            <MessageCircleHeart className="size-3.5 text-emerald-600" />
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              Your journey so far
            </h3>
          </div>

          <ol className="relative mt-3 space-y-4 pl-1">
            {/* vertical rail */}
            <span
              aria-hidden
              className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-gradient-to-b from-emerald-300 via-amber-300 to-[#FF9933]/60"
            />
            {journey.map((n, i) => {
              const isLatest = i === journey.length - 1;
              return (
                <li key={n.id} className="relative pl-6">
                  {/* node */}
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1 size-[15px] rounded-full border-2 border-white shadow-sm ${
                      isLatest ? "bg-[#FF9933]" : "bg-emerald-400"
                    }`}
                  />
                  {n.title && (
                    <p className="text-[12px] font-semibold text-[#1a1a3e]">
                      {n.title}
                    </p>
                  )}
                  <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-relaxed text-[#1a1a3e]/75">
                    {n.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Honesty + self-referential framing footer. */}
      <p className="mt-4 border-t border-emerald-200/60 pt-3 text-[10.5px] leading-snug text-[#1a1a3e]/45">
        ✨ Personal coaching from AI, based on your own sessions — never a score,
        rank or comparison. It looks only at how your own strengths grow from one
        session to the next.
      </p>
    </section>
  );
}

export default YourGrowthCard;
