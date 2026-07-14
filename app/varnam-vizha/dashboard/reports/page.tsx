import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import {
  formatINR,
  getEditionFinance,
  getEventReports,
} from "@/lib/varnam/data/reports";
import { HandCoins, Scale, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Reports" };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

function MoneyCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[#D6336C]">{icon}</div>
      <p className="mt-3 font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
        {value}
      </p>
      <p className="text-sm text-[#2B0A33]/60">{label}</p>
      {sub && <div className="mt-1 text-xs text-[#2B0A33]/45">{sub}</div>}
    </div>
  );
}

export default async function ReportsPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const [finance, events] = await Promise.all([
    getEditionFinance(),
    getEventReports(),
  ]);

  const budgetPct =
    finance.budget && finance.budget.total > 0
      ? Math.min(
          100,
          Math.round((finance.budget.spent / finance.budget.total) * 100)
        )
      : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Reports
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Edition money at a glance, plus a report per event — with a
          copy-ready Health Card draft for each. No more end-of-festival
          blind spots.
        </p>
      </div>

      {/* (a) Edition money summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyCard
          icon={<Wallet className="size-5" />}
          label="Budget spent vs total"
          value={
            finance.budget
              ? `${formatINR(finance.budget.spent)} of ${formatINR(finance.budget.total)}`
              : "—"
          }
          sub={
            finance.budget ? (
              <div className="mt-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-[#3B0A45]/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F4A300] to-[#D6336C]"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <span className="mt-1 block">{budgetPct}% spent</span>
              </div>
            ) : (
              "No budget linked to this edition yet — set one up in Budget."
            )
          }
        />
        <MoneyCard
          icon={<HandCoins className="size-5" />}
          label="Sponsorship committed + received"
          value={
            finance.sponsorship.deals.length > 0
              ? `${formatINR(finance.sponsorship.committedTotal)} + ${formatINR(finance.sponsorship.receivedTotal)}`
              : "—"
          }
          sub={
            finance.sponsorship.deals.length > 0
              ? `${finance.sponsorship.deals.length} deal${
                  finance.sponsorship.deals.length === 1 ? "" : "s"
                } this fiscal year (committed + received in hand)`
              : "No sponsorship deals recorded yet — add them in Sponsors."
          }
        />
        <MoneyCard
          icon={<Scale className="size-5" />}
          label="Net position"
          value={
            finance.budget || finance.sponsorship.deals.length > 0
              ? formatINR(finance.netPosition)
              : "—"
          }
          sub={finance.ticketNote}
        />
      </div>

      {/* Allocations mini-table */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        <h2 className="px-4 pt-5 pb-2 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
          Where the budget went
        </h2>
        {finance.allocations.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-[#2B0A33]/50">
            No budget allocations recorded yet — split the budget by area in
            the Budget tab.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                  <th className="px-4 py-3 font-semibold">Area</th>
                  <th className="px-4 py-3 text-right font-semibold">Planned</th>
                  <th className="px-4 py-3 text-right font-semibold">Spent</th>
                  <th className="px-4 py-3 text-right font-semibold">Left</th>
                </tr>
              </thead>
              <tbody>
                {finance.allocations.map((a) => (
                  <tr
                    key={a.vertical}
                    className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                  >
                    <td className="px-4 py-3 font-medium text-[#2B0A33]">
                      {a.vertical}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
                      {formatINR(a.allocated)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
                      {formatINR(a.spent)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                        a.allocated - a.spent < 0
                          ? "text-[#D6336C]"
                          : "text-[#0a8485]"
                      }`}
                    >
                      {formatINR(a.allocated - a.spent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* (b) Per-event table */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        <h2 className="px-4 pt-5 pb-2 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
          Event reports
        </h2>
        <p className="px-4 pb-2 text-sm text-[#2B0A33]/60">
          Open an event for its full report and a ready-to-paste Health Card
          draft.
        </p>
        {events.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-[#2B0A33]/50">
            No events in this edition yet — add them in the Events tab.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Registered
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Attended
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Expenses
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Report</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#2B0A33]">
                        {e.title}
                      </span>
                      {e.status ? (
                        <span className="ml-2 inline-flex rounded-full bg-[#3B0A45]/8 px-2 py-0.5 text-[11px] font-medium capitalize text-[#3B0A45]/70">
                          {e.status}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#2B0A33]/70">
                      {fmtDate(e.start_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#D6336C]">
                      {e.confirmed + e.waitlisted}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
                      {e.checkedIn}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
                      {e.expenses.length > 0 ? formatINR(e.expensesTotal) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/varnam-vizha/dashboard/reports/${e.id}`}
                        className="text-sm font-medium text-[#0CA4A5] hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
