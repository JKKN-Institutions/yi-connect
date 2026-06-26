import { getParticipationRollup } from "@/lib/yip/national/corpus-extras";
import { Users, AlertCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// PANEL — "National Participation" (reach across the country).
//
// How far YIP has actually run, all from real rounds: chapters that ran a round,
// delegates on the floor, distinct schools represented, zones covered, plus a
// coverage-by-zone breakdown and any published awards. Consumes
// getParticipationRollup (lib/yip/national/corpus-extras), which excludes
// is_mock and counts a chapter only once a real delegate exists. Mirrors
// CoveragePanel: server component, one getter, own chrome, honest empty state.
// Gating inside the getter (requireSuperAdmin → empty on deny) + page + layout.
// NO LLM — pure counts over the non-mock corpus.
// ═══════════════════════════════════════════════════════════════════════

function PanelShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#1a1a3e]/8 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-[#1a1a3e]/8 px-5 py-4">
        <Users className="size-4 shrink-0 text-[#FF9933]" />
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a3e]">{title}</h2>
          {subtitle && (
            <p className="text-[12px] text-[#1a1a3e]/50">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] px-3 py-2.5">
      <div className="text-lg font-semibold tabular-nums text-[#1a1a3e]">
        {value.toLocaleString("en-IN")}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#1a1a3e]/45">
        {label}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-[#1a1a3e]/40">{hint}</div>}
    </div>
  );
}

export async function ParticipationPanel() {
  const report = await getParticipationRollup();

  if (!report.hasData) {
    return (
      <PanelShell
        title="National Participation"
        subtitle="Reach across chapters, delegates, schools & zones"
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a1a3e]/15 px-4 py-10 text-center">
          <AlertCircle className="size-6 text-[#1a1a3e]/30" />
          <p className="text-sm font-medium text-[#1a1a3e]/70">
            No chapter rounds run yet
          </p>
          <p className="max-w-sm text-[12px] leading-relaxed text-[#1a1a3e]/45">
            As chapters run their rounds, national reach — chapters, delegates,
            schools and zones covered — appears here. It grows with every round
            of the 2026 season.
          </p>
        </div>
      </PanelShell>
    );
  }

  const { zone_breakdown } = report;

  return (
    <PanelShell
      title="National Participation"
      subtitle="Reach across all real chapter rounds"
    >
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat
          label="Chapters"
          value={report.chapters_with_round}
          hint={`${report.rounds.toLocaleString("en-IN")} round${
            report.rounds === 1 ? "" : "s"
          }`}
        />
        <Stat
          label="Delegates"
          value={report.delegates}
          hint={`${report.checked_in_day1.toLocaleString("en-IN")} checked in`}
        />
        <Stat label="Schools" value={report.schools} />
        <Stat label="Zones covered" value={report.zones_covered} />
      </div>

      {report.awards_published > 0 && (
        <p className="mb-4 rounded-lg border border-[#138808]/15 bg-[#138808]/[0.04] px-3 py-2 text-[12px] text-[#138808]">
          {report.awards_published.toLocaleString("en-IN")} recognition
          {report.awards_published === 1 ? "" : "s"} published across results so
          far.
        </p>
      )}

      {zone_breakdown.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[#1a1a3e]/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-[#1a1a3e]/45">
                <th className="px-3 py-2">Zone</th>
                <th className="px-3 py-2 text-right">Chapters</th>
                <th className="px-3 py-2 text-right">Delegates</th>
              </tr>
            </thead>
            <tbody>
              {zone_breakdown.map((z) => (
                <tr
                  key={z.zone}
                  className="border-b border-[#1a1a3e]/5 last:border-0"
                >
                  <td className="px-3 py-2.5 font-medium text-[#1a1a3e]">
                    {z.zone}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1a1a3e]/80">
                    {z.chapters.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#1a1a3e]/80">
                    {z.delegates.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#1a1a3e]/12 px-4 py-3 text-[12px] text-[#1a1a3e]/45">
          Zone breakdown appears once rounds carry a zone.
        </p>
      )}

      <p className="mt-3 text-[11px] text-[#1a1a3e]/40">
        Counts only real (non-demo) rounds with at least one delegate — seeded
        draft events are excluded so reach is never overstated.
      </p>
    </PanelShell>
  );
}
