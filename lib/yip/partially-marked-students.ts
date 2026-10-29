"use server";

/**
 * "Marked in some sessions, missing in others" — the second half of the
 * Control page's STILL TO BE MARKED box.
 *
 * getUnmarkedStudents (app/yip/actions/unmarked-students.ts) only catches a
 * student with NO mark at all. A student marked in just ONE scored session is
 * averaged over that session alone, so they can rank above students marked all
 * day (National Finals rehearsal, Oct 2026: a student marked once ranked 6th of
 * 126). This read lists checked-in students who have a mark in at least one
 * scored session that has run, but are missing from another one.
 *
 * National Finals only (returns an empty list for any other level).
 *
 * Same privacy shape as getUnmarkedStudents: gated on canManage, returns only
 * the ABSENCE of a mark (seat, name, which sessions are missing) — never a
 * score, total, average, rank or count of marks. Read-only; a warning, never a
 * block.
 *
 * A session only counts as "missing" for a student when at least one OTHER
 * student with the SAME parliament_role was marked in it. That keeps house
 * officials (Speaker, Deputy Speaker, journalist, administrator) and any role
 * the session's sheet does not cover out of the list, without hard-coding
 * which sheet covers which role. A session also only counts for a student who
 * checked in on that session's day — an absent student cannot be marked.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { fetchAllRows } from "@/lib/pagination";

export type PartiallyMarkedStudent = {
  participantId: string;
  participantName: string;
  /** Seat number (participants.serial_no). */
  seat: number | null;
  /** e.g. "Day 1: Question Hour". */
  missingSessions: string[];
};

export type PartiallyMarkedStudents = {
  students: PartiallyMarkedStudent[];
  /** Set when a read failed or came back short — the list cannot be trusted. */
  couldNotCheck: string | null;
};

type ParticipantRow = {
  id: string;
  full_name: string | null;
  serial_no: number | null;
  parliament_role: string | null;
  checked_in_day1: boolean | null;
  checked_in_day2: boolean | null;
};

export async function getPartiallyMarkedStudents(
  eventId: string
): Promise<PartiallyMarkedStudents | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return null;

  const supabase = await createServiceClient();

  // NATIONAL FINALS ONLY. At chapter and regional rounds only the speakers are
  // marked in a session by design, so this rule flags ~85–90% of the House
  // (measured on the three biggest past rounds) — pure noise there.
  const { data: ev } = await supabase
    .from("events")
    .select("level")
    .eq("id", eventId)
    .maybeSingle();
  if (ev?.level !== "national") return { students: [], couldNotCheck: null };

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

  const [{ data: agendaRows, error: agendaErr }, participantRows, scoreRows] =
    await Promise.all([
      supabase
        .from("agenda")
        .select("id, title, day, sequence_order, session_key, agenda_type, is_scoreable, status")
        .eq("event_id", eventId),
      fetchAllRows<ParticipantRow>((from, to) =>
        supabase
          .from("participants")
          .select(
            "id, full_name, serial_no, parliament_role, checked_in_day1, checked_in_day2"
          )
          .eq("event_id", eventId)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: ParticipantRow[] | null;
          error: unknown;
        }>
      ),
      // Who was marked, and in which session. Never a score column.
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
    ]);

  const fail = (couldNotCheck: string): PartiallyMarkedStudents => ({
    students: [],
    couldNotCheck,
  });
  if (agendaErr) {
    return fail("The running order could not be read, so part-marked students cannot be checked.");
  }
  if (participantCountRes.error || scoreCountRes.error) {
    return fail("The roster or the marks could not be counted, so part-marked students cannot be checked.");
  }
  if (
    typeof participantCountRes.count === "number" &&
    participantRows.length < participantCountRes.count
  ) {
    return fail(
      `Only ${participantRows.length} of ${participantCountRes.count} students could be read, so part-marked students cannot be checked.`
    );
  }
  if (
    typeof scoreCountRes.count === "number" &&
    scoreRows.length < scoreCountRes.count
  ) {
    return fail(
      `Only ${scoreRows.length} of ${scoreCountRes.count} marks could be read, so part-marked students cannot be checked.`
    );
  }

  // Scored sessions that have already happened (or are happening now).
  const sessions = (agendaRows ?? [])
    .filter(
      (a) =>
        a.is_scoreable === true &&
        (a.status === "completed" || a.status === "in_progress")
    )
    .sort(
      (x, y) =>
        (x.day ?? 0) - (y.day ?? 0) ||
        (x.sequence_order ?? 0) - (y.sequence_order ?? 0)
    );
  if (sessions.length < 2) return { students: [], couldNotCheck: null };

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

  const personById = new Map(participantRows.map((p) => [p.id, p]));

  // For each session, the parliament_roles that someone was marked in.
  const rolesMarkedBySession = new Map<string, Map<string, number>>();
  for (const a of sessions) {
    const roles = new Map<string, number>();
    for (const pid of markedBySession.get(a.id) ?? []) {
      const role = personById.get(pid)?.parliament_role ?? "";
      roles.set(role, (roles.get(role) ?? 0) + 1);
    }
    rolesMarkedBySession.set(a.id, roles);
  }

  const presentOnDay = (p: ParticipantRow, day: number | null) =>
    day === 1
      ? p.checked_in_day1 === true
      : day === 2
        ? p.checked_in_day2 === true
        : p.checked_in_day1 === true || p.checked_in_day2 === true;

  const students: PartiallyMarkedStudent[] = [];
  for (const p of participantRows) {
    const role = p.parliament_role ?? "";
    let markedIn = 0;
    const missing: string[] = [];
    for (const a of sessions) {
      const marked = markedBySession.get(a.id);
      if (marked?.has(p.id)) {
        markedIn++;
        continue;
      }
      if (!presentOnDay(p, a.day)) continue;
      // Another student with the same role was marked here → this session's
      // sheet covers the role, so this student should have a mark too.
      if ((rolesMarkedBySession.get(a.id)?.get(role) ?? 0) === 0) continue;
      const name = a.title?.trim() || a.session_key || a.agenda_type || "Session";
      missing.push(a.day ? `Day ${a.day}: ${name}` : name);
    }
    // No mark at all is the other warning in this box — only part-marked here.
    if (markedIn > 0 && missing.length > 0) {
      students.push({
        participantId: p.id,
        participantName: p.full_name ?? "Unnamed student",
        seat: p.serial_no,
        missingSessions: missing,
      });
    }
  }

  students.sort(
    (a, b) =>
      (a.seat ?? Number.MAX_SAFE_INTEGER) - (b.seat ?? Number.MAX_SAFE_INTEGER) ||
      a.participantName.localeCompare(b.participantName)
  );

  return { students, couldNotCheck: null };
}
