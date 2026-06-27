import "server-only";

/**
 * "Your Day in the House" — the Day-2-morning AI recap card on the participant
 * dashboard (/yip/me).
 *
 * DISPUTE-PROOF (Director rule, NON-NEGOTIABLE): this card renders ONLY the
 * participant's own factual participation (role, party, committee → ministry +
 * scheme, constituency, the national topic) plus the warm AI recap prose.
 * It shows ZERO numeric scores, ZERO rank, ZERO comparison to anyone else.
 * Exact scores cause disputes — so they never reach this surface, and the
 * grounding payload that produced the recap (lib/yip/ai/grounding.ts) is
 * score-free by construction.
 *
 * Gating (all three must hold or the card renders NOTHING):
 *   1. events.ai_enabled is true (chair opted the event in — OFF by default
 *      because the audience is minors).
 *   2. A participant_story draft row exists for THIS participant.
 *   3. Its status is "ready" (the normal terminal state for participant_story)
 *      or "approved" (defensive — should a future flow review these).
 * Any other state (no row / requested / generating / rejected / ai disabled)
 * → render a soft empty placeholder so early/draft events degrade gracefully.
 *
 * Server-rendered. Reads everything through lib/yip/ai/* — never touches
 * yip.scores / yip.results, and never the ai_drafts table directly.
 */
import { Sparkles, Landmark, Flag, MapPin, Users, BookOpen } from "lucide-react";
import { getAiDraft, getEventAiEnabled } from "@/lib/yip/ai/drafts";
import { buildParticipantStoryGrounding } from "@/lib/yip/ai/grounding";

/** A single factual chip in the dispute-proof fact row. */
function FactChip({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${tint}`}
      title={label}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate max-w-[14rem]">{value}</span>
    </span>
  );
}

export async function YourDayInTheHouseCard({
  eventId,
  participantId,
}: {
  eventId: string;
  participantId: string;
}) {
  // Gate 1 — chair opt-in. Cheap boolean read; short-circuit when off.
  const aiEnabled = await getEventAiEnabled(eventId);
  if (!aiEnabled) return null;

  // Gate 2/3 — the participant's own story draft, in a showable state.
  const draft = await getAiDraft(eventId, "participant_story", participantId);

  const showable =
    draft && (draft.status === "ready" || draft.status === "approved");

  // participant_story carries the recap in draft_text; approved_text is only
  // populated if a (future) review flow runs, so prefer it when present.
  const recap = showable
    ? (draft.approved_text ?? draft.draft_text ?? "").trim()
    : "";

  // Pending / generating / no-row-yet → soft placeholder (not nothing) so the
  // student knows a recap is coming. Truly off (gate 1) already returned null.
  if (!showable || !recap) {
    return (
      <section className="rounded-2xl border border-dashed border-[#FF9933]/35 bg-[#FF9933]/[0.04] px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#FF9933]" />
          <h2 className="text-sm font-bold text-[#1a1a3e]">
            Your Day in the House
          </h2>
        </div>
        <p className="mt-1.5 text-xs text-[#1a1a3e]/55">
          Your personalised recap of the debate will appear here on Day 2
          morning. Check back soon.
        </p>
      </section>
    );
  }

  // Build the score-free factual chip row from the same grounding the recap was
  // written from. Returns null if the participant/event vanished — then we show
  // the recap prose alone (still dispute-proof; chips are decorative facts).
  const grounding = await buildParticipantStoryGrounding(
    eventId,
    participantId
  );
  const p = grounding?.participant;
  const ministry = grounding?.ministry ?? null;
  const nationalTopic = grounding?.nationalTopics?.[0] ?? null;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a3e] to-[#2a2a5e] px-5 py-5 text-white shadow-lg ring-1 ring-[#FF9933]/20">
      {/* saffron accent bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FF9933] via-amber-300 to-[#FF9933]" />

      {/* Header + AI label */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#FF9933]/20">
            <Sparkles className="size-4 text-[#FF9933]" />
          </span>
          <h2 className="text-base font-bold leading-tight">
            Your Day in the House
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FFD9A0]">
          <Sparkles className="size-2.5" />
          AI-generated
        </span>
      </div>

      {/* The warm recap prose. whitespace-pre-line preserves paragraph breaks. */}
      <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-white/90">
        {recap}
      </p>

      {/* Dispute-proof factual chip row — facts only, no scores/rank ever. */}
      {p && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
          {p.partyName && (
            <FactChip
              icon={Flag}
              label="Party"
              value={p.partyName}
              tint="bg-white/10 text-white/85"
            />
          )}
          {p.committeeName && (
            <FactChip
              icon={Users}
              label="Committee / Ministry"
              value={
                ministry?.scheme
                  ? `${p.committeeName} · ${ministry.scheme}`
                  : p.committeeName
              }
              tint="bg-purple-400/20 text-purple-100"
            />
          )}
          {p.constituencyName && (
            <FactChip
              icon={MapPin}
              label="Constituency"
              value={p.constituencyName}
              tint="bg-white/10 text-white/85"
            />
          )}
          {nationalTopic?.title && (
            <FactChip
              icon={BookOpen}
              label="National topic"
              value={nationalTopic.title}
              tint="bg-[#FF9933]/20 text-[#FFD9A0]"
            />
          )}
        </div>
      )}

      {/* Honesty footer: this is an AI recap of facts, not a score. */}
      <p className="mt-3 text-[10.5px] leading-snug text-white/45">
        ✨ Written by AI from your own participation record. It is a recap of
        what you did — not a score, rank or comparison.
      </p>
    </section>
  );
}

export default YourDayInTheHouseCard;
