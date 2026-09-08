"use server";

/**
 * "Who has NO mark?" — the absence-of-a-mark read.
 *
 * At the SRTN Regional Round (28/29 August 2026) 196 students sat the round,
 * 817 marks were saved, and 28 students went home with no submitted mark at
 * all. Nobody could see that while the round was running, and by the time
 * results were computed the judges had left. Director ruling 08: unmarked
 * students are surfaced TWICE — organisers are warned during the round while a
 * juror can still be sent, and any student who ends up unmarked is listed in
 * the results as "not marked" rather than quietly omitted.
 *
 * ─── WHY THIS IS NOT A NEW SCORING SURFACE ─────────────────────────────────
 * The existing signal (scoring-progress.tsx already computes an `unscoredCount`
 * and has a "Not scored yet" filter) lives behind `canViewScores`, which
 * lib/yip/auth/event-access.ts documents as SUPER-ADMIN ONLY, deliberately, to
 * protect named minor students' marks. Chapter chairs, chapter organisers and
 * regional admins all get `canViewScores: false` — so at Vizag, Ajmer and
 * Mysuru every person standing in the chamber who could actually send a second
 * judge is 403'd off that page. The signal exists and is unreachable.
 *
 * This read is therefore gated on `canManage`, and returns ONLY the ABSENCE of
 * a mark: names, school, constituency, whether the student checked in, and
 * which sessions have a gap. No score, mark, total, average, rank, or count of
 * marks, and nothing from which one could be inferred. Absence of a score is
 * not a score — exactly the reasoning already accepted for getMarkingCoverage
 * in app/yip/actions/results.ts (Director, 2026-08-19), and the same shape as
 * app/yip/actions/participant-submissions.ts, where an organiser sees status
 * ("Not handed in yet" / "Marked") and never the number. `canViewScores` is
 * NOT widened here and must never be, and nothing below may select a score
 * column.
 *
 * ─── WHY IT DOES NOT USE getScoringProgress ────────────────────────────────
 * getScoringProgress() builds a per-participant × per-session matrix and is
 * documented (above getResultsFreshness) as exactly the thing that times out on
 * heavy events. This is six cheap reads, all paged — see lib/pagination.ts:
 * PostgREST silently caps a response at ~1000 rows and a `.limit()` can only
 * LOWER that cap, never raise it.
 *
 * ─── WHY IT CHANGES NOTHING ────────────────────────────────────────────────
 * Read-only. It writes nothing, and in particular it does NOT make
 * computeResults() start emitting rows for unmarked students — a hard rubric
 * freeze is in force until 8 September 2026. The "not marked" list for the
 * results surface is derived at READ time (participants minus participants who
 * have a results row) as pure presentation. Zero engine change.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { fetchAllRows } from "@/lib/pagination";

/** One student with no mark, and whether they were actually in the building. */
export type UnmarkedStudent = {
  participantId: string;
  participantName: string;
  schoolName: string | null;
  constituencyName: string | null;
  /**
   * Plain English, worded to match the "Not ranked — absent Day 2" reasons
   * computeResults() already writes (app/yip/actions/results.ts), so the same
   * student reads the same way in both places.
   */
  presenceLabel: string;
  /**
   * Checked in on at least one day. This is the line that matters live: a
   * student who is in the chamber can still have a judge sent to them, one who
   * never arrived cannot.
   */
  wasPresent: boolean;
};

/** One session of the running order that has students with no mark. */
export type UnmarkedSessionGap = {
  agendaItemId: string;
  /** e.g. "Day 1: Question Hour". */
  label: string;
  /**
   * The session has run (or is running) and not one mark was saved for it.
   * Reported even when no speaking list exists, because "a whole session went
   * unmarked" needs no denominator to be true.
   */
  noMarksAtAll: boolean;
  /** Students on this session's speaking list. */
  listed: number;
  /** ...of whom this many have no submitted mark for this session. */
  unmarked: number;
  students: UnmarkedStudent[];
};

export type UnmarkedStudents = {
  totalParticipants: number;
  /** Students with no submitted mark ANYWHERE in this event. */
  noMarkAtAll: UnmarkedStudent[];
  /** Sessions that have already run and still have gaps. */
  sessions: UnmarkedSessionGap[];
  /**
   * Students the results snapshot has no row for — the half of ruling 08 that
   * belongs on the results surface. Empty while `resultsComputed` is false.
   */
  notInResults: UnmarkedStudent[];
  /** Whether results have ever been computed for this event. */
  resultsComputed: boolean;
  /**
   * Set when a read failed or came back short, so this panel CANNOT be trusted.
   * Same discipline as getMarkingCoverage: a short read makes students look
   * unmarked when they were marked, and an empty panel reads as "all clear",
   * which is the precise failure this feature exists to prevent.
   */
  couldNotCheck: string | null;
};

