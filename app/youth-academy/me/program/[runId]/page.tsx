/**
 * Student program detail (Phase 10) — /youth-academy/me/program/[runId].
 *
 * Full schedule timeline (per session: name, learning objective,
 * date/time/venue, facilitator name+photo, session DOCUMENT download,
 * MATERIALS downloads, my attendance, expects-work indicator) + a mentor
 * profiles section.
 *
 * A run id the caller is NOT live-enrolled in renders Forbidden403 —
 * explicit denial, never a silent redirect.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, FileText, GraduationCap, Users } from "lucide-react";
import {
  getMyProgress,
  getMySchedule,
  getProgramSyllabusUrl,
} from "@/app/youth-academy/actions/student";
import { Button } from "@/components/ui/button";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { formatDateRange } from "@/components/yuva/public/format";
import { ProgressBar } from "@/components/yuva/student/progress-bar";
import { SessionTimeline } from "@/components/yuva/student/session-timeline";
import { RUN_STATUS_LABELS } from "@/lib/yuva/constants";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function StudentProgramPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  const [scheduleRes, progressRes] = await Promise.all([
    getMySchedule(runId),
    getMyProgress(runId),
  ]);

  if (!scheduleRes.success) {
    return <Forbidden403 reason={scheduleRes.error} />;
  }

  const schedule = scheduleRes.data;
  const progress = progressRes.success ? progressRes.data : null;
  const dates = formatDateRange(schedule.startDate, schedule.endDate);

  return (
    <main className="space-y-8">
      {/* ── Header ── */}
      <div>
        <Link
          href="/youth-academy/me"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" />
          My programs
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CategoryBadge category={schedule.programCategory} />
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {RUN_STATUS_LABELS[schedule.runStatus]}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {schedule.programTitle}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <GraduationCap className="size-4 shrink-0" />
          {schedule.academyName}
          {dates && <span className="text-slate-400"> · {dates}</span>}
        </p>
      </div>

      {/* ── Program syllabus ── */}
      {schedule.hasSyllabus && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <FileText className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Program syllabus
              </p>
              <p className="text-xs text-slate-500">
                The full syllabus document for this program.
              </p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              const res = await getProgramSyllabusUrl(runId);
              if (res.success) redirect(res.data.url);
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              <Download className="size-4" />
              Download
            </Button>
          </form>
        </section>
      )}

      {/* ── Progress ── */}
      {progress && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            My progress
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <ProgressBar value={progress.overallPct} label="Overall" />
            <ProgressBar value={progress.attendancePct} label="Attendance" />
            <ProgressBar
              value={progress.submissionPct}
              label="Work submitted"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {progress.completedSessions} of {progress.totalSessions} sessions
            held
            {progress.expectingSessions > 0 &&
              ` · ${progress.submittedCount}/${progress.expectingSessions} submissions in`}
          </p>
        </section>
      )}

      {/* ── Schedule ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Schedule</h2>
        <SessionTimeline sessions={schedule.sessions} />
      </section>

      {/* ── Mentors ── */}
      {schedule.mentors.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Users className="size-5 text-slate-400" />
            Your mentors
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {schedule.mentors.map((mentor) => (
              <div
                key={mentor.personId}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                {mentor.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mentor.photoUrl}
                    alt={mentor.name}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                    {initials(mentor.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{mentor.name}</p>
                  {mentor.organization && (
                    <p className="text-sm text-slate-500">
                      {mentor.organization}
                    </p>
                  )}
                  {mentor.expertise.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {mentor.expertise.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {mentor.bio && (
                    <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                      {mentor.bio}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
