import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getSponsorsDetail } from "@/lib/varnam/data/dashboard-detail";

export const metadata: Metadata = { title: "Sponsors" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function SponsorsPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const sponsors = await getSponsorsDetail();
  const committedTotal = sponsors.reduce((s, x) => s + x.committed, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            Sponsors
          </h1>
          <p className="mt-1 text-sm text-[#2B0A33]/60">
            {sponsors.length} active sponsor{sponsors.length === 1 ? "" : "s"} in
            the pipeline.
          </p>
        </div>
        {sponsors.length > 0 ? (
          <div className="text-right">
            <p className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#0a8485]">
              {inr(committedTotal)}
            </p>
            <p className="text-xs text-[#2B0A33]/50">committed (FY 2026)</p>
          </div>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        {sponsors.length === 0 ? (
          <p className="p-6 text-sm text-[#2B0A33]/50">
            No active sponsors yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                  <th className="px-4 py-3 font-semibold">Sponsor</th>
                  <th className="px-4 py-3 font-semibold">Industry</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    This year
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Committed
                  </th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((s, i) => (
                  <tr
                    key={`${s.name}-${i}`}
                    className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                  >
                    <td className="px-4 py-3 font-medium text-[#2B0A33]">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-[#2B0A33]/70">
                      {s.industry ?? (
                        <span className="text-[#2B0A33]/35">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#3B0A45]/8 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#3B0A45]/70">
                        {s.status ?? "prospect"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.priority ? (
                        <span className="inline-flex rounded-full bg-[#F4A300]/15 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#a06b00]">
                          {s.priority}
                        </span>
                      ) : (
                        <span className="text-[#2B0A33]/35">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
                      {s.currentYearAmount
                        ? inr(s.currentYearAmount)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#0a8485]">
                      {s.committed ? inr(s.committed) : "—"}
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
