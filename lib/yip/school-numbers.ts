import { createServiceClient } from "@/lib/yip/supabase/server";
import { fetchAllRows } from "@/lib/pagination";

/**
 * Per-event school → display-number map.
 *
 * `participants.school_name` is an OPAQUE seating-grouping key for the
 * allocation engine (lib/yip/allocation-engine.ts groups by
 * `school_name.toLowerCase()`). Participants must NOT see the school name on
 * their phones — they see a stable NUMBER instead (director decision
 * 2026-06-27). The number is a shared anonymised label: two delegates from the
 * same school see the same "School #N", so they can recognise same-school peers
 * (e.g. on the Speaker ballot) without any school being named.
 *
 * Numbering is by FIRST APPEARANCE — distinct schools ordered by the minimum
 * `serial_no` among their participants — so adding a delegate from a NEW school
 * later only ever appends the next-highest number and never renumbers an
 * existing school. Names are normalised (trim + lower) to match the allocation
 * engine's grouping, and so typo/casing variants of one school collapse to one
 * number. The map is computed per event from live data; nothing is stored.
 */
export async function getEventSchoolNumbers(
  eventId: string
): Promise<Map<string, number>> {
  const supabase = await createServiceClient();

  // Tiny rows (name + serial only); paginate so events with >1000 delegates
  // don't silently truncate the school set (lib/pagination row-cap rule).
  const rows = await fetchAllRows<{
    school_name: string | null;
    serial_no: number | null;
  }>((from, to) =>
    supabase
      .from("participants")
      .select("school_name, serial_no")
      .eq("event_id", eventId)
      .not("school_name", "is", null)
      .order("serial_no", { ascending: true })
      .range(from, to)
  );

  // norm school name -> earliest serial_no seen for it
  const firstSeen = new Map<string, number>();
  for (const r of rows) {
    const norm = (r.school_name ?? "").trim().toLowerCase();
    if (!norm) continue;
    const serial =
      typeof r.serial_no === "number" ? r.serial_no : Number.MAX_SAFE_INTEGER;
    const prev = firstSeen.get(norm);
    if (prev === undefined || serial < prev) firstSeen.set(norm, serial);
  }

  const ordered = [...firstSeen.entries()].sort((a, b) =>
    a[1] !== b[1] ? a[1] - b[1] : a[0].localeCompare(b[0])
  );

  const map = new Map<string, number>();
  ordered.forEach(([norm], i) => map.set(norm, i + 1));
  return map;
}

/** Resolve a participant's school number from the per-event map. */
export function schoolNumberOf(
  map: Map<string, number>,
  schoolName: string | null | undefined
): number | null {
  if (!schoolName) return null;
  return map.get(schoolName.trim().toLowerCase()) ?? null;
}

/**
 * Participant-facing label, e.g. "School #7". Returns null when the participant
 * has no school recorded; returns "School #—" when a school is present but not
 * in the map (should not happen for an in-event participant, but never leaks the
 * name).
 */
export function schoolNumberLabel(
  map: Map<string, number>,
  schoolName: string | null | undefined
): string | null {
  if (!schoolName) return null;
  const n = schoolNumberOf(map, schoolName);
  return n == null ? "School #—" : `School #${n}`;
}
