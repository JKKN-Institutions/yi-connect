import "server-only";

/**
 * Submissions read-side assembly (Phase 13). READ-ONLY — mutations go
 * through app/youth-academy/actions/submissions.ts (gate-first).
 *
 * ⚠️ Callers are gated pages — these helpers do NOT authorize.
 * ⚠️ Access codes are NEVER selected here (login credentials).
 */

import type { ProgramCategory } from "@/lib/yuva/constants";
import type { SubmissionStatus } from "@/lib/yuva/submission-rules";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// The yip server module's Database type includes the yi_directory schema —
// same cross-schema access path components/yuva/cohort/data.ts uses.
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

// ─── Student: "My Work" ────────────────────────────────────────────────────

export type MyWorkSubmission = {
  id: string;
  version: number;
  status: SubmissionStatus;
  isLate: boolean;
  submittedAt: string | null;
  hasFile: boolean;
  textBody: string | null;
  feedback: string | null;
  reviewedAt: string | null;
};

export type MyWorkSession = {
  runSessionId: string;
  seq: number;
  name: string;
  scheduledAt: string | null;
  sessionStatus: "scheduled" | "completed" | "cancelled";
  /** Latest version of MY work for this session; null = nothing yet. */
  submission: MyWorkSubmission | null;
};

export type MyWorkProgram = {
  runId: string;
  enrollmentId: string;
  programTitle: string;
  programCategory: ProgramCategory;
  academyName: string;
  sessions: MyWorkSession[];
};

/**
 * One card per expects_submission session of each ACTIVE enrollment of this
 * person, with the latest version of their own work attached.
 */
