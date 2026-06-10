"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — per-session student work actions (Phase 13).
//
// Spec: docs/yi-youth-academy-spec.md → Server Actions Inventory row
// `actions/submissions.ts` (donor: app/yi-future/actions/submissions.ts) —
// keyed on run_session_id (template Part C "submit their work against each
// session"; NO separate assignments system).
//
// Pure rules live in lib/yuva/submission-rules.ts [TDD]:
// nextVersion (draft overwrites in place; submitted/reviewed bump),
// isLateSubmission (scheduled_at + SUBMISSION_GRACE_DAYS), canStudentTouch
// (active enrollment only; submitted/reviewed are read-only in place),
// canMentorReview (only 'submitted' work).
//
// STUDENT gate: getStudentSession() (signed cookie re-verified) + LIVE
// ACTIVE-enrollment-in-the-session's-run lookup + ownership — enrollments
// are NEVER trusted from the cookie. MENTOR/MANAGER gate:
// getMentorSessionAccess (assigned mentor OR run manager via canManageRun).
//
// Contract: gate-first → service write/storage → logYuvaAudit →
// revalidatePath → ActionResult. Expected failures return
// { success:false, error } — NEVER a throw, NEVER a silent redirect.
// Access codes are NEVER selected here (login credentials).
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getMentorSessionAccess } from "@/lib/yuva/auth/mentor-access";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import {
  canMentorReview,
  canStudentTouch,
  isLateSubmission,
  nextVersion,
  type SubmissionStatus,
} from "@/lib/yuva/submission-rules";
import {
  createSignedUrl,
  removeObject,
  uploadBase64,
} from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// yip server module's Database type includes the yi_directory schema
// (repo precedent: components/yuva/cohort/data.ts).
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

const AUTH_ERROR = "Your session has expired. Please sign in again.";
const FORBIDDEN_ERROR = "You are not actively enrolled in this program.";

const uuid = z.string().uuid();

// Allowed submission file types (same family as session materials).
const SUBMISSION_CONTENT_TYPES = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["application/vnd.ms-powerpoint", "ppt"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pptx",
  ],
  ["application/vnd.ms-excel", "xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx",
  ],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["application/zip", "zip"],
]);

// 10 MB raw cap (spec) ≈ 14M base64 chars. NOTE: the app-wide server-action
// body limit is 10mb — very large files (>~7 MB raw) can still bounce at the
// transport layer; the client mirrors this cap and warns earlier.
const MAX_BASE64_CHARS = 14_000_000;
const MAX_TEXT_CHARS = 20_000;

const draftSchema = z.object({
  textBody: z.string().max(MAX_TEXT_CHARS, "Text is too long.").optional(),
  fileBase64: z.string().optional(),
  fileName: z.string().max(255).optional(),
  contentType: z.string().optional(),
});

function revalidateSubmissionPaths(runId: string) {
  revalidatePath("/youth-academy/me/work");
  revalidatePath(`/youth-academy/me/program/${runId}`);
  revalidatePath(`/youth-academy/mentor/cohorts/${runId}`);
  revalidatePath(`/youth-academy/chapter/runs/${runId}/cohort`);
}

// ─── Student gate plumbing ─────────────────────────────────────────────────

type SessionSlice = {
  id: string;
  run_id: string;
  seq: number;
  name: string;
  scheduled_at: string | null;
  status: "scheduled" | "completed" | "cancelled";
  expects_submission: boolean;
  chapter: string | null;
};

async function loadSession(
  svc: Svc,
  runSessionId: string
): Promise<SessionSlice | null> {
  const { data } = await svc
    .from("run_sessions")
    .select(
      "id, run_id, seq, name, scheduled_at, status, expects_submission, runs ( id, chapter )"
    )
    .eq("id", runSessionId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    run_id: data.run_id,
    seq: data.seq,
    name: data.name,
    scheduled_at: data.scheduled_at,
    status: data.status,
    expects_submission: data.expects_submission,
    chapter: data.runs?.chapter ?? null,
  };
}

