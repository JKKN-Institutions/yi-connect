/**
 * Capacity meter (Phase 9) — accepted vs the run's Expected Participants.
 * SOFT cap (spec): beyond capacity the bar turns amber and a note appears —
 * nothing is ever blocked. Pure presentational, server-renderable.
 */

import { AlertTriangle } from "lucide-react";

export function CapacityMeter({
  accepted,
  capacity,
}: {
  accepted: number;
  capacity: number;
}) {
  const safeCapacity = Math.max(capacity, 1);
  const pct = Math.min((accepted / safeCapacity) * 100, 100);
  const over = accepted > capacity;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Cohort capacity</p>
        <p className="text-sm text-slate-500">
          <span
            className={`font-semibold ${over ? "text-amber-600" : "text-emerald-700"}`}
          >
            {accepted}
          </span>{" "}
          accepted of {capacity} expected
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            over ? "bg-amber-500" : "bg-emerald-600"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Above the expected participants — this is a soft cap, accepting more
          is allowed.
        </p>
      )}
    </div>
  );
}
