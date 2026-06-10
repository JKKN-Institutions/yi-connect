import "server-only";

/**
 * Certificate read-side assembly (Phase 14). READ-ONLY — mutations go
 * through app/youth-academy/actions/certificates.ts (gate-first).
 *
 * ⚠️ Callers are gated pages — these helpers do NOT authorize.
 */

import type { RunStatus } from "@/lib/yuva/constants";
import {
  attendancePct,
  type AttendanceRow,
  type ProgressEnrollment,
  type ProgressSession,
} from "@/lib/yuva/progress";
import { createServiceClient } from "@/lib/yuva/supabase/service";

export type CertificateInfo = {
  id: string;
  certificate_no: string;
  issued_at: string;
  revoked: boolean;
  /** Attendance % snapshot taken at issue time. */
  attendance_pct: number | null;
};

/** Certificates for a set of enrollments, keyed by enrollment id. */
export async function fetchCertificatesByEnrollment(
  enrollmentIds: string[]
): Promise<Map<string, CertificateInfo>> {
  const byEnrollment = new Map<string, CertificateInfo>();
  if (enrollmentIds.length === 0) return byEnrollment;

  const svc = await createServiceClient();
  const { data } = await svc
    .from("certificates")
    .select("id, enrollment_id, certificate_no, issued_at, revoked, attendance_pct")
    .in("enrollment_id", enrollmentIds);
  for (const row of data ?? []) {
    byEnrollment.set(row.enrollment_id, {
      id: row.id,
      certificate_no: row.certificate_no,
      issued_at: row.issued_at,
      revoked: row.revoked,
      attendance_pct: row.attendance_pct,
    });
  }
  return byEnrollment;
}

// ─── Student portal: my certificates overview ──────────────────────────────

export type MyCertificateRow = {
  enrollmentId: string;
  enrollmentStatus: "active" | "completed";
  runId: string;
  runStatus: RunStatus;
  programTitle: string;
  academyName: string;
  /** Live attendance % so far (lib/yuva/progress.ts). */
  attendancePct: number;
  certificate: CertificateInfo | null;
};

/**
 * Per-enrollment certificate state for the student portal — LIVE enrollment
 * lookup by personId (the cookie is never trusted for enrollment data).
 */
export async function fetchMyCertificateOverview(
  personId: string
): Promise<MyCertificateRow[]> {
  const svc = await createServiceClient();

  const { data: enrollments } = await svc
    .from("enrollments")
    .select("id, status, run_id")
    .eq("person_id", personId)
    .in("status", ["active", "completed"])
    .order("joined_at", { ascending: false });
  if (!enrollments || enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map((e) => e.id);
  const runIds = [...new Set(enrollments.map((e) => e.run_id))];

  const [runsRes, certByEnrollment] = await Promise.all([
    svc
      .from("runs")
      .select("id, program_id, academy_id, status")
      .in("id", runIds),
    fetchCertificatesByEnrollment(enrollmentIds),
  ]);
  const runs = runsRes.data ?? [];
  const runById = new Map(runs.map((r) => [r.id, r]));

  const programIds = [...new Set(runs.map((r) => r.program_id))];
  const academyIds = [...new Set(runs.map((r) => r.academy_id))];

  const [programsRes, academiesRes, sessionsRes] = await Promise.all([
    programIds.length > 0
      ? svc.from("programs").select("id, title").in("id", programIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    academyIds.length > 0
      ? svc.from("academies").select("id, display_name").in("id", academyIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    svc
      .from("run_sessions")
      .select("id, run_id, status, expects_submission")
      .in("run_id", runIds),
  ]);
  const programById = new Map((programsRes.data ?? []).map((p) => [p.id, p]));
  const academyById = new Map(
    (academiesRes.data ?? []).map((a) => [a.id, a])
  );
  const sessions = sessionsRes.data ?? [];
  const sessionIds = sessions.map((s) => s.id);

  let attendance: (AttendanceRow & { run_session_id: string })[] = [];
  if (sessionIds.length > 0) {
    const { data } = await svc
      .from("attendance")
      .select("enrollment_id, run_session_id, present")
      .in("enrollment_id", enrollmentIds)
      .in("run_session_id", sessionIds);
    attendance = data ?? [];
  }

  const sessionsByRun = new Map<string, ProgressSession[]>();
  for (const s of sessions) {
    const list = sessionsByRun.get(s.run_id) ?? [];
    list.push({
      id: s.id,
      status: s.status,
      expects_submission: s.expects_submission,
    });
    sessionsByRun.set(s.run_id, list);
  }

  return enrollments.flatMap((e) => {
    const run = runById.get(e.run_id);
    if (!run) return [];
    const single: ProgressEnrollment[] = [{ id: e.id, status: e.status }];
    const myAttendance = attendance.filter((a) => a.enrollment_id === e.id);
    return [
      {
        enrollmentId: e.id,
        enrollmentStatus: e.status as "active" | "completed",
        runId: run.id,
        runStatus: run.status as RunStatus,
        programTitle: programById.get(run.program_id)?.title ?? "Program",
        academyName:
          academyById.get(run.academy_id)?.display_name ?? "Yi Youth Academy",
        attendancePct: attendancePct(
          single,
          sessionsByRun.get(run.id) ?? [],
          myAttendance
        ),
        certificate: certByEnrollment.get(e.id) ?? null,
      },
    ];
  });
}
