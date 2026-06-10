/**
 * Chapter / Institution — cohort management (Phase 11).
 * Spec: docs/yi-youth-academy-spec.md → "Chapter / Institution — cohort
 * management": roster (name, institution, attendance %, submissions status,
 * progress %, enrollment status + mark-dropped), per-session attendance
 * grids (same shared component as the mentor's), reopen-attendance control
 * when locked, certificates placeholder (Phase 14 fills it).
 *
 * Gate (defense-in-depth on top of the chapter layout): canManageRun on the
 * run's {academy_id, chapter} — explicit Forbidden403, never a redirect.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  ClipboardCheck,
  MessagesSquare,
  Users,
} from "lucide-react";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import { canEditAttendance } from "@/lib/yuva/attendance-lock";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { canOverrideEligibility } from "@/lib/yuva/certificate-eligibility";
import {
  CERT_ATTENDANCE_DEFAULT,
  RUN_STATUS_LABELS,
} from "@/lib/yuva/constants";
import { CategoryBadge } from "@/components/yuva/national/category-badge";
import { AttendanceGrid } from "@/components/yuva/attendance/attendance-grid";
import { fetchAttendanceReopenedUntil } from "@/components/yuva/attendance/data";
import { AttendanceLockBanner } from "@/components/yuva/attendance/lock-banner";
import { fetchCertificatesByEnrollment } from "@/components/yuva/certificates/data";
import {
  EligibilityTable,
  type EligibilityRow,
} from "@/components/yuva/certificates/eligibility-table";
import {
  fetchCohortData,
  gridRosterForSession,
} from "@/components/yuva/cohort/data";
import { CohortThread } from "@/components/yuva/messages/thread";
import { RosterTable } from "@/components/yuva/cohort/roster-table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cohort management" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionDateLabel(scheduledAt: string | null): string {
  if (!scheduledAt) return "unscheduled";
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "unscheduled";
  return d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ChapterCohortPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const cohort = await fetchCohortData(id);
  if (!cohort) {
    notFound();
  }

  // Gate: manager-only surface (mark-dropped, reopen, certificates live here;
  // mentors use their own cohort view).
  const access = await getYuvaAccess();
  if (
    !access.canManageRun({
      academy_id: cohort.run.academy_id,
      chapter: cohort.run.chapter,
    })
  ) {
    return (
      <Forbidden403
        reason={`You can't manage this cohort — it belongs to ${cohort.run.academy_name} (Yi ${cohort.run.chapter}). Your access: ${access.reason}`}
      />
    );
  }

  const reopenedUntil = await fetchAttendanceReopenedUntil(cohort.run.id);
  const lock = canEditAttendance(cohort.run.status, !!reopenedUntil);

  // Certificates (Phase 14): live attendance % comes from the roster
  // computation above; cert rows are fetched per enrollment.
  const certByEnrollment = await fetchCertificatesByEnrollment(
    cohort.roster.map((r) => r.enrollment_id)
  );
  const eligibilityRows: EligibilityRow[] = cohort.roster.map((r) => {
    const cert = certByEnrollment.get(r.enrollment_id);
    return {
      enrollment_id: r.enrollment_id,
      full_name: r.full_name,
      institution_name: r.institution_name,
      status: r.status,
      attendance_pct: r.attendance_pct,
      certificate: cert
        ? {
            id: cert.id,
            certificate_no: cert.certificate_no,
            issued_at: cert.issued_at,
            revoked: cert.revoked,
          }
        : null,
    };
  });
  const canIssue =
    cohort.run.status === "completed" || cohort.run.status === "certified";
  const overrideGate = canOverrideEligibility(
    cohort.sessions.map((s) => ({ status: s.status }))
  );

  const activeCount = cohort.roster.filter(
    (r) => r.status !== "dropped"
  ).length;
  // Cancelled sessions hold no attendance.
  const attendanceSessions = cohort.sessions.filter(
    (s) => s.status !== "cancelled"
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <Link
          href={`/youth-academy/chapter/runs/${cohort.run.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to run
        </Link>

        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-emerald-700 uppercase">
            Cohort management
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {cohort.run.program_title}
            </h1>
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-slate-600"
            >
              {RUN_STATUS_LABELS[cohort.run.status]}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <CategoryBadge category={cohort.run.program_category} />
            <span>
              {cohort.run.academy_name} · Yi {cohort.run.chapter}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {activeCount} active student{activeCount === 1 ? "" : "s"}
              {cohort.roster.length !== activeCount &&
                ` (${cohort.roster.length - activeCount} dropped)`}
            </span>
          </div>
        </div>
      </div>

      {/* Roster with progress columns + mark-dropped */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Roster</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Attendance, submissions and progress are computed live. Dropped
            students leave every calculation and the certificate eligibility
            list.
          </p>
        </div>
        <RosterTable roster={cohort.roster} showActions />
      </section>

      {/* Per-session attendance grids (shared component with the mentor) */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <ClipboardCheck className="size-4 text-slate-500" />
            Attendance by session
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Also editable by each session&apos;s mentor from their session
            page.
          </p>
        </div>

        {!lock.editable && (
          <AttendanceLockBanner
            runId={cohort.run.id}
            reason={lock.reason}
            canReopen
          />
        )}
        {lock.editable && reopenedUntil && (
          <AttendanceLockBanner
            runId={cohort.run.id}
            reason=""
            reopenedUntil={reopenedUntil}
          />
        )}

        {attendanceSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">
              No sessions in this run yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attendanceSessions.map((session) => {
              const gridRoster = gridRosterForSession(cohort, session.id);
              const markedCount = gridRoster.filter(
                (r) => r.present !== null
              ).length;
              return (
                <details
                  key={session.id}
                  className="group rounded-lg border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                    <span>
                      {session.seq}. {session.name}
                      <span className="ml-2 font-normal text-slate-500">
                        {sessionDateLabel(session.scheduled_at)}
                        {session.mentor_name
                          ? ` · ${session.mentor_name}`
                          : ""}
                      </span>
                    </span>
                    <span className="text-xs font-normal text-slate-500">
                      {markedCount}/{gridRoster.length} marked
                      <span className="ml-2 text-slate-400 group-open:hidden">
                        ▸
                      </span>
                      <span className="ml-2 hidden text-slate-400 group-open:inline">
                        ▾
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 p-4">
                    <AttendanceGrid
                      runSessionId={session.id}
                      roster={gridRoster}
                      locked={!lock.editable}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      {/* Cohort thread (Phase 12) — compact, collapsed by default */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <MessagesSquare className="size-4 text-slate-500" />
            Cohort thread
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            One shared thread per cohort — students, mentors and your chapter
            team all see it.
          </p>
        </div>
        <details className="group rounded-lg border border-slate-200 bg-white">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
            <span>Open the thread</span>
            <span className="text-xs font-normal text-slate-400">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span>
            </span>
          </summary>
          <div className="border-t border-slate-100 p-4">
            <CohortThread
              runId={cohort.run.id}
              viewerPersonId={access.personId}
            />
          </div>
        </details>
      </section>

      {/* Certificates — issue panel (Phase 14) */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Award className="size-4 text-amber-600" />
            Certificates
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Default eligibility is ≥{CERT_ATTENDANCE_DEFAULT}% attendance —
            tick or untick per student to override. Already-issued students
            are always skipped (re-running never duplicates a certificate).
          </p>
        </div>
        <EligibilityTable
          runId={cohort.run.id}
          rows={eligibilityRows}
          threshold={CERT_ATTENDANCE_DEFAULT}
          canIssue={canIssue}
          blockedReason={
            canIssue
              ? null
              : `Certificates can be issued once the run is completed (this run is ${RUN_STATUS_LABELS[cohort.run.status].toLowerCase()}).`
          }
          overrideAllowed={overrideGate.allowed}
          overrideBlockedReason={overrideGate.reason ?? null}
        />
      </section>
    </main>
  );
}
