import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getBudgetBoard } from "@/lib/varnam/data/manage-boards-data";
import { CreateBudgetCard } from "./_components/CreateBudgetCard";
import { AddAllocationPanel } from "./_components/AddAllocationPanel";
import { AllocationsTable } from "./_components/AllocationsTable";

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

  const budget = await getBudgetBoard();
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
        access.canManage ? (
          <CreateBudgetCard />
        ) : (
          <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
            <p className="text-sm text-[#2B0A33]/50">
              No budget has been set for this edition yet.
            </p>
          </section>
        )
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

          {access.canManage ? (
            <AddAllocationPanel
              budgetId={budget.id}
              unallocated={budget.total - budget.allocated}
            />
          ) : null}

          <section className="mt-6 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
            <h2 className="px-6 pb-2 pt-5 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
              Allocations by vertical
            </h2>
            <AllocationsTable
              allocations={budget.allocations}
              canManage={access.canManage}
            />
          </section>
        </>
      )}
    </div>
  );
}
