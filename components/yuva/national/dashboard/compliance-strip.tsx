/**
 * Compact per-academy compliance strip (Phase 15, additive) — shown on the
 * national academy detail page: this month's engagements by category +
 * active days YTD + RAG badge. Data from getAcademyCompliance().
 */

import {
  NORM_MIN_ACTIVE_DAYS_PER_YEAR,
  NORM_MIN_ENGAGEMENTS_PER_MONTH,
} from "@/lib/yuva/norms";
import type { AcademyComplianceStrip } from "@/app/youth-academy/actions/national-reports";
import { CategoryChip, RagBadge } from "./compliance-table";

export function ComplianceStrip({ strip }: { strip: AcademyComplianceStrip }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <RagBadge rag={strip.rag} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">This month:</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {strip.month_total}
          <span className="font-normal text-slate-400">
            /{NORM_MIN_ENGAGEMENTS_PER_MONTH}
          </span>
        </span>
        <CategoryChip
          short="E"
          title="Entrepreneurship"
          count={strip.month_entrepreneurship}
        />
        <CategoryChip
          short="I"
          title="Innovation"
          count={strip.month_innovation}
        />
        <CategoryChip short="L" title="Learning" count={strip.month_learning} />
        {strip.month_other > 0 ? (
          <span className="text-[11px] text-slate-400">
            +{strip.month_other} other
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500">Active days (YTD):</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {strip.active_days_ytd}
          <span className="font-normal text-slate-400">
            /{NORM_MIN_ACTIVE_DAYS_PER_YEAR}
          </span>
        </span>
      </div>
    </div>
  );
}
