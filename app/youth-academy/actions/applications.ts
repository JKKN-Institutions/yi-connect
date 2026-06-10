"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — application review + cohort formation (Phase 9).
//
// Spec: docs/yi-youth-academy-spec.md → "Chapter / Institution —
// applications review" + Server Actions Inventory row `actions/applications.ts`.
//
// Exported: acceptApplication, rejectApplication, bulkReview, formCohort,
// addLateAcceptance, resendAccessCode, regenerateAccessCode.
//
// Contract (every function): gate-first via getYuvaAccess().canManageRun on
// the application's/enrollment's run → service-client write → logYuvaAudit →
// revalidatePath → ActionResult. Expected failures return
// { success:false, error } — NEVER a throw, NEVER a silent redirect.
//
// CRITICAL invariants:
//   1. formCohort claims the composite published→in_progress transition with
//      a COMPARE-AND-SWAP (UPDATE … WHERE status IN ('published',
//      'applications_closed') RETURNING) — a concurrent second click gets 0
//      rows back and fails with an explicit reload message. Enrollments and
//      emails happen only AFTER a successful claim.
//   2. Student identity dedupe is EMAIL ONLY: resolvePerson() is always
//      called WITHOUT the phone (its phone fallback would merge two
//      different students sharing a family phone). The phone stays on the
//      application row only.
//   3. Every acceptance/rejection email carries a dedupe_key
//      (notification_log UNIQUE) — double enqueue is impossible; 23505 is
//      treated as already-queued success (lib/yuva/email.ts).
//   4. Email failures NEVER roll back enrollments — codes exist either way
//      and resendAccessCode is the recovery path.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolvePerson } from "@/lib/yi/directory/resolve-person";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getYuvaAccess, type YuvaAccess } from "@/lib/yuva/auth/yuva-access";
import {
  acceptanceGuard,
  buildCohortPlan,
  generateAccessCode,
  REVIEWABLE_RUN_STATUSES,
  type PlanApplication,
} from "@/lib/yuva/cohort";
import type { RunStatus } from "@/lib/yuva/constants";
import { runStatusLabel } from "@/lib/yuva/run-machine";
import { sendYuvaEmail } from "@/lib/yuva/email";
import { acceptanceEmail, rejectionEmail } from "@/lib/yuva/email-templates";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// The yip server module's Database type includes the yi_directory schema —
// same cross-schema access path actions/runs.ts uses.
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";
const LOGIN_URL = `${APP_URL}/youth-academy/login`;

const RUNS_BASE = "/youth-academy/chapter/runs";

const uuid = z.string().uuid();

function revalidateApplicationPaths(runId: string) {
  revalidatePath("/youth-academy/chapter");
  revalidatePath(RUNS_BASE);
  revalidatePath(`${RUNS_BASE}/${runId}`);
  revalidatePath(`${RUNS_BASE}/${runId}/applications`);
}

// ─── Shared row slices + gates ────────────────────────────────────────────

type RunRow = {
  id: string;
  program_id: string;
  academy_id: string;
  chapter: string;
  status: RunStatus;
  capacity: number;
  start_date: string | null;
  end_date: string | null;
};

const RUN_COLS =
  "id, program_id, academy_id, chapter, status, capacity, start_date, end_date";

type ApplicationRow = {
  id: string;
  run_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  person_id: string | null;
  review_note: string | null;
};

const APPLICATION_COLS =
  "id, run_id, full_name, email, phone, status, person_id, review_note";

/** Load a run and require canManageRun on it. */
async function gateRun(
  runId: string
): Promise<
  | { ok: true; svc: Svc; access: YuvaAccess; run: RunRow }
  | { ok: false; error: string }
> {
  if (!uuid.safeParse(runId).success) {
    return { ok: false, error: "Invalid run id." };
  }
  const svc = await createServiceClient();
  const { data: run } = await svc
    .from("runs")
    .select(RUN_COLS)
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { ok: false, error: "Run not found." };

  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return {
      ok: false,
      error: `You can't manage this run's applications. Your access: ${access.reason}`,
    };
  }
  return { ok: true, svc, access, run: run as RunRow };
}