type ParticipantRow = {
  id: string;
  full_name: string | null;
  school_name: string | null;
  constituency_name: string | null;
  checked_in_day1: boolean | null;
  checked_in_day2: boolean | null;
};

/**
 * Wording mirrors the notRankedReason strings in app/yip/actions/results.ts
 * (~line 1040). Strict === true, as there: a null day flag is treated as "not
 * checked in", never as present.
 */
function presenceOf(p: ParticipantRow): {
  presenceLabel: string;
  wasPresent: boolean;
} {
  const d1 = p.checked_in_day1 === true;
  const d2 = p.checked_in_day2 === true;
  if (d1 && d2) return { presenceLabel: "In the House both days", wasPresent: true };
  if (d1) return { presenceLabel: "Absent Day 2", wasPresent: true };
  if (d2) return { presenceLabel: "Absent Day 1", wasPresent: true };
  return { presenceLabel: "Never checked in", wasPresent: false };
}

function toStudent(p: ParticipantRow): UnmarkedStudent {
  const { presenceLabel, wasPresent } = presenceOf(p);
  return {
    participantId: p.id,
    participantName: p.full_name ?? "Unnamed student",
    schoolName: p.school_name,
    constituencyName: p.constituency_name,
    presenceLabel,
    wasPresent,
  };
}

const byName = (a: UnmarkedStudent, b: UnmarkedStudent) =>
  a.participantName.localeCompare(b.participantName);

/**
 * Which students of this event have no submitted mark — overall, and per
 * session of the running order that has already run.
 *
 * Gated on `canManage` and fails CLOSED (null) for everyone else, so a juror or
 * a participant can never read another student's marking picture. See the
 * SCORES note at the top of this file before changing that gate.
 */
