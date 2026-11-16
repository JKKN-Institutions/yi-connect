import "server-only";

import { getPeople, listEvaluators } from "./data";
import { attendanceLines, attendanceOptions, readAttendance, type Attendance, type AttendanceLine, type AttendanceOption } from "./attendance";
import type { EvaluatorRow, ModerationVersionRow } from "./types";

/** The leader's form: one checkbox per active evaluator (by name), and what the open draft already holds. */
export async function attendanceFormData(
  activeDuties: EvaluatorRow[],
  draft: ModerationVersionRow | null
): Promise<{ options: AttendanceOption[]; initial: Attendance | null }> {
  const people = await getPeople(activeDuties.map((d) => d.person_id));
  return {
    options: attendanceOptions(activeDuties, (id) => people.get(id)?.full_name ?? ""),
    initial: draft ? readAttendance(draft.attendance) : null,
  };
}

export type AttendanceSummary =
  | { recorded: false }
  | { recorded: true; nobody: boolean; nem: boolean; lines: AttendanceLine[] };

/**
 * A SUBMITTED version's attendance, by name. Callers pass the version they
 * already show (latestSubmittedVersion), never a draft. Removed evaluators are
 * looked up too, so a tick survives their removal.
 */
export async function attendanceSummary(awardId: string, version: ModerationVersionRow): Promise<AttendanceSummary> {
  const a = readAttendance(version.attendance);
  if (!a) return { recorded: false };
  const all = await listEvaluators(awardId, true);
  const people = await getPeople(all.map((d) => d.person_id));
  return {
    recorded: true,
    nobody: a.nobody,
    nem: a.nem,
    lines: attendanceLines(a, all, (id) => people.get(id)?.full_name ?? ""),
  };
}