/** Load an application, then gate via its parent run. */
async function gateApplication(
  applicationId: string
): Promise<
  | {
      ok: true;
      svc: Svc;
      access: YuvaAccess;
      run: RunRow;
      application: ApplicationRow;
    }
  | { ok: false; error: string }
> {
  if (!uuid.safeParse(applicationId).success) {
    return { ok: false, error: "Invalid application id." };
  }
  const svc = await createServiceClient();
  const { data: application } = await svc
    .from("applications")
    .select(APPLICATION_COLS)
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { ok: false, error: "Application not found." };

  const gate = await gateRun(application.run_id);
  if (!gate.ok) return gate;
  return { ...gate, application: application as ApplicationRow };
}

/**
 * Resolve the applicant's yi_directory identity by EMAIL ONLY (invariant #2:
 * the phone is deliberately omitted — resolvePerson's phone fallback must
 * never merge two students). Returns null on failure (callers surface it).
 */
async function resolveApplicantPerson(application: {
  full_name: string;
  email: string;
}): Promise<{ personId: string } | { error: string }> {
  try {
    const personId = await resolvePerson({
      full_name: application.full_name,
      email: application.email,
      // phone deliberately omitted — email-only dedupe for students.
    });
    return { personId };
  } catch (e) {
    return {
      error: `Could not resolve the applicant's identity: ${(e as Error).message}`,
    };
  }
}

/** Does this person already hold an accepted application or enrollment in the run? */
async function personExistsInRun(
  svc: Svc,
  runId: string,
  personId: string,
  excludeApplicationId?: string
): Promise<boolean> {
  const [{ data: enr }, { data: apps }] = await Promise.all([
    svc
      .from("enrollments")
      .select("id")
      .eq("run_id", runId)
      .eq("person_id", personId)
      .limit(1),
    svc
      .from("applications")
      .select("id")
      .eq("run_id", runId)
      .eq("person_id", personId)
      .eq("status", "accepted")
      .limit(2),
  ]);
  if (enr && enr.length > 0) return true;
  const others = (apps ?? []).filter((a) => a.id !== excludeApplicationId);
  return others.length > 0;
}

/** Program title + one-line schedule summary for acceptance emails. */
async function programSummary(
  svc: Svc,
  run: RunRow
): Promise<{ programName: string; scheduleSummary: string }> {
  const [{ data: program }, { data: academy }, { count: sessionsCount }] =
    await Promise.all([
      svc
        .from("programs")
        .select("title")
        .eq("id", run.program_id)
        .maybeSingle(),
      svc
        .from("academies")
        .select("display_name")
        .eq("id", run.academy_id)
        .maybeSingle(),
      svc
        .from("run_sessions")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id),
    ]);
  const programName = program?.title ?? "your Yi Youth Academy program";
  const fmt = (d: string) =>
    new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const parts: string[] = [];
  if (academy?.display_name) parts.push(academy.display_name);
  if (run.start_date && run.end_date) {
    parts.push(`${fmt(run.start_date)} – ${fmt(run.end_date)}`);
  }
  if (sessionsCount) {
    parts.push(`${sessionsCount} session${sessionsCount === 1 ? "" : "s"}`);
  }
  return { programName, scheduleSummary: parts.join(" · ") };
}

// ─── acceptApplication ────────────────────────────────────────────────────

const reviewSchema = z.object({
  applicationId: uuid,
  reviewNote: z.string().trim().max(2000).optional(),
});

