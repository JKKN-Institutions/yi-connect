export type LiveSpotlightData = {
  id: string;
  name: string;
  current: { title: string; status: "in_progress" | "upcoming" } | null;
  agendaDone: number;
  agendaTotal: number;
  scores: number;
  voteSessions: number;
};

export function LiveSpotlight({ data }: { data: LiveSpotlightData | null }) {
  if (!data) return null;

  const { name, current, agendaDone, agendaTotal, scores, voteSessions } = data;
  const pct = agendaTotal > 0 ? Math.round((agendaDone / agendaTotal) * 100) : 0;

  const currentLabel =
    current === null
      ? "Between sessions"
      : current.status === "in_progress"
        ? `In progress: ${current.title}`
        : `Up next: ${current.title}`;

  return (
    <div className="rounded-2xl border border-[#138808]/30 bg-[#138808]/[0.02] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#138808] opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-[#138808]" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#138808]">
          Happening now
        </span>
      </div>

      <h2 className="mt-3 text-xl font-semibold leading-tight text-[#1a1a3e] sm:text-2xl">
        {name}
      </h2>

      <p className="mt-1.5 text-sm text-[#1a1a3e]/70">{currentLabel}</p>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-[#1a1a3e]/55">
          <span className="font-medium text-[#1a1a3e]/70">
            <span className="tabular-nums">{agendaDone}</span> of{" "}
            <span className="tabular-nums">{agendaTotal}</span> agenda items done
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1a1a3e]/8">
          <div
            className="h-full rounded-full bg-[#138808] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums text-[#1a1a3e]">{scores}</div>
          <div className="mt-0.5 text-xs text-[#1a1a3e]/55">scores in</div>
        </div>
        <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums text-[#1a1a3e]">{voteSessions}</div>
          <div className="mt-0.5 text-xs text-[#1a1a3e]/55">
            vote {voteSessions === 1 ? "round" : "rounds"}
          </div>
        </div>
      </div>
    </div>
  );
}
