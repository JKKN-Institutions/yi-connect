/**
 * NATIONAL ATTENDANCE EXPORT — every delegate, every chapter, one CSV.
 *
 * Built 2026-08-05 for national reporting: the per-event roster download only
 * ever covered one round, so producing a country-wide attendance return meant
 * downloading 30+ files and pasting them together by hand.
 *
 * The build lives here (not in the action) so it can be exercised directly
 * against the live database without minting a super-admin session. The action
 * in app/yip/actions/national-attendance-export.ts is the thin gated wrapper:
 * requireSuperAdmin → service client → this function.
 *
 * PRIVACY: names + school + attendance only. Phone, parent phone, email and
 * access code are deliberately OUT — this file is meant to be emailed onward,
 * and YIP already runs a DPDP privacy mode. Keep it that way; adding contact
 * columns here turns a reporting sheet into a 3,000-student contact leak.
 *
 * Demo/mock rows (is_mock on either the event or the participant) are excluded
 * so national numbers never include test data.
 */
import { fetchAllRows } from "@/lib/pagination";
import { checkInLabel, formatCheckInTime, toCsv } from "@/lib/yip/attendance-csv";

export interface NationalAttendanceExport {
  filename: string;
  csv: string;
  /** Delegate rows in the file. */
  count: number;
  /** Distinct real events represented. */
  eventCount: number;
  /** Distinct named chapters represented. */
  chapterCount: number;
  /**
   * Rows whose event carries no chapter name — they can't be reported against
   * a chapter, so they're sorted to the bottom and counted here rather than
   * silently dropped. As of 2026-08-05 this is the "DEMO — Allocated Roster
   * Upload (173)" event, which is demo data that was never flagged is_mock.
   * Surfaced so the number is visible instead of quietly inflating the total.
   */
  unassignedCount: number;
}

type EventRow = {
  id: string;
  name: string | null;
  chapter_name: string | null;
  zone: string | null;
  yi_zone_code: string | null;
  status: string | null;
  day1_date: string | null;
  day2_date: string | null;
  is_mock: boolean | null;
};

type ParticipantRow = {
  event_id: string;
  full_name: string | null;
  school_name: string | null;
  class: string | null;
  constituency_number: number | null;
  checked_in_day1: boolean | null;
  checked_in_day1_at: string | null;
  checked_in_day2: boolean | null;
  checked_in_day2_at: string | null;
  is_mock: boolean | null;
};

/**
 * Minimal shape this needs from a Supabase client — keeps the module testable
 * (a plain service client from a script satisfies it).
 *
 * Callers pass the real client through `as unknown as AttendanceQueryable`.
 * Matching it structurally makes tsc unify against Supabase's deeply generic
 * query builder and blow the instantiation depth limit (TS2589) — the same
 * reason the `.range(...) as unknown as PromiseLike<...>` casts below and
 * across app/yip/actions/* exist.
 */
export type AttendanceQueryable = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (
        col: string,
        opts: { ascending: boolean }
      ) => { range: (from: number, to: number) => PromiseLike<unknown> };
      in: (
        col: string,
        vals: string[]
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean }
        ) => { range: (from: number, to: number) => PromiseLike<unknown> };
      };
    };
  };
};

export const EVENT_COLS =
  "id, name, chapter_name, zone, yi_zone_code, status, day1_date, day2_date, is_mock";

export const PARTICIPANT_COLS =
  "event_id, full_name, school_name, class, constituency_number, " +
  "checked_in_day1, checked_in_day1_at, checked_in_day2, checked_in_day2_at, is_mock";

export const ATTENDANCE_HEADERS = [
  "Zone",
  "Chapter",
  "Event",
  "Event Status",
  "Day 1 Date",
  "Day 2 Date",
  "Student Name",
  "School",
  "Class",
  "Constituency No.",
  "Day 1 Check-In",
  "Day 1 Check-In Time",
  "Day 2 Check-In",
  "Day 2 Check-In Time",
  "Attended (Either Day)",
];

/**
 * Build the all-chapter attendance CSV. Read-only; re-runnable any time.
 *
 * `service` must be a service-role client (this reads across every chapter, so
 * it deliberately bypasses per-event RLS). Callers MUST gate first.
 */
export async function buildNationalAttendanceCsv(
  service: AttendanceQueryable,
  now: Date = new Date()
): Promise<
  { success: true; data: NationalAttendanceExport } | { success: false; error: string }