export async function acceptApplication(
  input: z.infer<typeof reviewSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid review input." };
  }
  const gate = await gateApplication(parsed.data.applicationId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, access, run, application } = gate;

  // Run-status + withdrawn check BEFORE any identity resolution.
  const pre = acceptanceGuard(run, application, false);
  if (!pre.allowed) {
    return { success: false, error: pre.reason ?? "Acceptance not allowed." };
  }

  // EMAIL-ONLY identity resolution (invariant #2).
  const resolved = await resolveApplicantPerson(application);
  if ("error" in resolved) return { success: false, error: resolved.error };

  // Duplicate person in this run → success WITH warning, never a block.
  const duplicate = await personExistsInRun(
    svc,
    run.id,
    resolved.personId,
    application.id
  );
  const guard = acceptanceGuard(run, application, duplicate);

  const warnings: string[] = [];
  if (guard.warn && guard.reason) warnings.push(guard.reason);

  const { error } = await svc
    .from("applications")
    .update({
      status: "accepted",
      person_id: resolved.personId,
      review_note: parsed.data.reviewNote ?? application.review_note,
      reviewed_by: access.personId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", application.id);
  if (error) return { success: false, error: error.message };

  // Soft capacity warning (never a block).
  const { count: acceptedCount } = await svc
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "accepted");
  if ((acceptedCount ?? 0) > run.capacity) {
    warnings.push(
      `${acceptedCount} accepted — above the expected ${run.capacity} participants (soft cap, nothing is blocked).`
    );
  }

  await logYuvaAudit({
    action: "accept_application",
    entity: "applications",
    entity_id: application.id,
    chapter: run.chapter,
    meta: {
      run_id: run.id,
      person_id: resolved.personId,
      previous_status: application.status,
      duplicate_in_run: duplicate,
    },
  });
  revalidateApplicationPaths(run.id);
  return {
    success: true,
    data: { id: application.id },
    ...(warnings.length > 0 ? { warning: warnings.join(" ") } : {}),
  };
}

// ─── rejectApplication ────────────────────────────────────────────────────

export async function rejectApplication(
  input: z.infer<typeof reviewSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid review input." };
  }
  const gate = await gateApplication(parsed.data.applicationId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, access, run, application } = gate;

  if (!REVIEWABLE_RUN_STATUSES.has(run.status)) {
    return {
      success: false,
      error: `Applications can only be reviewed while the run is published, applications-closed or in progress — this run is ${runStatusLabel(run.status).toLowerCase()}.`,
    };
  }
  if (application.status === "withdrawn") {
    return {
      success: false,
      error: "This application was withdrawn by the applicant.",
    };
  }

  // An enrolled applicant can't be rejected — that would orphan the seat.
  const { data: enrolled } = await svc
    .from("enrollments")
    .select("id")
    .eq("application_id", application.id)
    .limit(1);
  if (enrolled && enrolled.length > 0) {
    return {
      success: false,
      error:
        "This applicant is already enrolled in the cohort — they can't be rejected from the review queue.",
    };
  }

  const { error } = await svc
    .from("applications")
    .update({
      status: "rejected",
      review_note: parsed.data.reviewNote ?? application.review_note,
      reviewed_by: access.personId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", application.id);
  if (error) return { success: false, error: error.message };

  // Pre-formation, NO email — change-of-mind is allowed until formCohort
  // sends the rejection batch. POST-formation (run already in_progress) the
  // batch has passed, so notify now; the dedupe_key keeps it once-only.
  if (run.status === "in_progress") {
    const { programName } = await programSummary(svc, run);
    const rendered = rejectionEmail({
      studentName: application.full_name,
      programName,
    });
    await sendYuvaEmail({
      to: application.email,
      emailType: "rejection",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      dedupeKey: `rejection:${run.id}:${application.id}`,
      meta: { run_id: run.id, application_id: application.id },
    });
  }

  await logYuvaAudit({
    action: "reject_application",
    entity: "applications",
    entity_id: application.id,
    chapter: run.chapter,
    meta: { run_id: run.id, previous_status: application.status },
  });
  revalidateApplicationPaths(run.id);
  return { success: true, data: { id: application.id } };
}

// ─── bulkReview ───────────────────────────────────────────────────────────

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        id: uuid,
        decision: z.enum(["accept", "reject"]),
      })
    )
    .min(1, "Select at least one application.")
    .max(500),
  reviewNote: z.string().trim().max(2000).optional(),
});

export type BulkReviewRowResult = {
  id: string;
  decision: "accept" | "reject";
  success: boolean;
  error?: string;
  warning?: string;
};

export async function bulkReview(
  input: z.infer<typeof bulkSchema>
): Promise<
  ActionResult<{
    results: BulkReviewRowResult[];
    accepted: number;
    rejected: number;
    failed: number;
  }>
> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk review input.",
    };
  }

  const results: BulkReviewRowResult[] = [];
  // Sequential on purpose: per-row gates + identity resolution; the queue is
  // bounded (≤500) and correctness beats latency here.
  for (const item of parsed.data.items) {
    const fn = item.decision === "accept" ? acceptApplication : rejectApplication;
    const result = await fn({
      applicationId: item.id,
      reviewNote: parsed.data.reviewNote,
    });
    results.push({
      id: item.id,
      decision: item.decision,
      success: result.success,
      ...(result.success
        ? result.warning
          ? { warning: result.warning }
          : {}
        : { error: result.error }),
    });
  }

  const accepted = results.filter(
    (r) => r.success && r.decision === "accept"
  ).length;
  const rejected = results.filter(
    (r) => r.success && r.decision === "reject"
  ).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    success: true,
    data: { results, accepted, rejected, failed },
    ...(failed > 0
      ? { warning: `${failed} of ${results.length} could not be reviewed.` }
      : {}),
  };
}

// ─── Enrollment insert (shared by formCohort + addLateAcceptance) ─────────

/**
 * Insert one enrollment with a fresh CSPRNG access code. On a 23505 unique
 * violation: retry ONCE with a new code (an access_code collision is the
 * only retryable cause); a second 23505 means the (run, person) pair already
 * exists — reported as `duplicate`, never thrown.
 */
async function insertEnrollment(
  svc: Svc,
  row: {
    run_id: string;
    person_id: string;
    application_id: string;
    chapter: string;
  }
): Promise<
  | { ok: true; enrollmentId: string; accessCode: string }
  | { ok: false; duplicate: boolean; error: string }
> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const accessCode = generateAccessCode();
    const { data, error } = await svc
      .from("enrollments")
      .insert({ ...row, access_code: accessCode })
      .select("id")
      .single();
    if (!error && data) {
      return { ok: true, enrollmentId: data.id, accessCode };
    }
    const code = (error as { code?: string } | null)?.code;
    if (code !== "23505") {
      return {
        ok: false,
        duplicate: false,
        error: error?.message ?? "enrollment insert failed",
      };
    }
    // 23505 on the second attempt (fresh code) ⇒ run_person duplicate.
    if (attempt === 1) {
      return {
        ok: false,
        duplicate: true,
        error: "already enrolled in this run",
      };
    }
  }
  // Unreachable — the loop always returns.
  return { ok: false, duplicate: false, error: "enrollment insert failed" };
}

/** Enqueue the acceptance email (code + login link + program summary). */
async function enqueueAcceptanceEmail(args: {
  runId: string;
  personId: string;
  to: string;
  studentName: string;
  accessCode: string;
  programName: string;
  scheduleSummary: string;
  dedupeKey?: string;
}): Promise<boolean> {
  const rendered = acceptanceEmail({
    studentName: args.studentName,
    programName: args.programName,
    accessCode: args.accessCode,
    loginUrl: LOGIN_URL,
    scheduleSummary: args.scheduleSummary || undefined,
  });
  const result = await sendYuvaEmail({
    to: args.to,
    emailType: "acceptance",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    dedupeKey: args.dedupeKey ?? `acceptance:${args.runId}:${args.personId}`,
    meta: { run_id: args.runId, person_id: args.personId },
  });
  return result.ok;
}

// ─── formCohort — THE critical action ─────────────────────────────────────

export async function formCohort(input: {
  runId: string;
}): Promise<
  ActionResult<{ enrolled: number; skipped: number; emailsQueued: number }>
