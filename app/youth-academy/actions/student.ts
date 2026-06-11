"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — STUDENT portal data actions (Phase 10).
//
// Gate: getStudentSession() — the signed cookie is re-verified server-side
// on EVERY call (middleware checks shape only). The cookie carries
// { personId, exp } and NOTHING else: every enrollment is resolved LIVE
// from the DB here, so dropping a student or regenerating their access
// code takes effect on the next request. No action ever exposes another
// student's data — attendance/submissions are filtered to the caller's
// own enrollment id.
// ═══════════════════════════════════════════════════════════════════════

import type { ActionResult } from "@/lib/yuva/action-result";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import type { ProgramCategory, RunStatus } from "@/lib/yuva/constants";
import {
  attendancePct,
  overallProgress,
  submissionCompletionPct,
  type AttendanceRow,
  type ProgressEnrollment,
  type ProgressSession,
  type SubmissionRow,
} from "@/lib/yuva/progress";
import { createSignedUrl, publicUrl } from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// yip server module's Database type includes the yi_directory schema
// (repo precedent: components/yuva/public/data.ts).
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

const AUTH_ERROR = "Your session has expired. Please sign in again.";
const FORBIDDEN_ERROR = "You are not enrolled in this program.";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Gate plumbing ─────────────────────────────────────────────────────────

async function requirePersonId(): Promise<string | null> {
  const session = await getStudentSession();
  return session?.personId ?? null;
}

/**
 * LIVE enrollment check: the caller's person must hold a non-dropped
 * enrollment in the run. Returns the enrollment slice or null (fail closed).
 */
async function findMyEnrollment(
  svc: Svc,
  personId: string,
  runId: string
): Promise<{
  id: string;
  status: "active" | "completed";
  run_id: string;
} | null> {
  const { data, error } = await svc
    .from("enrollments")
    .select("id, status, run_id")
    .eq("person_id", personId)
    .eq("run_id", runId)
    .in("status", ["active", "completed"])
    .limit(1);
  if (error) {
    console.error("[yuva-student] enrollment check failed:", error.message);
    return null;
  }
  const row = data?.[0];
  if (!row || row.status === "dropped") return null;
  return row as { id: string; status: "active" | "completed"; run_id: string };
}

// ─── 1. My programs ────────────────────────────────────────────────────────

export type MyProgram = {
  enrollmentId: string;
  enrollmentStatus: "active" | "completed";
  certificateId: string | null;
  runId: string;
  runStatus: RunStatus;
  chapter: string;
  startDate: string | null;
  endDate: string | null;
  programTitle: string;
  programCategory: ProgramCategory;
  academyName: string;
};

