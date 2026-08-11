"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — attendance actions (Phase 11).
//
// Spec: docs/yi-youth-academy-spec.md → Server Actions Inventory row
// `actions/attendance.ts` (donor: app/yi-future/actions/attendance.ts →
// saveAttendance).
//
// Exports: setLearnerAttendance (marks ONE learner — the path the grid takes
// on every tap), saveSessionAttendance (bulk upsert of a whole-roster
// snapshot, kept for the mark-all helpers; now writes only the rows that
// actually CHANGE), both gated mentor-of-session OR canManageRun and locked
// once the run is completed/certified unless an audited reopen window is
// active; reopenAttendance (manager-only, audit-logged — arms a 30-minute
// edit window via the 'attendance_reopened' audit row),
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
import { fetchAllRows } from "@/lib/pagination";
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

// ─── shared gate + lock resolution (both write paths) ─────────────────────

type SessionEditContext = {
  runId: string;
  chapter: string | null;
  seq: number | null;
  personId: string;
  via: "mentor" | "manager";
  /** ISO expiry when a post-completion reopen window is active, else null. */
  reopenedUntil: string | null;
};

/**
 * Resolve "may the caller write attendance for this session right now?" —
 * gate first, then the pure lock decision. Shared verbatim by
 * setLearnerAttendance and saveSessionAttendance so the two paths can never
 * drift apart on authorization or on the completed-run lock.
 *
 * Fails closed: an invalid id, a denied gate, a missing session/run, or an
 * active lock all return an explicit error — never a partial context.
 */
async function openSessionForEdit(
  runSessionId: string
): Promise<
  { ok: true; ctx: SessionEditContext } | { ok: false; error: string }
> {
  if (!uuid.safeParse(runSessionId).success) {
    return { ok: false, error: "Invalid session id." };
  }

  // Gate: assigned mentor OR run manager (helper admits both, fail closed).
  const gate = await getMentorSessionAccess(runSessionId);
  if (!gate.ok) return { ok: false, error: gate.reason };

  const svc = await createServiceClient();
  const { data: session } = await svc
    .from("run_sessions")
    .select("id, run_id, seq, name, runs ( id, status, chapter )")
    .eq("id", runSessionId)
    .maybeSingle();
  if (!session || !session.runs) {
    return { ok: false, error: "Session not found." };
  }
  const run = session.runs;

  // Post-completion lock — pure decision; reopened comes from the audit log.
  const reopenedUntil = await fetchAttendanceReopenedUntil(run.id);
  const verdict = canEditAttendance(run.status as RunStatus, !!reopenedUntil);
  if (!verdict.editable) {
    return { ok: false, error: verdict.reason };
  }

  return {
    ok: true,
    ctx: {
      runId: run.id,
      chapter: run.chapter,
      seq: session.seq,
      personId: gate.personId,
      via: gate.via,
      reopenedUntil,
    },
  };
}

/**
 * Every stored mark for one session, paginated past PostgREST's ~1000-row cap
 * (a cohort row dropped here would read as "never marked" and get rewritten).
 *
 * Degrades safely: fetchAllRows swallows a read error and returns what it got,
 * so a failed read yields an empty map, every row then counts as changed, and
 * the bulk save falls back to its old write-everything behaviour rather than
 * silently skipping a real change.
 */
async function readStoredMarks(
  runSessionId: string
): Promise<Map<string, boolean>> {
  const svc = await createServiceClient();
  type StoredMark = { enrollment_id: string; present: boolean };
  const rows = await fetchAllRows<StoredMark>((from, to) =>
    svc
      .from("attendance")
      .select("enrollment_id, present")
      .eq("run_session_id", runSessionId)
      .order("enrollment_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: StoredMark[] | null;
      error: unknown;
    }>
  );
  return new Map(rows.map((r) => [r.enrollment_id, r.present]));
}

// ─── setLearnerAttendance (ONE learner — the per-tap write path) ───────────

/**
 * Mark ONE learner present or absent for one session.
 *
 * Why it exists: saveSessionAttendance posts a snapshot of the whole roster,
 * so two staff marking the same session on two devices silently clobbered
 * each other — the second device's stale snapshot flipped an already-present
 * learner back to absent, with no error shown to anybody. The operating
 * workaround was "one person, one device", which does not survive a real
 * session. (run_session_id, enrollment_id) is the table's PRIMARY KEY, so a
 * one-row upsert touches only the learner actually tapped.
 *
 * Deliberately does NOT revalidatePath: the chapter cohort page renders one
 * grid per session, so revalidating on every tap would re-run the whole
 * cohort + attendance assembly for the entire run. The caller keeps its own
 * view and offers an explicit Refresh to reconcile against the server.
 */
