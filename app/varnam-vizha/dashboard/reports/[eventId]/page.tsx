import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getCurrentEdition } from "@/lib/varnam/data/editions";
import {
  buildHealthCardDraft,
  buildSponsorImpactSnippet,
  formatINR,
  getEventReports,
} from "@/lib/varnam/data/reports";
import { CopyButton } from "../_components/CopyButton";

export const metadata: Metadata = { title: "Event report" };

type Params = { params: Promise<{ eventId: string }> };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm">
      <p className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
        {value}
      </p>
      <p className="text-sm text-[#2B0A33]/60">{label}</p>
    </div>
  );
}

export default async function EventReportPage({ params }: Params) {
  const { eventId } = await params;
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const [edition, events] = await Promise.all([
    getCurrentEdition(),
    getEventReports(),
  ]);
  const report = events.find((e) => e.id === eventId);
  if (!report) notFound();

  const healthCard = buildHealthCardDraft(report, edition);
  const sponsorSnippet = buildSponsorImpactSnippet(events, edition);
  const registered = report.confirmed + report.waitlisted;
  const hasRejected = report.expenses.some((x) => x.status === "rejected");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <Link
          href="/varnam-vizha/dashboard/reports"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← All reports
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          {report.title}
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          {fmtDate(report.start_date)}
          {report.venue_address ? ` · ${report.venue_address}` : ""}
        </p>
      </div>

      {/* Numbers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Registered" value={String(registered)} />
        <Stat label="Attended (checked-in)" value={String(report.checkedIn)} />
        <Stat
          label="Expenses recorded"
          value={report.expenses.length > 0 ? formatINR(report.expensesTotal) : "—"}
        />
      </div>

      {/* Expense list */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        <h2 className="px-4 pt-5 pb-2 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
          Expenses
        </h2>
        {report.expenses.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-[#2B0A33]/50">
            No expenses recorded for this event yet — add them in Budget.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.expenses.map((x) => (
                    <tr
                      key={x.id}
                      className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#2B0A33]">
                          {x.title}
                        </span>
                        {x.vendor ? (
                          <span className="mt-0.5 block text-xs text-[#2B0A33]/45">
                            {x.vendor}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#2B0A33]/70">
                        {fmtDate(x.expenseDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                            x.status === "rejected"
                              ? "bg-[#D6336C]/10 text-[#b02a59]"
                              : "bg-[#3B0A45]/8 text-[#3B0A45]/70"
                          }`}
                        >
                          {x.status ?? "draft"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#2B0A33]">
                        {formatINR(x.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasRejected && (
              <p className="px-4 pb-4 pt-1 text-xs text-[#2B0A33]/45">
                Rejected expenses are listed but not counted in the total.
              </p>
            )}
          </>
        )}
      </section>

      {/* Health Card draft */}
      <section className="mt-6 rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
              Health Card draft
            </h2>
            <p className="mt-0.5 text-sm text-[#2B0A33]/60">
              Copy, fill in the impact line, and paste into the Yi Health Card
              submission.
            </p>
          </div>
          <CopyButton text={healthCard} label="Copy draft" />
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-[#3B0A45]/10 bg-[#FFF9F0] p-4 font-[family-name:var(--font-vv-body)] text-sm leading-relaxed text-[#2B0A33]">
          {healthCard}
        </pre>
      </section>

      {/* Sponsor impact snippet */}
      <section className="mt-6 rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
              Sponsor impact snippet
            </h2>
            <p className="mt-0.5 text-sm text-[#2B0A33]/60">
              Edition-wide reach — paste into a sponsor WhatsApp or email.
            </p>
          </div>
          <CopyButton text={sponsorSnippet} label="Copy snippet" />
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-[#3B0A45]/10 bg-[#FFF9F0] p-4 font-[family-name:var(--font-vv-body)] text-sm leading-relaxed text-[#2B0A33]">
          {sponsorSnippet}
        </pre>
      </section>
    </div>
  );
}
