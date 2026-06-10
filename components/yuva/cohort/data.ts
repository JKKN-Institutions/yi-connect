import "server-only";

/**
 * Cohort read-side assembly (Phase 11). READ-ONLY — mutations go through
 * app/youth-academy/actions/{attendance,applications}.ts (gate-first).
 *
 * Per-student attendance % / submissions status / progress % reuse the pure
 * engines in lib/yuva/progress.ts with single-enrollment inputs (dropped
 * enrollments yield 0 — they are excluded from every denominator).
 *
 * ⚠️ Callers are gated pages — these helpers do NOT authorize.
 * ⚠️ Access codes are NEVER selected here (login credentials).
 */

import type { ProgramCategory, RunStatus } from "@/lib/yuva/constants";
import {
  attendancePct,
  overallProgress,
  type AttendanceRow,
  type ProgressEnrollment,
  type ProgressSession,
  type SubmissionRow,
} from "@/lib/yuva/progress";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// The yip server module's Database type includes the yi_directory schema —
// same cross-schema access path components/yuva/runs/data.ts uses.
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";
import type { SessionRosterRow } from "@/components/yuva/attendance/data";

export type CohortRosterRow = {
  enrollment_id: string;
  person_id: string;
  full_name: string;
  institution_name: string | null;
  status: "active" | "completed" | "dropped";
  attendance_pct: number;
  submissions_done: number;
  submissions_expected: number;
  progress_pct: number;
};

export type CohortSession = {
  id: string;
  seq: number;
  name: string;
  duration_minutes: number;
  learning_objective: string | null;
  scheduled_at: string | null;
  venue: string | null;
  remarks: string | null;
  status: "scheduled" | "completed" | "cancelled";
  expects_submission: boolean;
  mentor_name: string | null;
};

export type CohortData = {
  run: {
    id: string;
    status: RunStatus;
    chapter: string;
    academy_id: string;
    academy_name: string;
    program_title: string;
    program_category: ProgramCategory;
    start_date: string | null;
    end_date: string | null;
  };
  program: {
    objective: string | null;
    summary: string | null;
    takeaways: string[];
  };
  sessions: CohortSession[];
  roster: CohortRosterRow[];
  /** run_session_id → (enrollment_id → present). */
  attendanceBySession: Map<string, Map<string, boolean>>;
};

