/**
 * Student dashboard program card (RSC) — one card per enrollment:
 * program title + academy, run status, NEXT SESSION (date/venue/mentor),
 * progress bar, certificate state placeholder, link to the full schedule.
 */

import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarDays,
  Clock,
  GraduationCap,
  MapPin,
  User,
} from "lucide-react";
import type { MyProgram, MyProgress } from "@/app/youth-academy/actions/student";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { formatDateTime } from "@/components/yuva/public/format";
import { RUN_STATUS_LABELS } from "@/lib/yuva/constants";
import { ProgressBar } from "./progress-bar";

export type NextSessionInfo = {
  name: string;
  scheduledAt: string | null;
  venue: string | null;
  mentorName: string | null;
} | null;

export function ProgramCard({
  program,
  progress,
  nextSession,
}: {
  program: MyProgram;
  progress: MyProgress | null;
  nextSession: NextSessionInfo;
}) {
  const certificateState = program.certificateId
    ? { label: "Certificate issued", tone: "text-emerald-700 bg-emerald-50" }
    : { label: "Certificate: in progress", tone: "text-slate-600 bg-slate-100" };

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-4 p-5 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={program.programCategory} />
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {RUN_STATUS_LABELS[program.runStatus]}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {program.programTitle}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <GraduationCap className="size-4 shrink-0" />
              {program.academyName}
            </p>
          </div>
        </div>

        {/* Next session */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Next session
          </p>
          {nextSession ? (
            <div className="mt-1.5 space-y-1">
              <p className="font-medium text-slate-900">{nextSession.name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0" />
                  {formatDateTime(nextSession.scheduledAt) ?? "Date to be announced"}
                </span>
                {nextSession.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    {nextSession.venue}
                  </span>
                )}
                {nextSession.mentorName && (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-3.5 shrink-0" />
                    {nextSession.mentorName}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
              <Clock className="size-3.5 shrink-0" />
              No upcoming sessions scheduled.
            </p>
          )}
        </div>

        {/* Progress */}
        {progress && (
          <div className="space-y-2">
            <ProgressBar value={progress.overallPct} label="Overall progress" />
            <p className="text-xs text-slate-500">
              Attendance {progress.attendancePct}% ·{" "}
              {progress.completedSessions}/{progress.totalSessions} sessions
              held
              {progress.expectingSessions > 0 &&
                ` · work submitted ${progress.submittedCount}/${progress.expectingSessions}`}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${certificateState.tone}`}
          >
            <Award className="size-3.5" />
            {certificateState.label}
          </span>
          <Link
            href={`/youth-academy/me/program/${program.runId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Full schedule
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