> {
  // (1) Gate.
  const gate = await gateRun(input.runId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run } = gate;

  // Friendly pre-checks (the CAS below is the real arbiter).
  if (run.status !== "published" && run.status !== "applications_closed") {
    return {
      success: false,
      error: `The cohort can only be formed on a published or applications-closed run — this run is ${runStatusLabel(run.status).toLowerCase()}. ${
        run.status === "in_progress"
          ? "The cohort was already formed."
          : ""
      }`.trim(),
    };
  }
  const { count: acceptedCount } = await svc
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "accepted");
  if ((acceptedCount ?? 0) === 0) {
    return {
      success: false,
      error: "No accepted applications yet — accept at least one before forming the cohort.",
    };
  }

  // (2) COMPARE-AND-SWAP claim of the composite published→in_progress
  // transition (spec-exact: UPDATE … WHERE id=$run AND status IN
  // ('published','applications_closed')). Zero rows back ⇒ a concurrent
  // click won the claim — fail explicitly, never double-process.
  const { data: claimed, error: claimError } = await svc
    .from("runs")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .in("status", ["published", "applications_closed"])
    .select("id");
  if (claimError) return { success: false, error: claimError.message };
  if (!claimed || claimed.length === 0) {
    return {
      success: false,
      error:
        "The cohort was already formed or the run is already in progress — reload the page.",
    };
  }

  // (3) Load applications + existing enrollments → pure plan.
  const [{ data: applications }, { data: enrollments }] = await Promise.all([
    svc
      .from("applications")
      .select(APPLICATION_COLS)
      .eq("run_id", run.id)
      .order("created_at", { ascending: true }),
    svc
      .from("enrollments")
      .select("application_id, person_id")
      .eq("run_id", run.id),
  ]);
  const plan = buildCohortPlan(
    (applications ?? []) as PlanApplication[],
    enrollments ?? []
  );

  const { programName, scheduleSummary } = await programSummary(svc, run);

  // (4) Per plan row: resolve identity (EMAIL ONLY), insert enrollment.
  // Per-row failures are recorded and skipped — the batch NEVER aborts.
  const enrolledPersonIds = new Set(
    (enrollments ?? []).map((e) => e.person_id)
  );
  let enrolled = 0;
  let emailsQueued = 0;
  const skippedDetails: Array<{ application_id: string; reason: string }> = [];

  for (const application of plan.toEnroll) {
    let personId = application.person_id;
    if (!personId) {
      const resolved = await resolveApplicantPerson(application);
      if ("error" in resolved) {
        skippedDetails.push({
          application_id: application.id,
          reason: resolved.error,
        });
        continue;
      }
      personId = resolved.personId;
      // Best-effort backfill — the enrollment row is the authoritative link.
      await svc
        .from("applications")
        .update({ person_id: personId })
        .eq("id", application.id);
    }

    // Same person twice in this batch (or resolved into an existing
    // enrollee) → one seat only.
    if (enrolledPersonIds.has(personId)) {
      skippedDetails.push({
        application_id: application.id,
        reason: "person already enrolled in this run (duplicate identity)",
      });
      continue;
    }

    const inserted = await insertEnrollment(svc, {
      run_id: run.id,
      person_id: personId,
      application_id: application.id,
      chapter: run.chapter,
    });
    if (!inserted.ok) {
      skippedDetails.push({
        application_id: application.id,
        reason: inserted.error,
      });
      if (inserted.duplicate) enrolledPersonIds.add(personId);
      continue;
    }

    enrolledPersonIds.add(personId);
    enrolled++;

    // (5a) Acceptance email — failure never rolls back the enrollment.
    const queued = await enqueueAcceptanceEmail({
      runId: run.id,
      personId,
      to: application.email,
      studentName: application.full_name,
      accessCode: inserted.accessCode,
      programName,
      scheduleSummary,
    });
    if (queued) emailsQueued++;
  }

  // (5b) Rejection emails for rejected applications (dedupe-keyed).
  for (const application of plan.toReject) {
    const rendered = rejectionEmail({
      studentName: application.full_name,
      programName,
    });
    const result = await sendYuvaEmail({
      to: application.email,
      emailType: "rejection",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      dedupeKey: `rejection:${run.id}:${application.id}`,
      meta: { run_id: run.id, application_id: application.id },
    });
    if (result.ok) emailsQueued++;
  }

  // (6) Cohort thread — ON CONFLICT (run_id UNIQUE) DO NOTHING semantics.
  const { error: threadError } = await svc
    .from("threads")
    .insert({ run_id: run.id });
  if (
    threadError &&
    (threadError as { code?: string }).code !== "23505"
  ) {
    console.error("[yuva-applications] thread create failed:", threadError);
  }

  const skipped = skippedDetails.length + plan.alreadyEnrolled.length;

  // (7) Audit with counts.
  await logYuvaAudit({
    action: "form_cohort",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
    meta: {
      enrolled,
      skipped,
      already_enrolled: plan.alreadyEnrolled.length,
      rejection_emails: plan.toReject.length,
      emails_queued: emailsQueued,
      skipped_details: skippedDetails,
    },
  });
  revalidateApplicationPaths(run.id);

  return {
    success: true,
    data: { enrolled, skipped, emailsQueued },
    ...(skippedDetails.length > 0
      ? {
          warning: `${skippedDetails.length} applicant${skippedDetails.length === 1 ? "" : "s"} could not be enrolled — see the queue for details.`,
        }
      : {}),
  };
}

