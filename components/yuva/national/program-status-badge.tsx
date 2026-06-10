import { cn } from "@/lib/utils";

/**
 * Status badge for program templates (draft / approved / archived).
 * Server-component-safe.
 */

type ProgramStatus = "draft" | "approved" | "archived";

const STATUS_STYLES: Record<ProgramStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  archived: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  archived: "Archived",
};

export function ProgramStatusBadge({
  status,
  className,
}: {
  status: ProgramStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
