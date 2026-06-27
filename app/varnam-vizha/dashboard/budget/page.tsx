import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getBudgetDetail } from "@/lib/varnam/data/dashboard-detail";

export const metadata: Metadata = { title: "Budget" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm">
      <p
        className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      <p className="mt-0.5 text-sm text-[#2B0A33]/60">{label}</p>
    </div>
  );
}

export default async function BudgetPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const budget = await getBudgetDetail();
  const remaining = budget ? budget.total - budget.spent : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Budget
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Planned, allocated and spent across the festival&rsquo;s verticals.
        </p>
      </div>

      {!budget ? (
        <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
          <p className="text-sm text-[#2B0A33]/50">
            No budget has been set for this edition yet.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total budget" value={inr(budget.total)} />
            <StatCard label="Allocated" value={inr(budget.allocated)} />
            <StatCard
              label="Spent"
              value={inr(budget.spent)}
              accent="#D6336C"
            />
            <StatCard
              label="Remaining"
              value={inr(remaining)}
              accent="#0a8485"
            />
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
            <h2 className="px-6 pb-2 pt-5 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
              Allocations by vertical
            </h2>
            {budget.allocations.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-[#2B0A33]/50">
                No allocations have been set yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                      <th className="px-6 py-3 font-semibold">Vertical</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Allocated
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Spent
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Remaining
                      </th>
                      <th className="px-6 py-3 text-right font-semibold">
                        % spent
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.allocations.map((a) => {
                      const pct =
                        a.allocated > 0
                          ? Math.min(
                              100,
                              Math.round((a.spent / a.allocated) * 100)
                            )
                          : 0;
                      return (
                        <tr
                          key={a.vertical}
                          className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                        >
                          <td className="px-6 py-3 font-medium text-[#2B0A33]">
                            {a.vertical}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
                            {inr(a.allocated)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
                            {inr(a.spent)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#0a8485]">
                            {inr(a.remaining)}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-[#3B0A45]/8">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#F4A300] to-[#D6336C]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-9 text-right text-xs font-semibold text-[#2B0A33]/60">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