export async function fetchMyWork(personId: string): Promise<MyWorkProgram[]> {
  const svc = await createServiceClient();

  const { data: enrollments } = await svc
    .from("enrollments")
    .select("id, run_id")
    .eq("person_id", personId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });
  if (!enrollments || enrollments.length === 0) return [];

  const runIds = [...new Set(enrollments.map((e) => e.run_id))];
  const enrollmentIds = enrollments.map((e) => e.id);

  const [runsRes, sessionsRes, submissionsRes] = await Promise.all([
    svc
      .from("runs")
      .select("id, program_id, academy_id")
      .in("id", runIds),
    svc
      .from("run_sessions")
      .select("id, run_id, seq, name, scheduled_at, status, expects_submission")
      .in("run_id", runIds)
      .eq("expects_submission", true)
      .neq("status", "cancelled")
      .order("seq", { ascending: true }),
    svc
      .from("submissions")
      .select(
        "id, run_session_id, enrollment_id, version, status, is_late, submitted_at, file_storage_path, text_body, feedback, reviewed_at"
      )
      .in("enrollment_id", enrollmentIds)
      .order("version", { ascending: true }),
  ]);

  const runs = runsRes.data ?? [];
  const programIds = [...new Set(runs.map((r) => r.program_id))];
  const academyIds = [...new Set(runs.map((r) => r.academy_id))];
  const [programsRes, academiesRes] = await Promise.all([
    programIds.length > 0
      ? svc.from("programs").select("id, title, category").in("id", programIds)
      : Promise.resolve({
          data: [] as { id: string; title: string; category: string }[],
        }),
    academyIds.length > 0
      ? svc.from("academies").select("id, display_name").in("id", academyIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);
  const programById = new Map((programsRes.data ?? []).map((p) => [p.id, p]));
  const academyById = new Map((academiesRes.data ?? []).map((a) => [a.id, a]));
  const runById = new Map(runs.map((r) => [r.id, r]));

  // Latest version per (session, enrollment) — rows arrive version-ascending.
  const latestKey = (sessionId: string, enrollmentId: string) =>
    `${sessionId}:${enrollmentId}`;
  const latestSubmission = new Map<
    string,
    NonNullable<typeof submissionsRes.data>[number]
  >();
  for (const row of submissionsRes.data ?? []) {
    latestSubmission.set(latestKey(row.run_session_id, row.enrollment_id), row);
  }

  const sessionsByRun = new Map<
    string,
    NonNullable<typeof sessionsRes.data>
  >();
  for (const s of sessionsRes.data ?? []) {
    const list = sessionsByRun.get(s.run_id) ?? [];
    list.push(s);
    sessionsByRun.set(s.run_id, list);
  }

  const result: MyWorkProgram[] = [];
  for (const e of enrollments) {
    const run = runById.get(e.run_id);
    if (!run) continue;
    const program = programById.get(run.program_id);
    const academy = academyById.get(run.academy_id);
    const sessions = (sessionsByRun.get(e.run_id) ?? []).map((s) => {
      const latest = latestSubmission.get(latestKey(s.id, e.id));
      return {
        runSessionId: s.id,
        seq: s.seq,
        name: s.name,
        scheduledAt: s.scheduled_at,
        sessionStatus: s.status,
        submission: latest
          ? {
              id: latest.id,
              version: latest.version,
              status: latest.status,
              isLate: latest.is_late,
              submittedAt: latest.submitted_at,
              hasFile: !!latest.file_storage_path,
              textBody: latest.text_body,
              feedback: latest.feedback,
              reviewedAt: latest.reviewed_at,
            }
          : null,
      };
    });
    result.push({
      runId: e.run_id,
      enrollmentId: e.id,
      programTitle: program?.title ?? "Program",
      programCategory: (program?.category ?? "learning") as ProgramCategory,
      academyName: academy?.display_name ?? "Yi Youth Academy",
      sessions,
    });
  }
  return result;
}

// ─── Mentor / manager: queue grouped by session ────────────────────────────

export type QueueStudentRow = {
  enrollmentId: string;
  personId: string;
  studentName: string;
  status: SubmissionStatus | "missing";
  submissionId: string | null;
  version: number | null;
  isLate: boolean;
  submittedAt: string | null;
  hasFile: boolean;
  textBody: string | null;
  feedback: string | null;
  reviewedAt: string | null;
};

export type QueueSession = {
  runSessionId: string;
  seq: number;
  name: string;
  scheduledAt: string | null;
  sessionStatus: "scheduled" | "completed" | "cancelled";
  counts: { submitted: number; reviewed: number; draft: number; missing: number };
  rows: QueueStudentRow[];
};

/**
 * Per-session submission queue for a whole run: every expects_submission
 * session (cancelled excluded) × every non-dropped enrollment, latest
 * version each — students with nothing yet appear as 'missing'.
 */
export async function fetchRunSubmissionsQueue(
  runId: string
): Promise<QueueSession[]> {
  const svc = await createServiceClient();

  const [sessionsRes, enrollmentsRes] = await Promise.all([
    svc
      .from("run_sessions")
      .select("id, seq, name, scheduled_at, status, expects_submission")
      .eq("run_id", runId)
      .eq("expects_submission", true)
      .neq("status", "cancelled")
      .order("seq", { ascending: true }),
    svc
      .from("enrollments")
      .select("id, person_id, status")
      .eq("run_id", runId)
      .in("status", ["active", "completed"]),
  ]);
  const sessions = sessionsRes.data ?? [];
  const roster = enrollmentsRes.data ?? [];
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const enrollmentIds = roster.map((e) => e.id);

  const { data: submissionRows } = enrollmentIds.length
    ? await svc
        .from("submissions")
        .select(
          "id, run_session_id, enrollment_id, version, status, is_late, submitted_at, file_storage_path, text_body, feedback, reviewed_at"
        )
        .in("run_session_id", sessionIds)
        .in("enrollment_id", enrollmentIds)
        .order("version", { ascending: true })
    : { data: [] };

  // Latest version per (session, enrollment).
  const latestSubmission = new Map<
    string,
    NonNullable<typeof submissionRows>[number]
  >();
  for (const row of submissionRows ?? []) {
    latestSubmission.set(`${row.run_session_id}:${row.enrollment_id}`, row);
  }

  // Names from the canonical identity spine.
  const nameByPersonId = new Map<string, string>();
  const personIds = [...new Set(roster.map((e) => e.person_id))];
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

  return sessions.map((s) => {
    const rows: QueueStudentRow[] = roster
      .map((e) => {
        const latest = latestSubmission.get(`${s.id}:${e.id}`);
        if (!latest) {
          return {
            enrollmentId: e.id,
            personId: e.person_id,
            studentName: nameByPersonId.get(e.person_id) ?? "—",
            status: "missing" as const,
            submissionId: null,
            version: null,
            isLate: false,
            submittedAt: null,
            hasFile: false,
            textBody: null,
            feedback: null,
            reviewedAt: null,
          };
        }
        return {
          enrollmentId: e.id,
          personId: e.person_id,
          studentName: nameByPersonId.get(e.person_id) ?? "—",
          status: latest.status,
          submissionId: latest.id,
          version: latest.version,
          isLate: latest.is_late,
          submittedAt: latest.submitted_at,
          hasFile: !!latest.file_storage_path,
          textBody: latest.text_body,
          feedback: latest.feedback,
          reviewedAt: latest.reviewed_at,
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    return {
      runSessionId: s.id,
      seq: s.seq,
      name: s.name,
      scheduledAt: s.scheduled_at,
      sessionStatus: s.status,
      counts: {
        submitted: rows.filter((r) => r.status === "submitted").length,
        reviewed: rows.filter((r) => r.status === "reviewed").length,
        draft: rows.filter((r) => r.status === "draft").length,
        missing: rows.filter((r) => r.status === "missing").length,
      },
      rows,
    };
  });
}
