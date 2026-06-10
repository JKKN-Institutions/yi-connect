import { cn } from "@/lib/utils";
import type { RunStatus } from "@/lib/yuva/constants";
import { runStatusLabel } from "@/lib/yuva/run-machine";

/**
 * Status badge for the run lifecycle (Phase 7). Labels come from
 * lib/yuva/run-machine.runStatusLabel — the single label source.
 * Server-component-safe (no client hooks).
 */

const STATUS_STYLES: Record<RunStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  published: "bg-emerald-100 text-emerald-800 border-emerald-200",
  applications_closed: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-sky-100 text-sky-800 border-sky-200",
  completed: "bg-violet-100 text-violet-800 border-violet-200",
  certified: "bg-indigo-100 text-indigo-800 border-indigo-200",
  cancelled: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

export function RunStatusBadge({
  status,
  className,
}: {
  status: RunStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 border-slate-200",
        className
      )}
    >
      {runStatusLabel(status)}
    </span>
  );
}
