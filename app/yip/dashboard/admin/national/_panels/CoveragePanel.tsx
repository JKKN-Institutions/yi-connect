import { getMinistryCoverage } from "@/lib/yip/national/corpus";
import { Layers, AlertCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// REFERENCE PANEL — "Ministry Coverage".
//
// Across all non-mock chapter rounds: how many chapters are running each
// ministry/committee, and how many delegates sat on it. Self-fetching server
// component — it owns its data getter (getMinistryCoverage) and its empty
// state. This is the template every other /national panel copies:
//   1. server component, no "use client"
//   2. one corpus getter from lib/yip/national/corpus.ts
//   3. honest empty state when hasData is false (never an all-zero table)
//   4. wrapped in the shared <PanelShell> chrome
//
// Gating is handled inside the getter (requireSuperAdmin → empty report on
// deny) and again by the page + admin layout. No event scope here — national.
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
        <Layers className="size-4 shrink-0 text-[#FF9933]" />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] px-3 py-2.5">
      <div className="text-lg font-semibold tabular-nums text-[#1a1a3e]">
        {value.toLocaleString("en-IN")}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#1a1a3e]/45">
        {label}
      </div>
    </div>
  );
}

export async function CoveragePanel() {
  const report = await getMinistryCoverage();

  // Honest empty state — no real tagged participants in any non-mock round yet.
  if (!report.hasData) {
    return (
      <PanelShell
        title="Ministry Coverage"
        subtitle="Chapters & delegates per GoI ministry, across all rounds"
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a1a3e]/15 px-4 py-10 text-center">
          <AlertCircle className="size-6 text-[#1a1a3e]/30" />
          <p className="text-sm font-medium text-[#1a1a3e]/70">
            No ministry deliberation captured yet
          </p>
          <p className="max-w-sm text-[12px] leading-relaxed text-[#1a1a3e]/45">
            As chapters allocate delegates to committees and run their rounds,
            each ministry will appear here with how many chapters covered it.
            {report.totals.events_in_scope > 0 && (
              <>
                {" "}
                {report.totals.events_in_scope.toLocaleString("en-IN")} real
                round{report.totals.events_in_scope === 1 ? "" : "s"} in scope
                so far.
              </>
            )}
          </p>
        </div>
      </PanelShell>
    );
  }

  const { totals, ministries, untouched_committees } = report;
  const topMinistries = ministries.slice(0, 12);

  return (
    <PanelShell
      title="Ministry Coverage"
      subtitle="Chapters & delegates per GoI ministry, across all non-demo rounds"
    >
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Ministries run" value={totals.ministries_touched} />
        <Stat label="Chapters" value={totals.chapters_in_scope} />
        <Stat label="Delegates tagged" value={totals.tagged_participants} />
        <Stat label="Rounds in scope" value={totals.events_in_scope} />
      </div>

      <div className="overflow-hidden rounded-lg border border-[#1a1a3e]/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-[#1a1a3e]/45">
              <th className="px-3 py-2">Ministry</th>
              <th className="px-3 py-2 text-right">Chapters</th>
              <th className="px-3 py-2 text-right">Delegates</th>
            </tr>
          </thead>
          <tbody>
            {topMinistries.map((m) => (
              <tr
                key={m.committee_name}
                className="border-b border-[#1a1a3e]/5 last:border-0"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1a1a3e]">
                      {m.ministry}
                    </span>
                    {!m.in_taxonomy && (
                      <span
                        title="Not yet in the GoI taxonomy — add it under Taxonomy"
                        className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                      >
                        needs taxonomy
                      </span>
                    )}
                  </div>
                  {m.schemes.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-[#1a1a3e]/45">
                      {m.schemes.slice(0, 3).join(" · ")}
                      {m.schemes.length > 3 ? " …" : ""}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#1a1a3e]/80">
                  {m.chapter_count.toLocaleString("en-IN")}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#1a1a3e]/80">
                  {m.participant_count.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ministries.length > topMinistries.length && (
        <p className="mt-2 text-[11px] text-[#1a1a3e]/40">
          Showing top {topMinistries.length} of{" "}
          {ministries.length.toLocaleString("en-IN")} ministries by chapter
          reach.
        </p>
      )}

      {totals.untagged_participants > 0 && (
        <p className="mt-3 text-[11px] text-[#1a1a3e]/45">
          {totals.untagged_participants.toLocaleString("en-IN")} delegate
          {totals.untagged_participants === 1 ? "" : "s"} have no committee
          recorded yet — they&apos;ll tag automatically once a committee is set.
        </p>
      )}

      {untouched_committees.length > 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-[#1a1a3e]/12 bg-[#1a1a3e]/[0.015] px-4 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#1a1a3e]/45">
            Catalogue committees not yet deliberated
          </p>
          <p className="text-[12px] leading-relaxed text-[#1a1a3e]/55">
            {untouched_committees.map((c) => c.ministry).join(" · ")}
          </p>
        </div>
      )}
    </PanelShell>
  );
}