/**
 * LIVE ACTIVE-enrollment check for writes: the caller's person must hold an
 * ACTIVE enrollment in the run (completed/dropped are read-only — enforced
 * again by canStudentTouch). Fail closed on any lookup error.
 */
async function findMyActiveEnrollment(
  svc: Svc,
  personId: string,
  runId: string
): Promise<{ id: string; status: "active" } | null> {
  const { data, error } = await svc
    .from("enrollments")
    .select("id, status")
    .eq("person_id", personId)
    .eq("run_id", runId)
    .eq("status", "active")
    .limit(1);
  if (error) {
    console.error("[yuva-submissions] enrollment check failed:", error.message);
    return null;
  }
  const row = data?.[0];
  return row ? { id: row.id, status: "active" } : null;
}

type ExistingSubmission = {
  id: string;
  version: number;
  status: SubmissionStatus;
  file_storage_path: string | null;
  text_body: string | null;
};

async function listMySubmissions(
  svc: Svc,
  runSessionId: string,
  enrollmentId: string
): Promise<ExistingSubmission[]> {
  const { data } = await svc
    .from("submissions")
    .select("id, version, status, file_storage_path, text_body")
    .eq("run_session_id", runSessionId)
    .eq("enrollment_id", enrollmentId)
    .order("version", { ascending: true });
  return (data ?? []) as ExistingSubmission[];
}

// ─── saveSubmissionDraft (student) ─────────────────────────────────────────

/**
 * Create or update the student's current DRAFT for a session. A draft
 * overwrites in place; after submitted/reviewed a NEW version row is born
 * (nextVersion). File goes to the private `yuva-submissions` bucket at
 * runs/{runId}/sessions/{sessionId}/{enrollmentId}/v{n}-{slug}. Enforces
 * has-content (text and/or file) and a 10 MB file cap.
 */