// ─── addLateAcceptance (post-formation, single application) ───────────────

export async function addLateAcceptance(input: {
  applicationId: string;
}): Promise<ActionResult<{ enrollmentId: string }>> {
  const gate = await gateApplication(input.applicationId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run, application } = gate;

  if (application.status !== "accepted") {
    return {
      success: false,
      error: "Accept the application first, then add it to the cohort.",
    };
  }
  const guard = acceptanceGuard(run, application, false);
  if (!guard.allowed) {
    return { success: false, error: guard.reason ?? "Not allowed." };
  }

  // EMAIL-ONLY identity resolution (invariant #2).
  let personId = application.person_id;
  if (!personId) {
    const resolved = await resolveApplicantPerson(application);
    if ("error" in resolved) return { success: false, error: resolved.error };
    personId = resolved.personId;
    await svc
      .from("applications")
      .update({ person_id: personId })
      .eq("id", application.id);
  }

  const { data: existing } = await svc
    .from("enrollments")
    .select("id")
    .eq("run_id", run.id)
    .eq("person_id", personId)
    .limit(1);
  if (existing && existing.length > 0) {
    return {
      success: false,
      error: "This person is already in the cohort.",
    };
  }

  const inserted = await insertEnrollment(svc, {
    run_id: run.id,
    person_id: personId,
    application_id: application.id,
    chapter: run.chapter,
  });
  if (!inserted.ok) {
    return {
      success: false,
      error: inserted.duplicate
        ? "This person is already in the cohort."
        : `Could not enroll: ${inserted.error}`,
    };
  }

  const { programName, scheduleSummary } = await programSummary(svc, run);
  await enqueueAcceptanceEmail({
    runId: run.id,
    personId,
    to: application.email,
    studentName: application.full_name,
    accessCode: inserted.accessCode,
    programName,
    scheduleSummary,
  });

  await logYuvaAudit({
    action: "late_acceptance",
    entity: "enrollments",
    entity_id: inserted.enrollmentId,
    chapter: run.chapter,
    meta: {
      run_id: run.id,
      application_id: application.id,
      person_id: personId,
    },
  });
  revalidateApplicationPaths(run.id);
  return { success: true, data: { enrollmentId: inserted.enrollmentId } };
}

// ─── Access-code recovery (resend existing / regenerate new) ──────────────

type EnrollmentRow = {
  id: string;
  run_id: string;
  person_id: string;
  application_id: string | null;
  access_code: string;
  status: "active" | "completed" | "dropped";
};

/** Load an enrollment, gate via its run, and resolve the student's email. */
async function gateEnrollment(
  enrollmentId: string
): Promise<
  | {
      ok: true;
      svc: Svc;
      run: RunRow;
      enrollment: EnrollmentRow;
      studentName: string;
      studentEmail: string | null;
    }
  | { ok: false; error: string }
> {
  if (!uuid.safeParse(enrollmentId).success) {
    return { ok: false, error: "Invalid enrollment id." };
  }
  const svc = await createServiceClient();
  const { data: enrollment } = await svc
    .from("enrollments")
    .select("id, run_id, person_id, application_id, access_code, status")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enrollment) return { ok: false, error: "Enrollment not found." };

  const gate = await gateRun(enrollment.run_id);
  if (!gate.ok) return gate;

  // Email: the application row first (what the student applied with),
  // directory person as the fallback.
  let studentName = "";
  let studentEmail: string | null = null;
  if (enrollment.application_id) {
    const { data: application } = await svc
      .from("applications")
      .select("full_name, email")
      .eq("id", enrollment.application_id)
      .maybeSingle();
    if (application) {
      studentName = application.full_name;
      studentEmail = application.email;
    }
  }
  if (!studentEmail) {
    const dir = await createDirService();
    const { data: person } = await dir
      .schema("yi_directory")
      .from("people")
      .select("full_name, email")
      .eq("id", enrollment.person_id)
      .maybeSingle();
    if (person) {
      studentName = studentName || (person.full_name ?? "");
      studentEmail = person.email ?? null;
    }
  }

  return {
    ok: true,
    svc,
    run: gate.run,
    enrollment: enrollment as EnrollmentRow,
    studentName: studentName || "Student",
    studentEmail,
  };
}

