"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — attendance actions (Phase 11).
//
// Spec: docs/yi-youth-academy-spec.md → Server Actions Inventory row
// `actions/attendance.ts` (donor: app/yi-future/actions/attendance.ts →
// saveAttendance).
//
// Exports: saveSessionAttendance (bulk upsert, mentor-of-session OR
// canManageRun, locked once the run is completed/certified unless an audited
// reopen window is active), reopenAttendance (manager-only, audit-logged —
// arms a 30-minute edit window via the 'attendance_reopened' audit row),
// markEnrollmentDropped (manager-only, audit-logged — dropped students leave
// every progress denominator per lib/yuva/progress.ts).
//
// Contract: gate-first → pure lock decision (lib/yuva/attendance-lock) →
// service-client write → logYuvaAudit → revalidatePath → ActionResult.
// Expected failures return { success:false, error } — NEVER a throw,
// NEVER a silent redirect.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import {
  ATTENDANCE_REOPEN_MINUTES,
  canEditAttendance,
} from "@/lib/yuva/attendance-lock";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getMentorSessionAccess } from "@/lib/yuva/auth/mentor-access";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import type { RunStatus } from "@/lib/yuva/constants";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { fetchAttendanceReopenedUntil } from "@/components/yuva/attendance/data";

const uuid = z.string().uuid();

const attendanceRowsSchema = z
  .array(
    z.object({
      enrollment_id: z.string().uuid(),
      present: z.boolean(),
    })
  )
  .max(500, "Too many rows in one save.");

function revalidateAttendancePaths(runId: string, runSessionId: string) {
  revalidatePath(`/youth-academy/mentor/sessions/${runSessionId}`);
  revalidatePath(`/youth-academy/mentor/cohorts/${runId}`);
  revalidatePath(`/youth-academy/chapter/runs/${runId}/cohort`);
  revalidatePath(`/youth-academy/chapter/runs/${runId}`);
}

// ─── saveSessionAttendance (bulk upsert) ──────────────────────────────────

/**
 * Bulk save the attendance grid for one session. Assigned mentor OR run
 * manager. Upsert on (run_session_id, enrollment_id); every row records
 * marked_by/marked_at. Rejects rows whose enrollment is not in the
 * session's run (foreign rows), and any edit while the post-completion lock
 * is active (lib/yuva/attendance-lock).
 */
export async function saveSessionAttendance(
  runSessionId: string,
  rows: { enrollment_id: string; present: boolean }[]
): Promise<ActionResult<{ saved: number }>> {
  if (!uuid.safeParse(runSessionId).success) {
    return { success: false, error: "Invalid session id." };
  }
  const parsedRows = attendanceRowsSchema.safeParse(rows);
  if (!parsedRows.success) {
    return {
      success: false,
      error: parsedRows.error.issues[0]?.message ?? "Invalid attendance rows.",
    };
  }

  // Gate: assigned mentor OR run manager (helper admits both, fail closed).
  const gate = await getMentorSessionAccess(runSessionId);
  if (!gate.ok) return { success: false, error: gate.reason };

  const svc = await createServiceClient();
  const { data: session } = await svc
    .from("run_sessions")
    .select("id, run_id, seq, name, runs ( id, status, chapter )")
    .eq("id", runSessionId)
    .maybeSingle();
  if (!session || !session.runs) {
    return { success: false, error: "Session not found." };
  }
  const run = session.runs;

  // Post-completion lock — pure decision; reopened comes from the audit log.
  const reopenedUntil = await fetchAttendanceReopenedUntil(run.id);
  const verdict = canEditAttendance(run.status as RunStatus, !!reopenedUntil);
  if (!verdict.editable) {
    return { success: false, error: verdict.reason };
  }

  if (parsedRows.data.length === 0) {
    return { success: true, data: { saved: 0 } };
  }

  // Every enrollment must belong to THIS session's run — reject foreign rows.
  const enrollmentIds = [
    ...new Set(parsedRows.data.map((r) => r.enrollment_id)),
  ];
  const { data: enrollments, error: enrollmentsError } = await svc
    .from("enrollments")
    .select("id")
    .eq("run_id", run.id)
    .in("id", enrollmentIds);
  if (enrollmentsError) {
    return { success: false, error: enrollmentsError.message };
  }
  const known = new Set((enrollments ?? []).map((e) => e.id));
  const foreign = enrollmentIds.filter((id) => !known.has(id));
  if (foreign.length > 0) {
    return {
      success: false,
      error: `${foreign.length} row(s) do not belong to this run's cohort — refresh and try again.`,
    };
  }

  const markedAt = new Date().toISOString();
  const upsertRows = parsedRows.data.map((row) => ({
    run_session_id: runSessionId,
    enrollment_id: row.enrollment_id,
    present: row.present,
    marked_by: gate.personId,
    marked_at: markedAt,
  }));

  const { error } = await svc
    .from("attendance")
    .upsert(upsertRows, { onConflict: "run_session_id,enrollment_id" });
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "save_attendance",
    entity: "run_sessions",
    entity_id: runSessionId,
    chapter: run.chapter,
    actor_person_id: gate.personId,
    meta: {
      run_id: run.id,
      seq: session.seq,
      rows: upsertRows.length,
      via: gate.via,
      ...(reopenedUntil ? { during_reopen_until: reopenedUntil } : {}),
    },
  });
  revalidateAttendancePaths(run.id, runSessionId);
  return { success: true, data: { saved: upsertRows.length } };
}

