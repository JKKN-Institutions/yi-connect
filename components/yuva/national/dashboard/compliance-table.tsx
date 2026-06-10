/**
 * Usage-norm compliance table (Phase 15) — per-academy RAG against the
 * national norms: ≥3 engagements this month including one each
 * Entrepreneurship / Innovation / Learning, and ≥30 active days YTD.
 * Sessions ARE the engagements (completed run sessions only).
 *
 * Presentational RSC; rows come from getComplianceSnapshot().
 */

import Link from "next/link";
import {
  NORM_MIN_ACTIVE_DAYS_PER_YEAR,
  NORM_MIN_ENGAGEMENTS_PER_MONTH,
  type NormRag,
} from "@/lib/yuva/norms";
import type { AcademyCompliance } from "@/app/youth-academy/actions/national-reports";

const RAG_STYLES: Record<NormRag, { badge: string; dot: string; label: string }> = {
  green: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
    label: "On track",
  },
  amber: {
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
    label: "At risk",
  },
  red: {
    badge: "bg-red-50 text-red-700 ring-red-600/20",
    dot: "bg-red-500",
    label: "Off norm",
  },
};

export function RagBadge({ rag }: { rag: NormRag }) {
  const s = RAG_STYLES[rag];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** Per-category chip: green when the one-each requirement is met. */
export function CategoryChip({
  short,
  title,
  count,
}: {
  short: string;
  title: string;
  count: number;
}) {
  const met = count >= 1;
  return (
    <span
      title={`${title}: ${count} this month`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        met
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          : "bg-slate-50 text-slate-400 ring-slate-200"
      }`}
    >
      {short} {count}
    </span>
  );
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ComplianceTable({
  month,
  academies,
}: {
  month: string;
  academies: AcademyCompliance[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Usage-norm compliance — {monthLabel(month)}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Norm: ≥{NORM_MIN_ENGAGEMENTS_PER_MONTH} engagements this month with
          one each Entrepreneurship / Innovation / Learning, and ≥
          {NORM_MIN_ACTIVE_DAYS_PER_YEAR} active days this year. Completed
          sessions are the engagements.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium sm:px-6">Academy</th>
              <th className="px-4 py-2.5 font-medium">
                Engagements this month
              </th>
              <th className="px-4 py-2.5 font-medium">Active days (YTD)</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {academies.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 sm:px-6">
                  <Link
                    href={`/youth-academy/national/academies/${a.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {a.display_name}
                  </Link>
                  <p className="text-xs text-slate-400">Yi {a.chapter}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        a.month_total >= NORM_MIN_ENGAGEMENTS_PER_MONTH
                          ? "text-emerald-600"
                          : "text-slate-900"
                      }`}
                    >
                      {a.month_total}
                      <span className="font-normal text-slate-400">
                        /{NORM_MIN_ENGAGEMENTS_PER_MONTH}
                      </span>
                    </span>
                    <CategoryChip
                      short="E"
                      title="Entrepreneurship"
                      count={a.month_entrepreneurship}
                    />
                    <CategoryChip
                      short="I"
                      title="Innovation"
                      count={a.month_innovation}
                    />
                    <CategoryChip
                      short="L"
                      title="Learning"
                      count={a.month_learning}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      a.active_days_ytd >= NORM_MIN_ACTIVE_DAYS_PER_YEAR
                        ? "text-emerald-600"
                        : "text-slate-900"
                    }`}
                  >
                    {a.active_days_ytd}
                    <span className="font-normal text-slate-400">
                      /{NORM_MIN_ACTIVE_DAYS_PER_YEAR}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RagBadge rag={a.rag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
