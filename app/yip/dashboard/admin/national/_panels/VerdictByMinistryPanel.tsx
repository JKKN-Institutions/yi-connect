import { getVerdictByMinistry } from "@/lib/yip/national/corpus-extras";
import { Landmark, AlertCircle, Info } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// PANEL — "Verdict by Ministry".
//
// Where bills exist, the per-ministry rollup of what young India DECIDED: bills
// passed vs rejected vs draft, plus the summed vote tally, for each ministry the
// committee tag resolves to. The "verdict" is the EVIDENCE (the tally), never an
// opinion. Built on getVerdictByMinistry (lib/yip/national/corpus-extras), which
// sits on top of getBillPipeline so the deterministic tagging lives in one place.
// Untagged bills are excluded from any ministry verdict but surfaced as a gap.
//
// Mirrors CoveragePanel: server component, one getter, own chrome, honest empty
// state — with ~2 mock bills today this is empty and shows the "verdicts appear
// as committees pass bills" state. Gating inside the getter + page + layout.
//
// FUTURE AI HOOK: a one-line synthesised stance per ministry (from bill text) is
// exactly what a later LLM layer would generate FROM this tally — consuming
// these numbers, not replacing them. No LLM is called here.
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
        <Landmark className="size-4 shrink-0 text-[#FF9933]" />
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

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold tabular-nums text-[#1a1a3e]">
        {value.toLocaleString("en-IN")}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-[#1a1a3e]/40">
        {label}
      </span>
    </div>
  );
}

// A ministry is "limited evidence" when it rests on a single bill — too thin to
// read a national signal. Honest labelling, not suppression.
const SPARSE_BILL_THRESHOLD = 2;

export async function VerdictByMinistryPanel() {
  const report = await getVerdictByMinistry();

  if (!report.hasData) {
    return (
      <PanelShell
        title="Verdict by Ministry"
        subtitle="What young India decided, per GoI ministry"
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a1a3e]/15 px-4 py-10 text-center">
          <AlertCircle className="size-6 text-[#1a1a3e]/30" />
          <p className="text-sm font-medium text-[#1a1a3e]/70">
            No ministry verdicts yet
          </p>
          <p className="max-w-sm text-[12px] leading-relaxed text-[#1a1a3e]/45">
            Once committees pass or reject bills, each ministry gets a verdict
            card here — how many bills passed vs rejected, and the votes behind
            them. Verdicts appear as the 2026 season runs.
            {report.totals.untagged_bills > 0 && (
              <>
                {" "}
                {report.totals.untagged_bills.toLocaleString("en-IN")} bill
                {report.totals.untagged_bills === 1 ? "" : "s"} can&apos;t be
                attributed yet (no committee recorded).
              </>
            )}
          </p>
        </div>
      </PanelShell>
    );
  }

  const { totals, ministries } = report;
  const topMinistries = ministries.slice(0, 8);

  return (
    <PanelShell
      title="Verdict by Ministry"
      subtitle="Bills decided per ministry, across all non-demo rounds"
    >
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] px-3 py-2.5">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#1a1a3e]/40" />
        <p className="text-[11px] leading-relaxed text-[#1a1a3e]/55">
          Each card shows the bill tally the corpus holds — not a judgement.
          Ministries marked{" "}
          <span className="font-medium">limited evidence</span> rest on a single
          bill so far.
        </p>
      </div>

      <div className="space-y-2.5">
        {topMinistries.map((m) => (
          <div
            key={m.ministry}
            className="rounded-lg border border-[#1a1a3e]/8 px-4 py-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-[#1a1a3e]">{m.ministry}</span>
              {m.bills_total < SPARSE_BILL_THRESHOLD && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  limited evidence
                </span>
              )}
              {!m.in_taxonomy && (
                <span
                  title="Not yet in the GoI taxonomy — add it under Taxonomy"
                  className="rounded-full bg-[#1a1a3e]/8 px-1.5 py-0.5 text-[10px] font-semibold text-[#1a1a3e]/55"
                >
                  needs taxonomy
                </span>
              )}
            </div>
            {m.schemes.length > 0 && (
              <div className="mb-2 truncate text-[11px] text-[#1a1a3e]/45">
                {m.schemes.slice(0, 3).join(" · ")}
                {m.schemes.length > 3 ? " …" : ""}
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              <MetricChip label="Bills" value={m.bills_total} />
              <MetricChip label="Passed" value={m.passed} />
              <MetricChip label="Rejected" value={m.rejected} />
              <MetricChip
                label="Net votes"
                value={m.votes_for - m.votes_against}
              />
            </div>
          </div>
        ))}
      </div>

      {ministries.length > topMinistries.length && (
        <p className="mt-3 text-[11px] text-[#1a1a3e]/40">
          Showing {topMinistries.length} of{" "}
          {ministries.length.toLocaleString("en-IN")} ministries ·{" "}
          {totals.bills_considered.toLocaleString("en-IN")} bills considered.
        </p>
      )}

      {totals.untagged_bills > 0 && (
        <p className="mt-3 text-[11px] text-[#1a1a3e]/45">
          {totals.untagged_bills.toLocaleString("en-IN")} bill
          {totals.untagged_bills === 1 ? "" : "s"} excluded from ministry
          verdicts — no committee recorded to attribute them.
        </p>
      )}
    </PanelShell>
  );
}
