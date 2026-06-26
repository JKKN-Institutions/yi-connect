import { getBillPipeline } from "@/lib/yip/national/corpus-extras";
import { Gavel, AlertCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// PANEL — "Bill Pipeline" (the legislative idea pipeline).
//
// Every youth-drafted bill across non-mock rounds, tagged to its GoI ministry +
// scheme via committee_name, with its floor outcome (passed / rejected / draft).
// Mirrors CoveragePanel: server component, one corpus getter (getBillPipeline
// from lib/yip/national/corpus-extras), own PanelShell chrome, honest empty
// state when no real bill exists yet (the case today — only mock bills, which
// the getter excludes). Gating lives inside the getter (requireSuperAdmin →
// empty report on deny) and again on the page + admin layout. NO LLM — tagging
// is purely the deterministic committee_name join.
//
// FUTURE AI HOOK: when committee_name is NULL a classifier could tag a bill from
// its objective/problem_statement. Today such bills surface as "untagged" and
// are never guessed into a ministry.
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
        <Gavel className="size-4 shrink-0 text-[#FF9933]" />
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

function StatusBadge({ bucket }: { bucket: string }) {
  const styles: Record<string, string> = {
    passed: "bg-[#138808]/10 text-[#138808]",
    rejected: "bg-rose-100 text-rose-700",
    draft: "bg-[#1a1a3e]/8 text-[#1a1a3e]/60",
    other: "bg-amber-100 text-amber-700",
  };
  const label = bucket.charAt(0).toUpperCase() + bucket.slice(1);
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        styles[bucket] ?? styles.other
      }`}
    >
      {label}
    </span>
  );
}

function netSupport(forV: number | null, againstV: number | null): number {
  return (forV ?? 0) - (againstV ?? 0);
}

export async function BillPipelinePanel() {
  const report = await getBillPipeline();

  if (!report.hasData) {
    return (
      <PanelShell
        title="Bill Pipeline"
        subtitle="Youth-drafted bills, tagged to ministry & scheme"
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a1a3e]/15 px-4 py-10 text-center">
          <AlertCircle className="size-6 text-[#1a1a3e]/30" />
          <p className="text-sm font-medium text-[#1a1a3e]/70">
            No bills drafted yet
          </p>
          <p className="max-w-sm text-[12px] leading-relaxed text-[#1a1a3e]/45">
            As committees draft and vote on bills, each one appears here mapped
            to its Government of India ministry &amp; scheme, with the outcome it
            won on the floor. The pipeline fills as the 2026 season runs.
          </p>
        </div>
      </PanelShell>
    );
  }

  const { totals, bills } = report;
  const topBills = bills.slice(0, 12);

  return (
    <PanelShell
      title="Bill Pipeline"
      subtitle="Youth-drafted bills mapped to ministry, across all non-demo rounds"
    >
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Bills" value={totals.total_bills} />
        <Stat label="Passed" value={totals.passed} />
        <Stat label="Ministries" value={totals.ministries_with_bills} />
        <Stat label="Untagged" value={totals.untagged_bills} />
      </div>

      <div className="overflow-hidden rounded-lg border border-[#1a1a3e]/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-[#1a1a3e]/45">
              <th className="px-3 py-2">Bill</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Net support</th>
            </tr>
          </thead>
          <tbody>
            {topBills.map((b) => {
              const net = netSupport(b.votes_for, b.votes_against);
              const hasVotes =
                b.votes_for !== null || b.votes_against !== null;
              return (
                <tr
                  key={b.bill_id}
                  className="border-b border-[#1a1a3e]/5 last:border-0 align-top"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[#1a1a3e]">{b.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#1a1a3e]/45">
                      {b.untagged || !b.ministry ? (
                        <span
                          title="No committee recorded — not yet mapped to a ministry"
                          className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                        >
                          untagged
                        </span>
                      ) : (
                        <span>{b.ministry}</span>
                      )}
                      {b.schemes.length > 0 && (
                        <span>· {b.schemes.slice(0, 2).join(" · ")}</span>
                      )}
                      {b.chapter_name && (
                        <span className="text-[#1a1a3e]/35">
                          · {b.chapter_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge bucket={b.status_bucket} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {hasVotes ? (
                      <>
                        <span
                          className={
                            net > 0
                              ? "font-semibold text-[#138808]"
                              : net < 0
                                ? "font-semibold text-rose-600"
                                : "text-[#1a1a3e]/60"
                          }
                        >
                          {net > 0 ? "+" : ""}
                          {net.toLocaleString("en-IN")}
                        </span>
                        <div className="text-[10px] text-[#1a1a3e]/40">
                          {b.votes_for ?? 0}–{b.votes_against ?? 0}
                          {b.votes_abstain && b.votes_abstain > 0
                            ? ` · ${b.votes_abstain} abs`
                            : ""}
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] text-[#1a1a3e]/35">
                        not voted
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {bills.length > topBills.length && (
        <p className="mt-2 text-[11px] text-[#1a1a3e]/40">
          Showing {topBills.length} of{" "}
          {bills.length.toLocaleString("en-IN")} bills.
        </p>
      )}

      {totals.untagged_bills > 0 && (
        <p className="mt-3 text-[11px] text-[#1a1a3e]/45">
          {totals.untagged_bills.toLocaleString("en-IN")} bill
          {totals.untagged_bills === 1 ? "" : "s"} have no committee recorded yet
          — they&apos;ll map to a ministry once a committee is set.
        </p>
      )}
    </PanelShell>
  );
}