// ─── reopenAttendance (manager-only, audited 30-minute window) ────────────

/**
 * Reopen attendance editing on a completed/certified run for
 * ATTENDANCE_REOPEN_MINUTES. Manager-only (canManageRun — mentors cannot).
 * Implementation: writes an 'attendance_reopened' audit row;
 * saveSessionAttendance treats a row younger than the window as an active
 * reopen. No schema flag — the audit log IS the flag.
 */
export async function reopenAttendance(
  runId: string
): Promise<ActionResult<{ reopenedUntil: string }>> {
  if (!uuid.safeParse(runId).success) {
    return { success: false, error: "Invalid run id." };
  }

  const svc = await createServiceClient();
  const { data: run } = await svc
    .from("runs")
    .select("id, academy_id, chapter, status")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { success: false, error: "Run not found." };

  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return {
      success: false,
      error: `Only a run manager can reopen attendance. Your access: ${access.reason}`,
    };
  }

  if (run.status !== "completed" && run.status !== "certified") {
    return {
      success: false,
      error:
        "Attendance is not locked on this run — reopening only applies after completion.",
    };
  }

  const reopenedUntil = new Date(
    Date.now() + ATTENDANCE_REOPEN_MINUTES * 60_000
  ).toISOString();

  // The audit row IS the reopen flag (checked by saveSessionAttendance) —
  // it must be written even if the funnel actor lookup hiccups, so pass the
  // actor explicitly. logYuvaAudit never throws but CAN silently swallow a
  // failed insert; verify the flag actually landed before reporting success.
  await logYuvaAudit({
    action: "attendance_reopened",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
    actor_person_id: access.personId,
    meta: {
      run_status: run.status,
      window_minutes: ATTENDANCE_REOPEN_MINUTES,
      reopened_until: reopenedUntil,
    },
  });
  const confirmed = await fetchAttendanceReopenedUntil(run.id);
  if (!confirmed) {
    return {
      success: false,
      error: "Could not record the reopen — try again.",
    };
  }

  revalidatePath(`/youth-academy/chapter/runs/${run.id}/cohort`);
  revalidatePath(`/youth-academy/mentor/cohorts/${run.id}`);
  return { success: true, data: { reopenedUntil: confirmed } };
}

// ─── markEnrollmentDropped (manager-only) ─────────────────────────────────

/**
 * Drop a student from the cohort. Manager-only (canManageRun — mentors
 * cannot). Dropped enrollments leave every progress numerator AND
 * denominator (lib/yuva/progress.ts) and the certificate eligibility list.
 */
export async function markEnrollmentDropped(
  enrollmentId: string
): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(enrollmentId).success) {
    return { success: false, error: "Invalid enrollment id." };
  }

  const svc = await createServiceClient();
  const { data: enrollment } = await svc
    .from("enrollments")
    .select("id, run_id, person_id, status, runs ( id, academy_id, chapter, status )")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enrollment || !enrollment.runs) {
    return { success: false, error: "Enrollment not found." };
  }
  const run = enrollment.runs;

  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return {
      success: false,
      error: `Only a run manager can drop a student. Your access: ${access.reason}`,
    };
  }

  if (enrollment.status === "dropped") {
    return { success: false, error: "This student is already dropped." };
  }
  if (run.status === "certified") {
    return {
      success: false,
      error: "This run is certified — the cohort can no longer be changed.",
    };
  }

  const { error } = await svc
    .from("enrollments")
    .update({ status: "dropped" })
    .eq("id", enrollment.id)
    .eq("status", enrollment.status);
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "drop_enrollment",
    entity: "enrollments",
    entity_id: enrollment.id,
    chapter: run.chapter,
    actor_person_id: access.personId,
    meta: {
      run_id: run.id,
      person_id: enrollment.person_id,
      previous_status: enrollment.status,
    },
  });
  revalidatePath(`/youth-academy/chapter/runs/${run.id}/cohort`);
  revalidatePath(`/youth-academy/chapter/runs/${run.id}`);
  revalidatePath(`/youth-academy/mentor/cohorts/${run.id}`);
  return { success: true, data: { id: enrollment.id } };
}