/** Active + completed enrollments with their run / program / academy. */
export async function getMyPrograms(): Promise<ActionResult<MyProgram[]>> {
  const personId = await requirePersonId();
  if (!personId) return { success: false, error: AUTH_ERROR };

  const svc = await createServiceClient();

  const { data: enrollments, error } = await svc
    .from("enrollments")
    .select("id, status, run_id, certificate_id, chapter")
    .eq("person_id", personId)
    .in("status", ["active", "completed"])
    .order("joined_at", { ascending: false });
  if (error) {
    console.error("[yuva-student] getMyPrograms failed:", error.message);
    return { success: false, error: "Could not load your programs." };
  }
  if (!enrollments || enrollments.length === 0) {
    return { success: true, data: [] };
  }

  const runIds = [...new Set(enrollments.map((e) => e.run_id))];
  const { data: runs } = await svc
    .from("runs")
    .select("id, program_id, academy_id, status, start_date, end_date, chapter")
    .in("id", runIds);
  const runById = new Map((runs ?? []).map((r) => [r.id, r]));

  const programIds = [...new Set((runs ?? []).map((r) => r.program_id))];
  const academyIds = [...new Set((runs ?? []).map((r) => r.academy_id))];
  const [programsRes, academiesRes] = await Promise.all([
    programIds.length > 0
      ? svc.from("programs").select("id, title, category").in("id", programIds)
      : Promise.resolve({ data: [] as { id: string; title: string; category: ProgramCategory }[] }),
    academyIds.length > 0
      ? svc.from("academies").select("id, display_name").in("id", academyIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);
  const programById = new Map((programsRes.data ?? []).map((p) => [p.id, p]));
  const academyById = new Map(
    (academiesRes.data ?? []).map((a) => [a.id, a])
  );

  const result: MyProgram[] = [];
  for (const e of enrollments) {
    const run = runById.get(e.run_id);
    if (!run) continue;
    const program = programById.get(run.program_id);
    const academy = academyById.get(run.academy_id);
    result.push({
      enrollmentId: e.id,
      enrollmentStatus: e.status as "active" | "completed",
      certificateId: e.certificate_id,
      runId: run.id,
      runStatus: run.status,
      chapter: run.chapter,
      startDate: run.start_date,
      endDate: run.end_date,
      programTitle: program?.title ?? "Program",
      programCategory: (program?.category ?? "learning") as ProgramCategory,
      academyName: academy?.display_name ?? "Yi Youth Academy",
    });
  }
  return { success: true, data: result };
}

// ─── 2. My schedule (one run) ──────────────────────────────────────────────

export type MyScheduleSession = {
  id: string;
  seq: number;
  name: string;
  durationMinutes: number;
  learningObjective: string | null;
  description: string | null;
  scheduledAt: string | null;
  venue: string | null;
  status: "scheduled" | "completed" | "cancelled";
  expectsSubmission: boolean;
  /** National template course document attached to this session. */
  hasDocument: boolean;
  mentor: { personId: string; name: string; photoUrl: string | null } | null;
  /** Visible mentor-uploaded learning materials for this session. */
  materials: { id: string; title: string }[];
  /** My own attendance mark: true/false once marked, null before. */
  myAttendance: boolean | null;
};

export type MyMentorProfile = {
  personId: string;
  name: string;
  bio: string | null;
  expertise: string[];
  organization: string | null;
  photoUrl: string | null;
};

export type MySchedule = {
  runId: string;
  runStatus: RunStatus;
  programTitle: string;
  programCategory: ProgramCategory;
  academyName: string;
  startDate: string | null;
  endDate: string | null;
  /** True when the program has a syllabus document attached. */
  hasSyllabus: boolean;
  sessions: MyScheduleSession[];
  mentors: MyMentorProfile[];
};

/** Full schedule for a run the caller is LIVE-verified enrolled in. */
export async function getMySchedule(
  runId: string
): Promise<ActionResult<MySchedule>> {
  const personId = await requirePersonId();
  if (!personId) return { success: false, error: AUTH_ERROR };
  if (!UUID_RE.test(runId)) return { success: false, error: FORBIDDEN_ERROR };

  const svc = await createServiceClient();
  const enrollment = await findMyEnrollment(svc, personId, runId);
  if (!enrollment) return { success: false, error: FORBIDDEN_ERROR };

  const { data: run } = await svc
    .from("runs")
    .select("id, program_id, academy_id, status, start_date, end_date")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { success: false, error: FORBIDDEN_ERROR };

  const [programRes, academyRes, sessionsRes] = await Promise.all([
    svc
      .from("programs")
      .select("title, category, syllabus_storage_path")
      .eq("id", run.program_id)
      .maybeSingle<{
        title: string;
        category: ProgramCategory;
        syllabus_storage_path: string | null;
      }>(),
    svc
      .from("academies")
      .select("display_name")
      .eq("id", run.academy_id)
      .maybeSingle(),
    svc
      .from("run_sessions")
      .select(
        "id, seq, name, duration_minutes, learning_objective, description, scheduled_at, venue, status, expects_submission, mentor_person_id, document_storage_path"
      )
      .eq("run_id", runId)
      .order("seq", { ascending: true }),
  ]);

  const sessions = sessionsRes.data ?? [];
  const sessionIds = sessions.map((s) => s.id);

  // Materials (visible only) + MY attendance, in parallel.
  const [materialsRes, attendanceRes] = await Promise.all([
    sessionIds.length > 0
      ? svc
          .from("materials")
          .select("id, run_session_id, title")
          .in("run_session_id", sessionIds)
          .eq("visible", true)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; run_session_id: string; title: string }[] }),
    sessionIds.length > 0
      ? svc
          .from("attendance")
          .select("run_session_id, present")
          .eq("enrollment_id", enrollment.id)
          .in("run_session_id", sessionIds)
      : Promise.resolve({ data: [] as { run_session_id: string; present: boolean }[] }),
  ]);

  const materialsBySession = new Map<string, { id: string; title: string }[]>();
  for (const m of materialsRes.data ?? []) {
    const list = materialsBySession.get(m.run_session_id) ?? [];
    list.push({ id: m.id, title: m.title });
    materialsBySession.set(m.run_session_id, list);
  }
  const attendanceBySession = new Map<string, boolean>();
  for (const a of attendanceRes.data ?? []) {
    attendanceBySession.set(a.run_session_id, a.present);
  }

  // Mentor identities (canonical: yi_directory) + profile cards.
  const mentorIds = [
    ...new Set(
      sessions.map((s) => s.mentor_person_id).filter((v): v is string => !!v)
    ),
  ];
  const mentorName = new Map<string, string>();
  const mentorProfiles: MyMentorProfile[] = [];
  if (mentorIds.length > 0) {
    const dir = await createDirService();
    const { data: people } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, full_name")
      .in("id", mentorIds);
    for (const p of people ?? []) {
      mentorName.set(p.id, p.full_name ?? "—");
    }

    const { data: profiles } = await svc
      .from("mentor_profiles")
      .select("person_id, bio, expertise, organization, photo_storage_path, updated_at")
      .in("person_id", mentorIds);
    const profileByPerson = new Map(
      (profiles ?? []).map((p) => [p.person_id, p])
    );
    for (const id of mentorIds) {
      const prof = profileByPerson.get(id);
      mentorProfiles.push({
        personId: id,
        name: mentorName.get(id) ?? "—",
        bio: prof?.bio ?? null,
        expertise: prof?.expertise ?? [],
        organization: prof?.organization ?? null,
        photoUrl: prof?.photo_storage_path
          ? `${publicUrl(prof.photo_storage_path)}?v=${encodeURIComponent(prof.updated_at ?? "")}`
          : null,
      });
    }
  }
  const mentorPhotoByPerson = new Map(
    mentorProfiles.map((m) => [m.personId, m.photoUrl])
  );

  return {
    success: true,
    data: {
      runId: run.id,
      runStatus: run.status,
      programTitle: programRes.data?.title ?? "Program",
      programCategory: (programRes.data?.category ?? "learning") as ProgramCategory,
      academyName: academyRes.data?.display_name ?? "Yi Youth Academy",
      startDate: run.start_date,
      endDate: run.end_date,
      hasSyllabus: !!programRes.data?.syllabus_storage_path,
      sessions: sessions.map((s) => ({
        id: s.id,
        seq: s.seq,
        name: s.name,
        durationMinutes: s.duration_minutes,
        learningObjective: s.learning_objective,
        description: s.description,
        scheduledAt: s.scheduled_at,
        venue: s.venue,
        status: s.status,
        expectsSubmission: s.expects_submission,
        hasDocument: !!s.document_storage_path,
        mentor: s.mentor_person_id
          ? {
              personId: s.mentor_person_id,
              name: mentorName.get(s.mentor_person_id) ?? "—",
              photoUrl: mentorPhotoByPerson.get(s.mentor_person_id) ?? null,
            }
          : null,
        materials: materialsBySession.get(s.id) ?? [],
        myAttendance: attendanceBySession.get(s.id) ?? null,
      })),
      mentors: mentorProfiles,
    },
  };
}