export async function saveSubmissionDraft(
  runSessionId: string,
  input: {
    textBody?: string;
    fileBase64?: string;
    fileName?: string;
    contentType?: string;
  }
): Promise<ActionResult<{ id: string; version: number }>> {
  if (!uuid.safeParse(runSessionId).success) {
    return { success: false, error: "Invalid session id." };
  }
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid submission.",
    };
  }

  // Gate 1: verified student session.
  const session = await getStudentSession();
  if (!session) return { success: false, error: AUTH_ERROR };

  const svc = await createServiceClient();

  // Gate 2: the session must exist, expect work, and not be cancelled.
  const runSession = await loadSession(svc, runSessionId);
  if (!runSession) return { success: false, error: "Session not found." };
  if (!runSession.expects_submission) {
    return {
      success: false,
      error: "This session does not expect a submission.",
    };
  }
  if (runSession.status === "cancelled") {
    return {
      success: false,
      error: "This session was cancelled — it no longer accepts work.",
    };
  }

  // Gate 3: LIVE active enrollment in the session's run (ownership).
  const enrollment = await findMyActiveEnrollment(
    svc,
    session.personId,
    runSession.run_id
  );
  if (!enrollment) return { success: false, error: FORBIDDEN_ERROR };

  // Decide the target version (draft overwrites; submitted/reviewed bump).
  const existing = await listMySubmissions(svc, runSessionId, enrollment.id);
  const currentDraft = existing.find((s) => s.status === "draft");
  if (currentDraft) {
    const touch = canStudentTouch(enrollment, currentDraft);
    if (!touch.allowed) return { success: false, error: touch.reason };
  } else {
    const touch = canStudentTouch(enrollment);
    if (!touch.allowed) return { success: false, error: touch.reason };
  }
  const version = nextVersion(
    existing.map((s) => ({ version: s.version, status: s.status }))
  );

  // Optional file upload.
  let filePath: string | null = currentDraft?.file_storage_path ?? null;
  let uploadedPath: string | null = null;
  if (parsed.data.fileBase64) {
    if (parsed.data.fileBase64.length > MAX_BASE64_CHARS) {
      return { success: false, error: "File is too large — 10 MB max." };
    }
    const extension = SUBMISSION_CONTENT_TYPES.get(
      parsed.data.contentType ?? ""
    );
    if (!extension) {
      return {
        success: false,
        error:
          "Unsupported file type — upload a PDF, Word, PowerPoint, Excel, image (PNG/JPG) or ZIP file.",
      };
    }
    // Path-safe slug from the original file name.
    const base = (parsed.data.fileName ?? "work").replace(/\.[^.]+$/, "");
    const slugBase =
      base
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^[-.]+/, "")
        .replace(/-+$/, "")
        .slice(0, 80) || "work";
    const path = `runs/${runSession.run_id}/sessions/${runSessionId}/${enrollment.id}/v${version}-${slugBase}.${extension}`;

    const uploaded = await uploadBase64(
      "yuva-submissions",
      path,
      parsed.data.fileBase64,
      parsed.data.contentType ?? "application/octet-stream"
    );
    if (!uploaded.ok) return { success: false, error: uploaded.error };
    filePath = path;
    uploadedPath = path;
  }

  // Enforce has-content (mirrors the DB CHECK so the user sees a clear error).
  const textBody = parsed.data.textBody?.trim() || null;
  if (!textBody && !filePath) {
    return {
      success: false,
      error: "Add some text or attach a file before saving.",
    };
  }

  // Write: update the in-place draft or insert the new version row.
  let submissionId: string;
  if (currentDraft) {
    const { error } = await svc
      .from("submissions")
      .update({ text_body: textBody, file_storage_path: filePath })
      .eq("id", currentDraft.id);
    if (error) {
      if (uploadedPath) await removeObject("yuva-submissions", uploadedPath);
      return { success: false, error: error.message };
    }
    submissionId = currentDraft.id;
  } else {
    const { data: inserted, error } = await svc
      .from("submissions")
      .insert({
        run_session_id: runSessionId,
        enrollment_id: enrollment.id,
        version,
        text_body: textBody,
        file_storage_path: filePath,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      if (uploadedPath) await removeObject("yuva-submissions", uploadedPath);
      return {
        success: false,
        error: error?.message ?? "Could not save your draft.",
      };
    }
    submissionId = inserted.id;
  }

  await logYuvaAudit({
    action: "save_submission_draft",
    entity: "submissions",
    entity_id: submissionId,
    chapter: runSession.chapter,
    actor_person_id: session.personId,
    meta: {
      run_id: runSession.run_id,
      run_session_id: runSessionId,
      enrollment_id: enrollment.id,
      version,
      has_file: !!filePath,
      has_text: !!textBody,
    },
  });
  revalidateSubmissionPaths(runSession.run_id);
  return { success: true, data: { id: submissionId, version } };
}

// ─── submitSubmission (student) ────────────────────────────────────────────

/**
 * Promote the student's current draft to 'submitted'. Stamps submitted_at
 * and is_late (lib rules vs the session's scheduled_at + grace window).
 */
export async function submitSubmission(
  runSessionId: string
): Promise<ActionResult<{ id: string; version: number; isLate: boolean }>> {
  if (!uuid.safeParse(runSessionId).success) {
    return { success: false, error: "Invalid session id." };
  }

  const session = await getStudentSession();
  if (!session) return { success: false, error: AUTH_ERROR };

  const svc = await createServiceClient();

  const runSession = await loadSession(svc, runSessionId);
  if (!runSession) return { success: false, error: "Session not found." };
  if (!runSession.expects_submission) {
    return {
      success: false,
      error: "This session does not expect a submission.",
    };
  }
  if (runSession.status === "cancelled") {
    return {
      success: false,
      error: "This session was cancelled — it no longer accepts work.",
    };
  }

  const enrollment = await findMyActiveEnrollment(
    svc,
    session.personId,
    runSession.run_id
  );
  if (!enrollment) return { success: false, error: FORBIDDEN_ERROR };

  const existing = await listMySubmissions(svc, runSessionId, enrollment.id);
  const draft = existing.find((s) => s.status === "draft");
  if (!draft) {
    const latest = existing[existing.length - 1];
    if (latest?.status === "submitted") {
      return {
        success: false,
        error: "Already submitted — save a new draft to resubmit.",
      };
    }
    if (latest?.status === "reviewed") {
      return {
        success: false,
        error:
          "This work has been reviewed — save a new draft to resubmit as a new version.",
      };
    }
    return { success: false, error: "Save a draft first, then submit." };
  }

  const touch = canStudentTouch(enrollment, draft);
  if (!touch.allowed) return { success: false, error: touch.reason };

  if (!draft.text_body && !draft.file_storage_path) {
    return {
      success: false,
      error: "Add some text or attach a file before submitting.",
    };
  }

  const now = new Date();
  const isLate = isLateSubmission(runSession.scheduled_at, now);
  const { error } = await svc
    .from("submissions")
    .update({
      status: "submitted",
      submitted_at: now.toISOString(),
      is_late: isLate,
    })
    .eq("id", draft.id)
    .eq("status", "draft"); // double-submit race guard
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "submit_submission",
    entity: "submissions",
    entity_id: draft.id,
    chapter: runSession.chapter,
    actor_person_id: session.personId,
    meta: {
      run_id: runSession.run_id,
      run_session_id: runSessionId,
      enrollment_id: enrollment.id,
      version: draft.version,
      is_late: isLate,
    },
  });
  revalidateSubmissionPaths(runSession.run_id);
  return {
    success: true,
    data: { id: draft.id, version: draft.version, isLate },
  };
}