> {
  // Page events too — ~31 real rounds today, but the season scales and a bare
  // select silently truncates at ~1000 (lib/pagination).
  const eventRows = await fetchAllRows<EventRow>(
    (from, to) =>
      service
        .from("events")
        .select(EVENT_COLS)
        .order("id", { ascending: true })
        .range(from, to) as PromiseLike<{ data: EventRow[] | null; error: unknown }>
  );

  const events = eventRows.filter((e) => e.is_mock !== true);
  if (events.length === 0) {
    return { success: false, error: "No real chapter rounds to export yet." };
  }
  const eventById = new Map(events.map((e) => [e.id, e]));

  // 3,000+ delegates nationally — at or past the ~1000-row PostgREST cap, so
  // this MUST page or the file silently stops a third of the way through.
  const participantRows = await fetchAllRows<ParticipantRow>(
    (from, to) =>
      service
        .from("participants")
        .select(PARTICIPANT_COLS)
        .in(
          "event_id",
          events.map((e) => e.id)
        )
        .order("id", { ascending: true })
        .range(from, to) as PromiseLike<{
        data: ParticipantRow[] | null;
        error: unknown;
      }>
  );

  const list = participantRows.filter(
    (p) => p.is_mock !== true && eventById.has(p.event_id)
  );

  if (list.length === 0) {
    return {
      success: false,
      error: "No delegates registered in any real chapter round yet.",
    };
  }

  const zoneOf = (e: EventRow | undefined) => e?.zone ?? e?.yi_zone_code ?? "";
  const chapterOf = (e: EventRow | undefined) => e?.chapter_name ?? "";

  // Zone → Chapter → Event → Constituency no. → Name, so the file reads the way
  // a national return is assembled (and the same student never moves between
  // downloads).
  //
  // Rows whose event has no chapter go LAST, not first. A blank sorts ahead of
  // every letter by default, which would put un-attributable rows at the top of
  // a chapter-wise report — the worst possible place. They are kept (never drop
  // a student silently) and counted in `unassignedCount` instead.
  const sorted = [...list].sort((a, b) => {
    const ea = eventById.get(a.event_id);
    const eb = eventById.get(b.event_id);
    const unA = chapterOf(ea) === "" ? 1 : 0;
    const unB = chapterOf(eb) === "" ? 1 : 0;
    return (
      unA - unB ||
      zoneOf(ea).localeCompare(zoneOf(eb)) ||
      chapterOf(ea).localeCompare(chapterOf(eb)) ||
      (ea?.name ?? "").localeCompare(eb?.name ?? "") ||
      (a.constituency_number ?? 0) - (b.constituency_number ?? 0) ||
      (a.full_name ?? "").localeCompare(b.full_name ?? "")
    );
  });

  const body = sorted.map((p) => {
    const ev = eventById.get(p.event_id);
    const attended = p.checked_in_day1 === true || p.checked_in_day2 === true;
    return [
      zoneOf(ev),
      chapterOf(ev),
      ev?.name ?? "",
      ev?.status ?? "",
      ev?.day1_date ?? "",
      ev?.day2_date ?? "",
      p.full_name ?? "",
      p.school_name ?? "",
      p.class ?? "",
      p.constituency_number ?? "",
      checkInLabel(p.checked_in_day1),
      formatCheckInTime(p.checked_in_day1_at),
      checkInLabel(p.checked_in_day2),
      formatCheckInTime(p.checked_in_day2_at),
      attended ? "Yes" : "No",
    ];
  });

  // Named chapters only — an event with no chapter_name is not an extra
  // chapter, so it must not be counted as one in the headline number.
  const chapterKeys = new Set(
    sorted.map((p) => chapterOf(eventById.get(p.event_id))).filter((c) => c !== "")
  );
  const eventKeys = new Set(sorted.map((p) => p.event_id));
  const unassignedCount = sorted.filter(
    (p) => chapterOf(eventById.get(p.event_id)) === ""
  ).length;

  // Date-stamped filename — attendance keeps changing while rounds run, so two
  // downloads a week apart must not look like the same file.
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return {
    success: true,
    data: {
      filename: `yip-national-attendance-${stamp}.csv`,
      csv: toCsv(ATTENDANCE_HEADERS, body),
      count: sorted.length,
      eventCount: eventKeys.size,
      chapterCount: chapterKeys.size,
      unassignedCount,
    },
  };
}