// ─── 3. My progress (one run) ──────────────────────────────────────────────

export type MyProgress = {
  attendancePct: number;
  submissionPct: number;
  overallPct: number;
  completedSessions: number;
  totalSessions: number;
  expectingSessions: number;
  submittedCount: number;
};

/** Progress for the caller's own enrollment, computed over LIVE rows. */
export async function getMyProgress(
  runId: string
): Promise<ActionResult<MyProgress>> {
  const personId = await requirePersonId();
  if (!personId) return { success: false, error: AUTH_ERROR };
  if (!UUID_RE.test(runId)) return { success: false, error: FORBIDDEN_ERROR };

  const svc = await createServiceClient();
  const enrollment = await findMyEnrollment(svc, personId, runId);
  if (!enrollment) return { success: false, error: FORBIDDEN_ERROR };

  const { data: sessionRows } = await svc
    .from("run_sessions")
    .select("id, status, expects_submission")
    .eq("run_id", runId);
  const sessions: ProgressSession[] = (sessionRows ?? []).map((s) => ({
    id: s.id,
    status: s.status,
    expects_submission: s.expects_submission,
  }));
  const sessionIds = sessions.map((s) => s.id);

  let attendance: AttendanceRow[] = [];
  let submissions: SubmissionRow[] = [];
  if (sessionIds.length > 0) {
    const [attendanceRes, submissionsRes] = await Promise.all([
      svc
        .from("attendance")
        .select("enrollment_id, run_session_id, present")
        .eq("enrollment_id", enrollment.id)
        .in("run_session_id", sessionIds),
      svc
        .from("submissions")
        .select("enrollment_id, run_session_id, status")
        .eq("enrollment_id", enrollment.id)
        .in("run_session_id", sessionIds),
    ]);
    attendance = attendanceRes.data ?? [];
    submissions = submissionsRes.data ?? [];
  }

  // Per-student values: single-enrollment array (lib/yuva/progress contract).
  const me: ProgressEnrollment[] = [
    { id: enrollment.id, status: enrollment.status },
  ];

  const completedSessions = sessions.filter(
    (s) => s.status === "completed"
  ).length;
  const expectingSessions = sessions.filter(
    (s) => s.expects_submission && s.status !== "cancelled"
  ).length;
  const submittedCount = submissions.filter(
    (s) => s.status === "submitted" || s.status === "reviewed"
  ).length;

  return {
    success: true,
    data: {
      attendancePct: attendancePct(me, sessions, attendance),
      submissionPct: submissionCompletionPct(me, sessions, submissions),
      overallPct: overallProgress(me, sessions, attendance, submissions),
      completedSessions,
      totalSessions: sessions.filter((s) => s.status !== "cancelled").length,
      expectingSessions,
      submittedCount,
    },
  };
}

