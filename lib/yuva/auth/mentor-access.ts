/**
 * Yi Youth Academy mentor access (Phase 2).
 *
 * Mentors are OAuth staff role-holders (app='yuva', role='mentor' in
 * yi_directory) — unlike Yi-Future's cookie-session mentors. Their access is
 * SESSION-SCOPED: a mentor may act only on run sessions where
 * yuva.run_sessions.mentor_person_id equals their funnel person_id (and, at
 * run level, on runs containing at least one such session). Run managers
 * (getYuvaAccess().canManageRun — national / owning chapter / bound
 * coordinator) always pass too.
 *
 * Fail closed: missing ids, missing rows, unauthenticated, or any lookup
 * error ⇒ deny with an explicit reason (never a silent redirect — render
 * Forbidden403 or return { success:false } at the call site).
 */
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { getYuvaAccess } from "./yuva-access";

export type YuvaMentorAccess =
  | { ok: true; via: "mentor" | "manager"; personId: string }
  | { ok: false; reason: string };

/**
 * Can the current user act on this run session (materials, attendance,
 * per-session work review)? Assigned mentor OR run manager.
 */
export async function getMentorSessionAccess(
  runSessionId: string
): Promise<YuvaMentorAccess> {
  if (!runSessionId) {
    return { ok: false, reason: "No session id supplied — denied." };
  }

  const svc = await createServiceClient();
  const { data: session, error } = await svc
    .from("run_sessions")
    .select("id, mentor_person_id, run_id, runs ( id, chapter, academy_id )")
    .eq("id", runSessionId)
    .maybeSingle();

  if (error || !session) {
    return { ok: false, reason: "Session not found — denied." };
  }

  // Path 1: the assigned mentor (funnel person match — canonical identity).
  const me = await getCurrentPersonRoles();
  if (
    me &&
    session.mentor_person_id &&
    session.mentor_person_id === me.person_id
  ) {
    return { ok: true, via: "mentor", personId: me.person_id };
  }

  // Path 2: run managers (national / owning chapter / bound coordinator).
  const run = session.runs;
  if (run) {
    const access = await getYuvaAccess();
    if (
      access.personId &&
      access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
    ) {
      return { ok: true, via: "manager", personId: access.personId };
    }
    return {
      ok: false,
      reason: `Not the assigned mentor for this session and no run-management scope (${access.reason}).`,
    };
  }

  return { ok: false, reason: "Session has no parent run — denied." };
}

/**
 * Can the current user act on this run as a whole (cohort roster, messages,
 * submissions queue)? Mentor assigned to ANY of the run's sessions OR run
 * manager.
 */
export async function getMentorRunAccess(
  runId: string
): Promise<YuvaMentorAccess> {
  if (!runId) {
    return { ok: false, reason: "No run id supplied — denied." };
  }

  const svc = await createServiceClient();
  const { data: run, error } = await svc
    .from("runs")
    .select("id, chapter, academy_id")
    .eq("id", runId)
    .maybeSingle();

  if (error || !run) {
    return { ok: false, reason: "Run not found — denied." };
  }

  // Path 1: mentor assigned to at least one session of this run.
  const me = await getCurrentPersonRoles();
  if (me) {
    const { data: assigned, error: assignedErr } = await svc
      .from("run_sessions")
      .select("id")
      .eq("run_id", runId)
      .eq("mentor_person_id", me.person_id)
      .limit(1);
    if (!assignedErr && (assigned ?? []).length > 0) {
      return { ok: true, via: "mentor", personId: me.person_id };
    }
  }

  // Path 2: run managers.
  const access = await getYuvaAccess();
  if (
    access.personId &&
    access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return { ok: true, via: "manager", personId: access.personId };
  }

  return {
    ok: false,
    reason: `No session in this run is assigned to you and no run-management scope (${access.reason}).`,
  };
}
