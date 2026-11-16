import type { EvaluatorRow, ModerationVersionRow } from "./types";

/**
 * Attendance at the Stage 2 meeting (Piyush, 16 Nov 2026 07:52: "for stage 2
 * can we add checkboxes for attendance ... NMT and RM name and also add an
 * NEM box. The NMT checks all this before submission. And this data is
 * reflected in the report for that vertical.").
 *
 * Stored on the moderation version (recognitions_09, column `attendance`),
 * so it is frozen with the ranking when the version is submitted. NULL on a
 * version means "not recorded" (every version saved before this feature);
 * `nobody: true` is the leader's explicit "nobody attended".
 *
 * Pure and client-safe: no database access here (names are fetched in
 * attendance-data.ts).
 */

/** The extra box. Its meaning is being confirmed with Piyush: rename it here only. */
export const NEM_LABEL = "NEM";

export type Attendance = {
  /** recognition_evaluators.id of every duty whose holder attended. */
  evaluator_ids: string[];
  /** The NEM box. */
  nem: boolean;
  /** The leader confirmed that nobody attended. Never true together with a tick. */
  nobody: boolean;
};

/** One checkbox: one person, even when they hold two duties (an RM for two regions, recognitions_07). */
export type AttendanceOption = {
  key: string;
  evaluatorIds: string[];
  name: string;
  /** "NMT leader", "NMT", "RM ER", "RM ER, NER", "NMT · RM SR". */
  role: string;
};

const RANK = { leader: 0, nmt: 1, rm: 2 } as const;

/** Group duties by person; leader first, then NMT, then RMs by region, then by name. */
export function attendanceOptions(duties: EvaluatorRow[], nameOf: (personId: string) => string): AttendanceOption[] {
  const byPerson = new Map<string, EvaluatorRow[]>();
  for (const d of duties) byPerson.set(d.person_id, [...(byPerson.get(d.person_id) ?? []), d]);
  const rows = [...byPerson.entries()].map(([personId, ds]) => {
    const nmt = ds.find((d) => d.layer === "nmt");
    const regions = ds
      .filter((d) => d.layer === "rm")
      .map((d) => (d.region ?? "").trim())
      .sort((a, b) => a.localeCompare(b));
    const parts: string[] = [];
    if (nmt) parts.push(nmt.is_nmt_leader ? "NMT leader" : "NMT");
    if (regions.length > 0) {
      const named = regions.filter((r) => r !== "");
      parts.push(named.length > 0 ? `RM ${named.join(", ")}` : "RM (no region)");
    }
    const rank = nmt ? (nmt.is_nmt_leader ? RANK.leader : RANK.nmt) : RANK.rm;
    return {
      rank,
      region: regions[0] ?? "",
      option: {
        key: personId,
        evaluatorIds: ds.map((d) => d.id).sort(),
        name: nameOf(personId).trim() || "Unknown person",
        role: parts.join(" · "),
      },
    };
  });
  rows.sort((a, b) => a.rank - b.rank || a.region.localeCompare(b.region) || a.option.name.localeCompare(b.option.name));
  return rows.map((r) => r.option);
}

/** Read a stored value defensively (the column is jsonb). Anything unreadable is "not recorded". */
export function readAttendance(raw: unknown): Attendance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const ids = Array.isArray(r.evaluator_ids) ? r.evaluator_ids.filter((x): x is string => typeof x === "string") : [];
  return { evaluator_ids: ids, nem: r.nem === true, nobody: r.nobody === true };
}

/**
 * A saved draft's attendance, trimmed to the award's ACTIVE duties, for the
 * form's starting state: a tick for an evaluator removed since would have no
 * box and the server would refuse every save.
 */
export function draftAttendance(raw: unknown, activeDutyIds: Set<string>): Attendance | null {
  const a = readAttendance(raw);
  return a ? { ...a, evaluator_ids: a.evaluator_ids.filter((id) => activeDutyIds.has(id)) } : null;
}

/** True once the leader has said who attended: at least one box (NEM counts), or "nobody attended". */
export function attendanceConfirmed(a: Attendance | null): boolean {
  if (!a) return false;
  return a.nobody || a.nem || a.evaluator_ids.length > 0;
}

