import "server-only";

/**
 * YIP Chapter Round Report — Section 3 (Delegates) data helper.
 *
 * Mirrors the REFERENCE shape from lib/yip/report/sections/overview.ts EXACTLY:
 *   1. `import "server-only"` — this is a data module (never a "use server"
 *      file), so it may export both types and the async getter.
 *   2. gate with getYipEventAccess(eventId); if !canView return null so the
 *      section component renders nothing rather than throwing inside Suspense.
 *   3. read yip.* via createServiceClient() (already schema-pinned to "yip";
 *      query plain .from("participants") — no .schema() needed).
 *
 * Section 3 is fully auto-derived (no fill-in controls):
 *   (a) Registered delegates  = ALL participants for the event.
 *   (b) Attended delegates     = participants with checked_in_day1 OR
 *                                checked_in_day2 true.
 *   (c) Participating schools  = distinct, non-empty participants.school_name.
 *
 * School names are PII that is purged after the event (events.pii_purged_at).
 * Once purged, school_name rows are blanked, so the school list MUST be
 * generated before the purge. We surface piiPurgedAt so the section can warn.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

/** One participating school + how many delegates it sent. */
export type SchoolCount = {
  name: string;
  delegates: number;
};

export type DelegatesData = {
  /** Total registered delegates (every participant row). */
  registeredCount: number;
  /** Delegates who checked in on at least one day. */
  attendedCount: number;
  /** Attended on Day 1 (checked_in_day1). */
  attendedDay1: number;
  /** Attended on Day 2 (checked_in_day2). */
  attendedDay2: number;
  /** Number of distinct participating schools. */
  schoolCount: number;
  /** Distinct schools with their delegate counts, sorted by size then name. */
  schools: SchoolCount[];
  /**
   * events.pii_purged_at — when set, school PII has been wiped and the school
   * list is no longer reliable; the section shows a "generate before purge"
   * note instead.
   */
  piiPurgedAt: string | null;
};

/** Narrow shape of the participant rows we read for this section. */
type ParticipantRow = {
  school_name: string | null;
  checked_in_day1: boolean | null;
  checked_in_day2: boolean | null;
};

/**
 * Fetch everything Section 3 renders. Returns `null` when the caller lacks
 * view access (the section component then renders nothing).
 */
export async function getDelegatesData(
  eventId: string
): Promise<DelegatesData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  // Whether this event's school PII has already been purged.
  const { data: event } = await svc
    .from("events")
    .select("id, pii_purged_at")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return null;

  // All participant rows for the event. Same fetch pattern as
  // app/yip/actions/post-session-report.ts — read the rows, count in JS.
  const { data: rows } = await svc
    .from("participants")
    .select("school_name, checked_in_day1, checked_in_day2")
    .eq("event_id", eventId);

  const participants = (rows ?? []) as unknown as ParticipantRow[];

  const registeredCount = participants.length;

  let attendedCount = 0;
  let attendedDay1 = 0;
  let attendedDay2 = 0;
  // Map of normalised school key -> { display name, count }. Normalising on a
  // trimmed, lower-cased key folds "ABC School" / "abc school " into one row
  // while keeping the first-seen display spelling.
  const schoolMap = new Map<string, { name: string; delegates: number }>();

  for (const p of participants) {
    const d1 = p.checked_in_day1 === true;
    const d2 = p.checked_in_day2 === true;
    if (d1) attendedDay1 += 1;
    if (d2) attendedDay2 += 1;
    if (d1 || d2) attendedCount += 1;

    const raw = (p.school_name ?? "").trim();
    if (raw.length === 0) continue;
    const key = raw.toLowerCase();
    const existing = schoolMap.get(key);
    if (existing) {
      existing.delegates += 1;
    } else {
      schoolMap.set(key, { name: raw, delegates: 1 });
    }
  }

  const schools: SchoolCount[] = Array.from(schoolMap.values()).sort(
    (a, b) => b.delegates - a.delegates || a.name.localeCompare(b.name)
  );

  return {
    registeredCount,
    attendedCount,
    attendedDay1,
    attendedDay2,
    schoolCount: schools.length,
    schools,
    piiPurgedAt: event.pii_purged_at ?? null,
  };
}
