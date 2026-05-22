import {
  PHASES,
  PHASE_LABELS,
  PHASE_MONTHS,
  type Phase,
} from "@/lib/yi-future/constants";

export type PhaseEventStatus = {
  phase: Phase;
  completed: number;
  scheduled: number;
};

const PHASE_COLORS: Record<Phase, string> = {
  phase_a: "#FF9933",
  phase_b: "#F5A623",
  phase_c: "#138808",
};

/**
 * Visualizer for the 3-phase journey. Shows completion progress per phase.
 * Used on both /chapter dashboard and /chapter/journey.
 */
export function PhaseTracker({
  statuses,
  compact = false,
}: {
  statuses: PhaseEventStatus[];
  compact?: boolean;
}): React.JSX.Element {
  const lookup = new Map(statuses.map((s) => [s.phase, s]));
  return (
    <div
      className={`grid grid-cols-3 gap-${compact ? 2 : 4} ${compact ? "" : "my-2"}`}
    >
      {PHASES.map((p, i) => {
        const s = lookup.get(p) ?? { phase: p, completed: 0, scheduled: 0 };
        const ratio = Math.min(1, s.completed / 3);
        const color = PHASE_COLORS[p];
        return (
          <div
            key={p}
            className={`rounded border border-navy/10 ${
              compact ? "p-2" : "p-3"
            } bg-white`}
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`font-black ${compact ? "text-lg" : "text-2xl"}`}
                style={{ color }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
                {PHASE_MONTHS[p]}
              </span>
            </div>
            {!compact && (
              <div className="mt-1 text-xs font-semibold text-navy truncate">
                {PHASE_LABELS[p]}
              </div>
            )}
            <div className="mt-2 h-1.5 w-full rounded-full bg-navy/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${ratio * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <div className="mt-1 text-[10px] font-mono text-navy/60">
              {s.completed}/3 completed
              {s.scheduled > s.completed && (
                <span className="ml-1 text-navy/40">
                  · {s.scheduled - s.completed} upcoming
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
