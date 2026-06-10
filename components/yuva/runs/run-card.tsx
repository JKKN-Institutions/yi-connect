import Link from "next/link";
import { Building2, CalendarDays, Inbox, ListChecks } from "lucide-react";
import type { ProgramCategory, RunStatus } from "@/lib/yuva/constants";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { RunStatusBadge } from "./run-status-badge";

/**
 * Compact run card for the chapter runs list + the dashboard "active runs"
 * slot (Phase 7). Server-component-safe.
 */

export type RunListItem = {
  id: string;
  status: RunStatus;
  chapter: string;
  program_title: string;
  program_category: ProgramCategory;
  academy_name: string;
  start_date: string | null;
  end_date: string | null;
  apply_close_at: string | null;
  sessions_count: number;
  scheduled_sessions_count: number;
  applications_count: number;
  created_at: string;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RunCard({ run }: { run: RunListItem }) {
  const start = formatDate(run.start_date);
  const end = formatDate(run.end_date);

  return (
    <Link
      href={`/youth-academy/chapter/runs/${run.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">
            {run.program_title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-500">
            <Building2 className="size-3.5 shrink-0" />
            {run.academy_name}
          </p>
        </div>
        <RunStatusBadge status={run.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={run.program_category} />
        {start && end ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <CalendarDays className="size-3.5" />
            {start} – {end}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Dates not set</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="size-3.5" />
          {run.scheduled_sessions_count}/{run.sessions_count} sessions
          scheduled
        </span>
        <span className="inline-flex items-center gap-1">
          <Inbox className="size-3.5" />
          {run.applications_count} application
          {run.applications_count === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