// ─── getMySubmissionFileUrl (student — owner only) ─────────────────────────

/**
 * Short-lived signed URL for the student's OWN submission file. Ownership is
 * re-verified LIVE: the submission's enrollment must belong to the caller's
 * person and not be dropped. Mentors/managers use getSubmissionFileUrl.
 */
export async function getMySubmissionFileUrl(
  submissionId: string
): Promise<ActionResult<{ url: string }>> {
  if (!uuid.safeParse(submissionId).success) {
    return { success: false, error: "File not found." };
  }

  const session = await getStudentSession();
  if (!session) return { success: false, error: AUTH_ERROR };

  const svc = await createServiceClient();
  const { data: submission } = await svc
    .from("submissions")
    .select(
      "id, file_storage_path, enrollments ( id, person_id, status )"
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission || !submission.file_storage_path) {
    return { success: false, error: "File not found." };
  }

  // Owner-only + not dropped (fail closed; missing enrollment ⇒ deny).
  const enrollment = submission.enrollments;
  if (
    !enrollment ||
    enrollment.person_id !== session.personId ||
    enrollment.status === "dropped"
  ) {
    return { success: false, error: "File not found." };
  }

  const signed = await createSignedUrl(
    "yuva-submissions",
    submission.file_storage_path
  );
  if (!signed.ok) {
    console.error("[yuva-submissions] sign failed:", signed.error);
    return {
      success: false,
      error: "Could not prepare the download. Try again.",
    };
  }
  return { success: true, data: { url: signed.url } };
}

// ─── reviewSubmission (mentor / manager) ───────────────────────────────────

/**
 * Mark a SUBMITTED piece of work as reviewed with mandatory feedback.
 * Gate: assigned mentor of the submission's session OR run manager.
 */
export async function reviewSubmission(
  submissionId: string,
  input: { feedback: string }
): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(submissionId).success) {
    return { success: false, error: "Invalid submission id." };
  }
  const feedback = input.feedback?.trim() ?? "";
  if (!feedback) {
    return {
      success: false,
      error: "Feedback is required — tell the student what you saw.",
    };
  }
  if (feedback.length > MAX_TEXT_CHARS) {
    return { success: false, error: "Feedback is too long." };
  }

  const svc = await createServiceClient();
  const { data: submission } = await svc
    .from("submissions")
    .select("id, run_session_id, enrollment_id, version, status")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return { success: false, error: "Submission not found." };

  const gate = await getMentorSessionAccess(submission.run_session_id);
  if (!gate.ok) return { success: false, error: gate.reason };

  const review = canMentorReview({ status: submission.status });
  if (!review.allowed) return { success: false, error: review.reason };

  const { error } = await svc
    .from("submissions")
    .update({
      status: "reviewed",
      feedback,
      reviewed_by: gate.personId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submission.id)
    .eq("status", "submitted"); // double-review race guard
  if (error) return { success: false, error: error.message };

  // Resolve run + chapter for the audit row / revalidation.
  const runSession = await loadSession(svc, submission.run_session_id);

  await logYuvaAudit({
    action: "review_submission",
    entity: "submissions",
    entity_id: submission.id,
    chapter: runSession?.chapter ?? null,
    actor_person_id: gate.personId,
    meta: {
      run_id: runSession?.run_id ?? null,
      run_session_id: submission.run_session_id,
      enrollment_id: submission.enrollment_id,
      version: submission.version,
      via: gate.via,
    },
  });
  if (runSession) revalidateSubmissionPaths(runSession.run_id);
  return { success: true, data: { id: submission.id } };
}