export async function getUnmarkedStudents(
  eventId: string
): Promise<UnmarkedStudents | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return null;

  const supabase = await createServiceClient();

  // fetchAllRows() returns whatever it collected BEFORE an error, silently. Ask
  // each table for its exact row count first and compare afterwards — that is
  // the only way to tell a complete read from a truncated one.
  const [participantCountRes, scoreCountRes] = await Promise.all([
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "submitted"),
  ]);

  const [{ data: agendaRows, error: agendaErr }, participantRows, scoreRows, resultRows] =
    await Promise.all([
      supabase
        .from("agenda")
        .select("id, title, day, sequence_order, session_key, agenda_type, is_scoreable, status, actual_start")
        .eq("event_id", eventId),
      // Bounded per event (a round seats a few hundred students), but paged
      // anyway — a plain select is silently capped by PostgREST.
      fetchAllRows<ParticipantRow>((from, to) =>
        supabase
          .from("participants")
          .select(
            "id, full_name, school_name, constituency_name, checked_in_day1, checked_in_day2"
          )
          .eq("event_id", eventId)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: ParticipantRow[] | null;
          error: unknown;
        }>
      ),
      // TWO columns only — who was marked, and in which session. Never a score
      // column: this payload must stay incapable of revealing a mark.
      fetchAllRows<{ participant_id: string; agenda_item_id: string | null }>(
        (from, to) =>
          supabase
            .from("scores")
            .select("participant_id, agenda_item_id")
            .eq("event_id", eventId)
            .eq("status", "submitted")
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<{
            data: { participant_id: string; agenda_item_id: string | null }[] | null;
            error: unknown;
          }>
      ),
      // Presence of a row only — no rank, no average, no award.
      fetchAllRows<{ participant_id: string }>((from, to) =>
        supabase
          .from("results")
          .select("participant_id")
          .eq("event_id", eventId)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: { participant_id: string }[] | null;
          error: unknown;
        }>
      ),
    ]);

  // Did we actually see everything? Any "no" makes the panel untrustworthy.
  let couldNotCheck: string | null = null;
  if (agendaErr) {
    couldNotCheck =
      "The running order could not be read, so unmarked students cannot be checked.";
  } else if (participantCountRes.error || scoreCountRes.error) {
    couldNotCheck =
      "The roster or the marks could not be counted, so unmarked students cannot be checked.";
  } else if (
    typeof participantCountRes.count === "number" &&
    participantRows.length !== participantCountRes.count
  ) {
    couldNotCheck = `Only ${participantRows.length} of ${participantCountRes.count} students could be read, so unmarked students cannot be checked.`;
  } else if (
    typeof scoreCountRes.count === "number" &&
    scoreRows.length !== scoreCountRes.count
  ) {
    couldNotCheck = `Only ${scoreRows.length} of ${scoreCountRes.count} marks could be read, so unmarked students cannot be checked.`;
  }
  if (couldNotCheck) {
    return {
      totalParticipants: participantCountRes.count ?? 0,
      noMarkAtAll: [],
      sessions: [],
      notInResults: [],
      resultsComputed: false,
      couldNotCheck,
    };
  }

  const personById = new Map(participantRows.map((p) => [p.id, p]));

  // ─── Overall: no submitted mark anywhere ────────────────────────────────
  const markedAnywhere = new Set(scoreRows.map((s) => s.participant_id));
  const noMarkAtAll = participantRows
    .filter((p) => !markedAnywhere.has(p.id))
    .map(toStudent)
    .sort(byName);

  // ─── Results snapshot: who it has no row for (ruling 08, second half) ────
  // Derived here at READ time. computeResults() is untouched and still writes
  // no row for these students — this only stops them being silently omitted.
  const inResults = new Set(resultRows.map((r) => r.participant_id));
  const resultsComputed = resultRows.length > 0;
  const notInResults = resultsComputed
    ? participantRows
        .filter((p) => !inResults.has(p.id))
        .map(toStudent)
        .sort(byName)
    : [];

  // ─── Per session of the running order ───────────────────────────────────
  // Only sessions that are BOTH scoreable and have actually run. An `upcoming`
  // session has not happened yet and a `skipped` one deliberately never will —
  // flagging either would fill the live panel with alarm nobody can act on, and
  // a panel that cries wolf gets ignored on the day it is right.
  const startedScoreable = (agendaRows ?? [])
    .filter(
      (a) =>
        a.is_scoreable === true &&
        (a.status === "in_progress" ||
          a.status === "completed" ||
          a.actual_start !== null)
    )
    .sort(
      (x, y) =>
        (x.day ?? 0) - (y.day ?? 0) ||
        (x.sequence_order ?? 0) - (y.sequence_order ?? 0)
    );

  const sessionIds = startedScoreable.map((a) => a.id);

  // Who is on each session's speaking list. This is the only defensible
  // denominator for "should have been marked": committee sessions legitimately
  // mark students who never appear on a speaking list (Committee Reports I at
  // SRTN marked 100 students against 87 listed), so the reverse — claiming an
  // unlisted student is missing a mark — would be a false accusation. Sessions
  // with no speaking list therefore report only the noMarksAtAll fact.
  const speakerRows =
    sessionIds.length > 0
      ? await fetchAllRows<{ agenda_item_id: string; participant_id: string }>(
          (from, to) =>
            supabase
              .from("agenda_speakers")
              .select("agenda_item_id, participant_id")
              .in("agenda_item_id", sessionIds)
              .order("id", { ascending: true })
              .range(from, to) as unknown as PromiseLike<{
              data: { agenda_item_id: string; participant_id: string }[] | null;
              error: unknown;
            }>
        )
      : [];

  const listedBySession = new Map<string, Set<string>>();
  for (const r of speakerRows) {
    let set = listedBySession.get(r.agenda_item_id);
    if (!set) {
      set = new Set();
      listedBySession.set(r.agenda_item_id, set);
    }
    set.add(r.participant_id);
  }

  const markedBySession = new Map<string, Set<string>>();
  for (const s of scoreRows) {
    if (!s.agenda_item_id) continue;
    let set = markedBySession.get(s.agenda_item_id);
    if (!set) {
      set = new Set();
      markedBySession.set(s.agenda_item_id, set);
    }
    set.add(s.participant_id);
  }

  const sessions: UnmarkedSessionGap[] = [];
  for (const a of startedScoreable) {
    const name =
      a.title?.trim() || a.session_key || a.agenda_type || "Session";
    const label = a.day ? `Day ${a.day}: ${name}` : name;
    const marked = markedBySession.get(a.id) ?? new Set<string>();
    const listed = listedBySession.get(a.id) ?? new Set<string>();

    const students = Array.from(listed)
      .filter((pid) => !marked.has(pid))
      .map((pid) => personById.get(pid))
      .filter((p): p is ParticipantRow => !!p)
      .map(toStudent)
      .sort(byName);

    const noMarksAtAll = marked.size === 0;
    if (!noMarksAtAll && students.length === 0) continue;

    sessions.push({
      agendaItemId: a.id,
      label,
      noMarksAtAll,
      listed: listed.size,
      unmarked: students.length,
      students,
    });
  }

  return {
    totalParticipants: participantCountRes.count ?? participantRows.length,
    noMarkAtAll,
    sessions,
    notInResults,
    resultsComputed,
    couldNotCheck: null,
  };
}
