import "server-only";

/**
 * Attendance read-side assembly (Phase 11). READ-ONLY — every mutation goes
 * through app/youth-academy/actions/attendance.ts (gate-first).
 *
 * ⚠️ Callers are gated pages/actions — these helpers do NOT authorize.
 * ⚠️ Access codes are NEVER selected here (login credentials).
 */

import { ATTENDANCE_REOPEN_MINUTES } from "@/lib/yuva/attendance-lock";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// The yip server module's Database type includes the yi_directory schema —
// same cross-schema access path components/yuva/runs/data.ts uses.
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

/**
 * When did a manager last reopen attendance for this run, and is that window
 * still open? Returns the ISO expiry of the active reopen window, or null
 * when no reopen is active. Source of truth: the 'attendance_reopened'
 * audit row written by reopenAttendance (≤ ATTENDANCE_REOPEN_MINUTES old).
 */
export async function fetchAttendanceReopenedUntil(
  runId: string
): Promise<string | null> {
  const svc = await createServiceClient();
  const windowStart = new Date(
    Date.now() - ATTENDANCE_REOPEN_MINUTES * 60_000
  ).toISOString();

  const { data: rows, error } = await svc
    .from("audit_log")
    .select("created_at")
    .eq("action", "attendance_reopened")
    .eq("entity", "runs")
    .eq("entity_id", runId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(1);

  // Fail closed: a lookup error means NO active reopen (never guess open).
  if (error || !rows || rows.length === 0) return null;

  return new Date(
    new Date(rows[0].created_at).getTime() + ATTENDANCE_REOPEN_MINUTES * 60_000
  ).toISOString();
}

// ─── Single-session roster (mentor session page + chapter grids) ──────────

export type SessionRosterRow = {
  enrollment_id: string;
  person_id: string;
  full_name: string;
  institution_name: string | null;
  /** null = not yet marked for this session. */
  present: boolean | null;
};

/**
 * Non-dropped cohort members of the session's run with their attendance mark
 * for ONE session (null when unmarked). Dropped enrollments are excluded —
 * they are out of the cohort and cannot be marked.
 */
export async function fetchSessionRoster(
  runId: string,
  runSessionId: string
): Promise<SessionRosterRow[]> {
  const svc = await createServiceClient();

  const [{ data: enrollments }, { data: attendance }] = await Promise.all([
    svc
      .from("enrollments")
      .select("id, person_id, application_id, status")
      .eq("run_id", runId)
      .neq("status", "dropped")
      .order("joined_at", { ascending: true }),
    svc
      .from("attendance")
      .select("enrollment_id, present")
      .eq("run_session_id", runSessionId),
  ]);
  if (!enrollments || enrollments.length === 0) return [];

  const presentByEnrollment = new Map<string, boolean>(
    (attendance ?? []).map((a) => [a.enrollment_id, a.present])
  );

  // Names from the canonical identity spine (yi_directory.people).
  const personIds = [...new Set(enrollments.map((e) => e.person_id))];
  const dir = await createDirService();
  const { data: people } = await dir
    .schema("yi_directory")
    .from("people")
    .select("id, full_name")
    .in("id", personIds);
  const nameByPersonId = new Map<string, string>(
    (people ?? []).map((p) => [p.id, p.full_name ?? "—"])
  );

  // Institution display via the source application (when applied via form).
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

  const rows = enrollments.map((e) => ({
    enrollment_id: e.id,
    person_id: e.person_id,
    full_name: nameByPersonId.get(e.person_id) ?? "—",
    institution_name: e.application_id
      ? (institutionByApplication.get(e.application_id) ?? null)
      : null,
    present: presentByEnrollment.get(e.id) ?? null,
  }));

  return rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
}