// ─── getSubmissionFileUrl (mentor / manager) ───────────────────────────────

/**
 * Short-lived signed URL for a submission file — MENTOR/MANAGER path.
 * Students get theirs via getMySubmissionFileUrl (owner-gated); do not
 * widen this gate.
 */
export async function getSubmissionFileUrl(
  submissionId: string
): Promise<ActionResult<{ url: string }>> {
  if (!uuid.safeParse(submissionId).success) {
    return { success: false, error: "File not found." };
  }

  const svc = await createServiceClient();
  const { data: submission } = await svc
    .from("submissions")
    .select("id, file_storage_path, run_session_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission || !submission.file_storage_path) {
    return { success: false, error: "File not found." };
  }

  const gate = await getMentorSessionAccess(submission.run_session_id);
  if (!gate.ok) return { success: false, error: gate.reason };

  const signed = await createSignedUrl(
    "yuva-submissions",
    submission.file_storage_path
  );
  if (!signed.ok) return { success: false, error: signed.error };
  return { success: true, data: { url: signed.url } };
}

// ─── listSessionSubmissions (mentor / manager) ─────────────────────────────

export type SessionSubmissionRow = {
  enrollmentId: string;
  personId: string;
  studentName: string;
  /** 'missing' = no submission yet for a session that expects work. */
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

/**
 * Per-student LATEST-version submission state for one session. Non-dropped
 * enrollments with no submission appear as 'missing' when the session
 * expects work. Gate: assigned mentor OR run manager.
 */
export async function listSessionSubmissions(
  runSessionId: string
): Promise<ActionResult<SessionSubmissionRow[]>> {
  if (!uuid.safeParse(runSessionId).success) {
    return { success: false, error: "Invalid session id." };
  }

  const gate = await getMentorSessionAccess(runSessionId);
  if (!gate.ok) return { success: false, error: gate.reason };

  const svc = await createServiceClient();
  const runSession = await loadSession(svc, runSessionId);
  if (!runSession) return { success: false, error: "Session not found." };

  // Roster: non-dropped enrollments of the session's run. (No access_code.)
  const { data: enrollments } = await svc
    .from("enrollments")
    .select("id, person_id, status")
    .eq("run_id", runSession.run_id)
    .in("status", ["active", "completed"]);
  const roster = enrollments ?? [];

  const enrollmentIds = roster.map((e) => e.id);
  const { data: submissionRows } = enrollmentIds.length
    ? await svc
        .from("submissions")
        .select(
          "id, enrollment_id, version, status, is_late, submitted_at, file_storage_path, text_body, feedback, reviewed_at"
        )
        .eq("run_session_id", runSessionId)
        .in("enrollment_id", enrollmentIds)
        .order("version", { ascending: true })
    : { data: [] };

  // Latest version per enrollment (rows arrive version-ascending).
  const latestByEnrollment = new Map<
    string,
    NonNullable<typeof submissionRows>[number]
  >();
  for (const row of submissionRows ?? []) {
    latestByEnrollment.set(row.enrollment_id, row);
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

  const rows: SessionSubmissionRow[] = roster
    .map((e) => {
      const latest = latestByEnrollment.get(e.id);
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
    // 'missing' rows only make sense when the session expects work.
    .filter((r) => r.status !== "missing" || runSession.expects_submission)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  return { success: true, data: rows };
}