export async function fetchCohortData(
  runId: string
): Promise<CohortData | null> {
  const svc = await createServiceClient();

  const { data: run } = await svc
    .from("runs")
    .select("id, program_id, academy_id, chapter, status, start_date, end_date")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return null;

  const [programRes, academyRes, sessionsRes, enrollmentsRes] =
    await Promise.all([
      svc
        .from("programs")
        .select("id, title, category, objective, summary, takeaways")
        .eq("id", run.program_id)
        .maybeSingle(),
      svc
        .from("academies")
        .select("id, display_name")
        .eq("id", run.academy_id)
        .maybeSingle(),
      svc
        .from("run_sessions")
        .select(
          "id, seq, name, duration_minutes, learning_objective, scheduled_at, venue, remarks, status, expects_submission, mentor_person_id"
        )
        .eq("run_id", run.id)
        .order("seq", { ascending: true }),
      svc
        .from("enrollments")
        .select("id, person_id, application_id, status, joined_at")
        .eq("run_id", run.id)
        .order("joined_at", { ascending: true }),
    ]);

  const sessions = sessionsRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];
  const sessionIds = sessions.map((s) => s.id);
  const enrollmentIds = enrollments.map((e) => e.id);

  const [attendanceRes, submissionsRes] = await Promise.all([
    sessionIds.length > 0
      ? svc
          .from("attendance")
          .select("run_session_id, enrollment_id, present")
          .in("run_session_id", sessionIds)
      : Promise.resolve({ data: [] as AttendanceRow[] }),
    enrollmentIds.length > 0
      ? svc
          .from("submissions")
          .select("run_session_id, enrollment_id, status")
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [] as SubmissionRow[] }),
  ]);
  const attendance = (attendanceRes.data ?? []) as AttendanceRow[];
  const submissions = (submissionsRes.data ?? []) as SubmissionRow[];

  // Names — canonical identity spine (yi_directory.people); mentor names too.
  const personIds = [
    ...new Set([
      ...enrollments.map((e) => e.person_id),
      ...sessions
        .map((s) => s.mentor_person_id)
        .filter((id): id is string => !!id),
    ]),
  ];
  const nameByPersonId = new Map<string, string>();
  if (personIds.length > 0) {
    const dir = await createDirService();
    const { data: people } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, full_name")
      .in("id", personIds);
    for (const p of people ?? []) {
      nameByPersonId.set(p.id, p.full_name ?? "—");
    }
  }

  // Institution display via the source applications.
  const applicationIds = enrollments
    .map((e) => e.application_id)
    .filter((id): id is string => !!id);
  const institutionByApplication = new Map<string, string | null>();
  if (applicationIds.length > 0) {
    const { data: applications } = await svc
      .from("applications")
      .select("id, institution_id, institution_other")
      .in("id", applicationIds);
    const institutionIds = [
      ...new Set(
        (applications ?? [])
          .map((a) => a.institution_id)
          .filter((id): id is string => !!id)
      ),
    ];
    const institutionNameById = new Map<string, string>();
    if (institutionIds.length > 0) {
      const { data: institutions } = await (
        svc.schema("yi" as never) as unknown as {
          from: (table: "institutions") => {
            select: (cols: string) => {
              in: (
                col: string,
                vals: string[]
              ) => Promise<{
                data: Array<{ id: string; name: string }> | null;
              }>;
            };
          };
        }
      )
        .from("institutions")
        .select("id, name")
        .in("id", institutionIds);
      for (const inst of institutions ?? []) {
        institutionNameById.set(inst.id, inst.name);
      }
    }
    for (const a of applications ?? []) {
      institutionByApplication.set(
        a.id,
        a.institution_id
          ? (institutionNameById.get(a.institution_id) ?? a.institution_other)
          : a.institution_other
      );
    }
  }

  // Pure-engine inputs (lib/yuva/progress.ts shapes).
  const progressSessions: ProgressSession[] = sessions.map((s) => ({
    id: s.id,
    status: s.status,
    expects_submission: s.expects_submission,
  }));
  const expectingSessionIds = new Set(
    progressSessions
      .filter((s) => s.expects_submission && s.status !== "cancelled")
      .map((s) => s.id)
  );

  const roster: CohortRosterRow[] = enrollments
    .map((e) => {
      const single: ProgressEnrollment[] = [{ id: e.id, status: e.status }];
      const myAttendance = attendance.filter((a) => a.enrollment_id === e.id);
      const mySubmissions = submissions.filter(
        (s) => s.enrollment_id === e.id
      );
      const done = mySubmissions.filter(
        (s) =>
          (s.status === "submitted" || s.status === "reviewed") &&
          expectingSessionIds.has(s.run_session_id)
      ).length;
      return {
        enrollment_id: e.id,
        person_id: e.person_id,
        full_name: nameByPersonId.get(e.person_id) ?? "—",
        institution_name: e.application_id
          ? (institutionByApplication.get(e.application_id) ?? null)
          : null,
        status: e.status,
        attendance_pct: attendancePct(single, progressSessions, myAttendance),
        submissions_done: e.status === "dropped" ? 0 : done,
        submissions_expected:
          e.status === "dropped" ? 0 : expectingSessionIds.size,
        progress_pct: overallProgress(
          single,
          progressSessions,
          myAttendance,
          mySubmissions
        ),
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const attendanceBySession = new Map<string, Map<string, boolean>>();
  for (const row of attendance) {
    let perSession = attendanceBySession.get(row.run_session_id);
    if (!perSession) {
      perSession = new Map();
      attendanceBySession.set(row.run_session_id, perSession);
    }
    perSession.set(row.enrollment_id, row.present);
  }

  const takeawaysRaw = programRes.data?.takeaways;
  const takeaways = Array.isArray(takeawaysRaw)
    ? takeawaysRaw.filter((t): t is string => typeof t === "string")
    : [];

  return {
    run: {
      id: run.id,
      status: run.status as RunStatus,
      chapter: run.chapter,
      academy_id: run.academy_id,
      academy_name: academyRes.data?.display_name ?? "—",
      program_title: programRes.data?.title ?? "Untitled program",
      program_category: (programRes.data?.category ??
        "learning") as ProgramCategory,
      start_date: run.start_date,
      end_date: run.end_date,
    },
    program: {
      objective: programRes.data?.objective ?? null,
      summary: programRes.data?.summary ?? null,
      takeaways,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      seq: s.seq,
      name: s.name,
      duration_minutes: s.duration_minutes,
      learning_objective: s.learning_objective,
      scheduled_at: s.scheduled_at,
      venue: s.venue,
      remarks: s.remarks,
      status: s.status,
      expects_submission: s.expects_submission,
      mentor_name: s.mentor_person_id
        ? (nameByPersonId.get(s.mentor_person_id) ?? "—")
        : null,
    })),
    roster,
    attendanceBySession,
  };
}

/**
 * Derive the attendance-grid roster (SessionRosterRow[]) for one session from
 * already-fetched cohort data — non-dropped members with their mark for that
 * session (null = unmarked). Keeps the chapter cohort page at one fetch.
 */
export function gridRosterForSession(
  cohort: CohortData,
  runSessionId: string
): SessionRosterRow[] {
  const perSession = cohort.attendanceBySession.get(runSessionId);
  return cohort.roster
    .filter((r) => r.status !== "dropped")
    .map((r) => ({
      enrollment_id: r.enrollment_id,
      person_id: r.person_id,
      full_name: r.full_name,
      institution_name: r.institution_name,
      present: perSession?.get(r.enrollment_id) ?? null,
    }));
}