export async function setLearnerAttendance(
  runSessionId: string,
  enrollmentId: string,
  present: boolean
): Promise<ActionResult<{ present: boolean }>> {
  if (!uuid.safeParse(enrollmentId).success) {
    return { success: false, error: "Invalid student id." };
  }

  // Same gate and same lock as the bulk path.
  const opened = await openSessionForEdit(runSessionId);
  if (!opened.ok) return { success: false, error: opened.error };
  const ctx = opened.ctx;

  const svc = await createServiceClient();

  // The enrollment id arrives from the client on every tap, so confirm it
  // belongs to THIS session's run and is still in the cohort. Fails closed:
  // a missing enrollment, a foreign one, or a dropped one all DENY — none of
  // them fall through to the write.
  const { data: enrollment, error: enrollmentError } = await svc
    .from("enrollments")
    .select("id, status")
    .eq("id", enrollmentId)
    .eq("run_id", ctx.runId)
    .maybeSingle();
  if (enrollmentError) {
    return { success: false, error: enrollmentError.message };
  }
  if (!enrollment) {
    return {
      success: false,
      error:
        "That student is not in this run's cohort — refresh and try again.",
    };
  }
  if (enrollment.status === "dropped") {
    return {
      success: false,
      error: "That student has been dropped from this cohort.",
    };
  }

  const { error } = await svc.from("attendance").upsert(
    {
      run_session_id: runSessionId,
      enrollment_id: enrollmentId,
      present,
      marked_by: ctx.personId,
      marked_at: new Date().toISOString(),
    },
    { onConflict: "run_session_id,enrollment_id" }
  );
  if (error) return { success: false, error: error.message };

  // Routine marking is already traceable on the row itself
  // (attendance.marked_by / marked_at), so a per-tap audit row would only
  // flood audit_log. An edit inside a reopen window is different: it
  // overwrites a completed run's record and the previous value is gone from
  // the row, so THAT is worth an explicit trace.
  if (ctx.reopenedUntil) {
    await logYuvaAudit({
      action: "save_attendance",
      entity: "run_sessions",
      entity_id: runSessionId,
      chapter: ctx.chapter,
      actor_person_id: ctx.personId,
      meta: {
        run_id: ctx.runId,
        seq: ctx.seq,
        rows: 1,
        mode: "single",
        present,
        via: ctx.via,
        during_reopen_until: ctx.reopenedUntil,
      },
    });
  }

  return { success: true, data: { present } };
}

// ─── saveSessionAttendance (bulk upsert) ──────────────────────────────────

/**
 * Bulk save a whole-roster snapshot for one session — the mark-all helpers.
 * Assigned mentor OR run manager. Upsert on the (run_session_id,
 * enrollment_id) PRIMARY KEY; every written row records marked_by/marked_at.
 * Rejects rows whose enrollment is not in the session's run (foreign rows),
 * and any edit while the post-completion lock is active
 * (lib/yuva/attendance-lock).
 *
 * Writes only the rows whose value actually CHANGES, so a snapshot no longer
 * rewrites marks it was not asked to change and a concurrent per-learner tap
 * survives. `saved` counts the rows written, not the rows submitted.
 */
export async function saveSessionAttendance(
  runSessionId: string,
  rows: { enrollment_id: string; present: boolean }[]
): Promise<ActionResult<{ saved: number }>> {
  const parsedRows = attendanceRowsSchema.safeParse(rows);
  if (!parsedRows.success) {
    return {
      success: false,
      error: parsedRows.error.issues[0]?.message ?? "Invalid attendance rows.",
    };
  }

  // Same gate and same lock as the per-learner path.
  const opened = await openSessionForEdit(runSessionId);
  if (!opened.ok) return { success: false, error: opened.error };
  const ctx = opened.ctx;

  if (parsedRows.data.length === 0) {
    return { success: true, data: { saved: 0 } };
  }

  const svc = await createServiceClient();

  // Collapse duplicate enrollment ids (last wins). Postgres rejects an
  // ON CONFLICT upsert that touches the same key twice in one statement, so a
  // duplicated row would otherwise fail the whole save.
  const wanted = new Map<string, boolean>(
    parsedRows.data.map((r) => [r.enrollment_id, r.present])
  );
  const enrollmentIds = [...wanted.keys()];

  // Every enrollment must belong to THIS session's run — reject foreign rows.
  const { data: enrollments, error: enrollmentsError } = await svc
    .from("enrollments")
    .select("id")
    .eq("run_id", ctx.runId)
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

  // Only the rows that actually change. A no-op row is skipped because
  // marked_by/marked_at are write-only in this codebase (nothing reads them),
  // so re-stamping an unchanged mark is invisible to every reader.
  //
  // NOTE — a MISSING row is deliberately NOT treated as "absent" here.
  // attendance.present is NOT NULL, so "not yet marked" is the ABSENCE of a
  // row, and the read side renders that third state distinctly (the grid's
  // "N unmarked" count, SessionRosterRow.present === null, and the student's
  // own myAttendance === null). Skipping an explicit absent mark just because
  // no row exists yet would therefore lose information the staff entered.
  const markedAt = new Date().toISOString();
  const stored = await readStoredMarks(runSessionId);
  const upsertRows = [...wanted.entries()]
    .filter(([enrollmentId, present]) => stored.get(enrollmentId) !== present)
    .map(([enrollment_id, present]) => ({
      run_session_id: runSessionId,
      enrollment_id,
      present,
      marked_by: ctx.personId,
      marked_at: markedAt,
    }));

  if (upsertRows.length === 0) {
    return { success: true, data: { saved: 0 } };
  }

  const { error } = await svc
    .from("attendance")
    .upsert(upsertRows, { onConflict: "run_session_id,enrollment_id" });
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "save_attendance",
    entity: "run_sessions",
    entity_id: runSessionId,
    chapter: ctx.chapter,
    actor_person_id: ctx.personId,
    meta: {
      run_id: ctx.runId,
      seq: ctx.seq,
      rows: upsertRows.length,
      submitted: wanted.size,
      mode: "bulk",
      via: ctx.via,
      ...(ctx.reopenedUntil
        ? { during_reopen_until: ctx.reopenedUntil }
        : {}),
    },
  });
  revalidateAttendancePaths(ctx.runId, runSessionId);
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