// ─── 4. Signed file URLs (session document / material) ────────────────────

export type StudentFileKind = "session_document" | "material";

/**
 * Mint a short-lived signed URL for a file the caller may see. The
 * student's LIVE enrollment must cover the session's run — verified here
 * on every call, never trusted from the cookie.
 */
export async function getStudentFileUrl(
  kind: StudentFileKind,
  id: string
): Promise<ActionResult<{ url: string }>> {
  const personId = await requirePersonId();
  if (!personId) return { success: false, error: AUTH_ERROR };
  if (!UUID_RE.test(id)) {
    return { success: false, error: "File not found." };
  }

  const svc = await createServiceClient();

  let storagePath: string | null = null;
  let runId: string | null = null;

  if (kind === "session_document") {
    const { data: session } = await svc
      .from("run_sessions")
      .select("id, run_id, document_storage_path")
      .eq("id", id)
      .maybeSingle();
    if (!session) return { success: false, error: "File not found." };
    storagePath = session.document_storage_path;
    runId = session.run_id;
  } else if (kind === "material") {
    const { data: material } = await svc
      .from("materials")
      .select("id, storage_path, visible, run_session_id")
      .eq("id", id)
      .maybeSingle();
    // Hidden materials are indistinguishable from missing ones (fail closed).
    if (!material || !material.visible) {
      return { success: false, error: "File not found." };
    }
    const { data: session } = await svc
      .from("run_sessions")
      .select("id, run_id")
      .eq("id", material.run_session_id)
      .maybeSingle();
    if (!session) return { success: false, error: "File not found." };
    storagePath = material.storage_path;
    runId = session.run_id;
  } else {
    return { success: false, error: "File not found." };
  }

  if (!storagePath || !runId) {
    return { success: false, error: "File not found." };
  }

  // LIVE enrollment gate — the whole point of this action.
  const enrollment = await findMyEnrollment(svc, personId, runId);
  if (!enrollment) return { success: false, error: FORBIDDEN_ERROR };

  const signed = await createSignedUrl("yuva-materials", storagePath);
  if (!signed.ok) {
    console.error("[yuva-student] sign failed:", signed.error);
    return { success: false, error: "Could not prepare the download. Try again." };
  }
  return { success: true, data: { url: signed.url } };
}

// ─── 5. Program syllabus (one signed URL per run) ─────────────────────────

/**
 * Mint a signed URL for the run's program-level syllabus document. Gated by
 * the caller's LIVE enrollment in the run — resolved here, never trusted from
 * the cookie. Returns "File not found." when the program has no syllabus, so
 * the absence of a syllabus is indistinguishable from a missing file.
 */
export async function getProgramSyllabusUrl(
  runId: string
): Promise<ActionResult<{ url: string }>> {
  const personId = await requirePersonId();
  if (!personId) return { success: false, error: AUTH_ERROR };
  if (!UUID_RE.test(runId)) return { success: false, error: FORBIDDEN_ERROR };

  const svc = await createServiceClient();

  // LIVE enrollment gate — the caller must hold an active/completed seat.
  const enrollment = await findMyEnrollment(svc, personId, runId);
  if (!enrollment) return { success: false, error: FORBIDDEN_ERROR };

  const { data: run } = await svc
    .from("runs")
    .select("id, program_id")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { success: false, error: "File not found." };

  // Column not yet in the generated types (migration 20260611160000) — read
  // it via an explicit typed maybeSingle until the conductor regenerates types.
  const { data: program } = await svc
    .from("programs")
    .select("syllabus_storage_path")
    .eq("id", run.program_id)
    .maybeSingle<{ syllabus_storage_path: string | null }>();

  const storagePath = program?.syllabus_storage_path ?? null;
  if (!storagePath) return { success: false, error: "File not found." };

  const signed = await createSignedUrl("yuva-materials", storagePath);
  if (!signed.ok) {
    console.error("[yuva-student] syllabus sign failed:", signed.error);
    return {
      success: false,
      error: "Could not prepare the download. Try again.",
    };
  }
  return { success: true, data: { url: signed.url } };
}
