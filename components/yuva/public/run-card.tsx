import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  Megaphone,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import type { PublicRunSummary } from "./data";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatHours,
} from "./format";

/**
 * Public landing-grid run card (Phase 8). Pure presentational, RSC-safe.
 * Closed runs are SHOWN with an "Applications closed" state — never hidden
 * (spec edge case).
 */
export function PublicRunCard({ run }: { run: PublicRunSummary }) {
  const isOpen = run.state === "open";
  const seatsLeft = Math.max(run.capacity - run.accepted_count, 0);
  const dates = formatDateRange(run.start_date, run.end_date);
  const hours = formatHours(run.total_minutes);
  const deadline = formatDateTime(run.apply_close_at);
  const announce = formatDate(run.cohort_announce_date);

  return (
    <Link
      href={`/youth-academy/programs/${run.id}`}
      className="group block h-full"
    >
      <Card className="flex h-full flex-col overflow-hidden border-slate-200 transition-shadow group-hover:shadow-md">
        <CardContent className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-2">
            <CategoryBadge category={run.program_category} />
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Applications open
              </span>
            ) : run.state === "not_yet_open" ? (
              <span className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                Opening soon
              </span>
            ) : (
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                Applications closed
              </span>
            )}
          </div>

          <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-900 group-hover:text-slate-700">
            {run.program_title}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="size-3.5 shrink-0 text-slate-400" />
            <span className="truncate">
              {run.academy_name}
              {run.city ? ` · ${run.city}` : ""}
            </span>
          </p>

          <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
            {dates && (
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-slate-400" />
                <span>{dates}</span>
              </div>
            )}
            {hours && (
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-slate-400" />
                <span>{hours} of sessions</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="size-4 shrink-0 text-slate-400" />
              <span>
                {seatsLeft} of {run.capacity} seats left
              </span>
            </div>
            {announce && (
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 shrink-0 text-slate-400" />
                <span>Cohort announced by {announce}</span>
              </div>
            )}
          </dl>

          <div className="mt-auto pt-4">
            {isOpen ? (
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  {deadline ? `Apply by ${deadline}` : "Open for applications"}
                </span>
                <span className="text-sm font-semibold text-amber-600 group-hover:text-amber-700">
                  View &amp; apply →
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  {run.state === "not_yet_open"
                    ? "Applications haven't opened yet"
                    : "This cohort is no longer accepting applications"}
                </span>
                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-700">
                  View →
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