export const ATTENDANCE_REQUIRED =
  "Attendance at the Stage 2 meeting: tick everyone who attended, or choose \"Nobody attended\", before you submit.";

/**
 * Server check of what the form sent. `undefined` means the form sent no
 * attendance (an older open tab): a draft then keeps what is saved, a submit
 * is refused. Ids must belong to the award's active duties.
 */
export function checkAttendance(
  input: unknown,
  activeDutyIds: Set<string>,
  submit: boolean
): { ok: true; value: Attendance | undefined } | { ok: false; error: string } {
  if (input === undefined || input === null) {
    return submit ? { ok: false, error: ATTENDANCE_REQUIRED } : { ok: true, value: undefined };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "The attendance list arrived damaged. Reload the page and try again." };
  }
  const r = input as Record<string, unknown>;
  if (!Array.isArray(r.evaluator_ids) || r.evaluator_ids.some((x) => typeof x !== "string")) {
    return { ok: false, error: "The attendance list arrived damaged. Reload the page and try again." };
  }
  const ids = [...new Set(r.evaluator_ids as string[])];
  if (ids.some((id) => !activeDutyIds.has(id))) {
    return {
      ok: false,
      error: "The evaluator list for this recognition changed since the page loaded. Reload the page and tick the attendance again.",
    };
  }
  const value: Attendance = { evaluator_ids: ids.sort(), nem: r.nem === true, nobody: r.nobody === true };
  if (value.nobody && (value.nem || value.evaluator_ids.length > 0)) {
    return { ok: false, error: "Attendance: untick every box, or untick \"Nobody attended\". It can't be both." };
  }
  if (submit && !attendanceConfirmed(value)) return { ok: false, error: ATTENDANCE_REQUIRED };
  return { ok: true, value };
}

export type AttendanceLine = { name: string; role: string; attended: boolean };

/**
 * The read-only lines for a submitted version: every evaluator ticked (even
 * one removed since, so pass ALL duties incl. inactive) plus every active one
 * not ticked. The NEM box is reported separately.
 */
export function attendanceLines(
  a: Attendance,
  allDuties: EvaluatorRow[],
  nameOf: (personId: string) => string
): AttendanceLine[] {
  const ticked = new Set(a.evaluator_ids);
  const shown = allDuties.filter((d) => ticked.has(d.id) || d.is_active);
  const lines = attendanceOptions(shown, nameOf).map((o) => ({
    name: o.name,
    role: o.role,
    attended: o.evaluatorIds.some((id) => ticked.has(id)),
  }));
  // A ticked duty whose row was deleted since: still counted, without a name.
  const known = new Set(allDuties.map((d) => d.id));
  for (const id of a.evaluator_ids) {
    if (!known.has(id)) lines.push({ name: "An evaluator since removed", role: "", attended: true });
  }
  return lines;
}

/**
 * The "Attendance" section of the vertical report (one sheet per
 * recognition), from the same submitted version as the final ranks. Pass
 * ALL duties (incl. removed) so an old tick keeps its name.
 */
export function attendanceReportRows(
  version: Pick<ModerationVersionRow, "version" | "attendance"> | null,
  allDuties: EvaluatorRow[],
  nameOf: (personId: string) => string
): Array<Array<string | number | null>> {
  const head = ["Attendance at the Stage 2 meeting"];
  if (!version) return [[...head, "No submitted moderation yet"]];
  const a = readAttendance(version.attendance);
  if (!a) return [[...head, `Not recorded (version ${version.version} was submitted before attendance was added)`]];
  if (a.nobody) return [[...head, `Version ${version.version}: nobody attended`]];
  return [
    [...head, `Version ${version.version}, as the NMT leader confirmed`],
    ["Name", "Role", "Attended"],
    ...attendanceLines(a, allDuties, nameOf).map((l) => [l.name, l.role, l.attended ? "Yes" : "No"]),
    [NEM_LABEL, "", a.nem ? "Yes" : "No"],
  ];
}