/** Re-email the EXISTING code. dedupe_key caps it at once per day. */
export async function resendAccessCode(input: {
  enrollmentId: string;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await gateEnrollment(input.enrollmentId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run, enrollment, studentName, studentEmail } = gate;

  if (!studentEmail) {
    return {
      success: false,
      error: "No email address is on file for this student.",
    };
  }

  const { programName, scheduleSummary } = await programSummary(svc, run);
  const rendered = acceptanceEmail({
    studentName,
    programName,
    accessCode: enrollment.access_code,
    loginUrl: LOGIN_URL,
    scheduleSummary: scheduleSummary || undefined,
  });
  const result = await sendYuvaEmail({
    to: studentEmail,
    emailType: "acceptance",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    dedupeKey: `resend:${enrollment.id}:${new Date().toISOString().slice(0, 10)}`,
    meta: { run_id: run.id, enrollment_id: enrollment.id, kind: "resend" },
  });
  if (!result.ok) {
    return {
      success: false,
      error: result.error ?? "Could not queue the email.",
    };
  }

  await logYuvaAudit({
    action: "resend_access_code",
    entity: "enrollments",
    entity_id: enrollment.id,
    chapter: run.chapter,
    meta: { run_id: run.id, deduped: result.deduped ?? false },
  });
  revalidateApplicationPaths(run.id);
  return {
    success: true,
    data: { id: enrollment.id },
    ...(result.deduped
      ? {
          warning:
            "The code was already re-sent today — it can be re-sent again tomorrow.",
        }
      : {}),
  };
}

/** Invalidate the old code: generate a new CSPRNG code, audit, email it. */
export async function regenerateAccessCode(input: {
  enrollmentId: string;
}): Promise<ActionResult<{ id: string }>> {
  const gate = await gateEnrollment(input.enrollmentId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, run, enrollment, studentName, studentEmail } = gate;

  // New code; retry ONCE on an access_code collision (23505).
  let newCode = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidate = generateAccessCode();
    const { error } = await svc
      .from("enrollments")
      .update({ access_code: candidate })
      .eq("id", enrollment.id);
    if (!error) {
      newCode = candidate;
      break;
    }
    if ((error as { code?: string }).code !== "23505" || attempt === 1) {
      return {
        success: false,
        error: `Could not update the access code: ${error.message}`,
      };
    }
  }

  await logYuvaAudit({
    action: "regenerate_access_code",
    entity: "enrollments",
    entity_id: enrollment.id,
    chapter: run.chapter,
    meta: {
      run_id: run.id,
      old_code: enrollment.access_code,
      new_code: newCode,
    },
  });

  let warning: string | undefined;
  if (studentEmail) {
    const { programName, scheduleSummary } = await programSummary(svc, run);
    const rendered = acceptanceEmail({
      studentName,
      programName,
      accessCode: newCode,
      loginUrl: LOGIN_URL,
      scheduleSummary: scheduleSummary || undefined,
    });
    const result = await sendYuvaEmail({
      to: studentEmail,
      emailType: "acceptance",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      // New code each time ⇒ key on the code, every regeneration is emailed.
      dedupeKey: `regenerate:${enrollment.id}:${newCode}`,
      meta: { run_id: run.id, enrollment_id: enrollment.id, kind: "regenerate" },
    });
    if (!result.ok) {
      warning = `The new code is active but the email could not be queued (${result.error ?? "unknown"}) — use "Resend code" tomorrow or share it manually.`;
    }
  } else {
    warning =
      "The new code is active but no email address is on file for this student.";
  }

  revalidateApplicationPaths(run.id);
  return {
    success: true,
    data: { id: enrollment.id },
    ...(warning ? { warning } : {}),
  };
}
