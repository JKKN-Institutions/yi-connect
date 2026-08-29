"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

/**
 * Record which Yi CHAPTER each participant was sent by.
 *
 * At a regional round every chapter in the zone sends candidates, but the only
 * institution field the roster carries is `school_name` (free text). `school_id`
 * and `yi_institution_id` are 0% populated on the live SRTN round, and the
 * event's `chapter_name` is the HOST chapter — so nothing on the platform can
 * currently answer "how did Salem's students do". This module is the write path
 * that fills that gap, plus the reads the organiser screen needs.
 *
 * THE ZONE IS THE GUARD RAIL. A regional round belongs to exactly one Yi zone,
 * and only that zone's chapters may appear or be written. An organiser at the
 * SRTN round cannot file a student under a WR chapter, by dropdown or by paste.
 * When the event has NO zone recorded, every read returns an empty picklist and
 * every write is refused — an unknown scope denies rather than falling back to
 * all 65 chapters (which is exactly the mistake the scoping exists to prevent).
 *
 * GRACEFUL DEGRADATION. `yip.participants.yi_chapter_id` is added by migration
 * 20260829120000, which is applied by hand and separately from this deploy.
 * Until then every read reports `migrationApplied: false` and every write is
 * refused with a message naming the migration — the feature is INERT, never
 * silently half-working. Reads/writes of the column go through a narrow loose
 * cast (same approach as `mover_participant_id` in actions/bills.ts) because it
 * is absent from the generated types.
 *
 * SCHOOL NAMES ARE SHOWN HERE ON PURPOSE. They are hidden from the participants
 * roster (school-blind party/committee allocation) and from jurors (school-blind
 * scoring), but organisers already see them on certificates, the formation
 * announcement and the zone rollup. Every function below is event-scoped and
 * gated, so nothing here reaches a juror or a student.
 */

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ChapterOption = {
  id: string;
  name: string;
  city: string | null;
};

export type ChapterOptions = {
  /** The event's Yi zone (e.g. "SRTN"), or null when the event has none set. */
  zone: string | null;
  chapters: ChapterOption[];
};

/** One school on the event's roster, with the chapter its students are filed under. */
export type SchoolChapterGroup = {
  schoolName: string;
  participantCount: number;
  /** The chapter every student of this school shares, or null if unassigned. */
  chapterId: string | null;
  /**
   * True when this school's students are split across more than one chapter
   * (or partly unassigned). Surfaced so the organiser is never shown a single
   * dropdown value that quietly misrepresents several students.
   */
  mixed: boolean;
};

/** A participant with no school on the roster — reachable only one at a time. */
export type UnschooledParticipant = {
  id: string;
  fullName: string;
  chapterId: string | null;
};

export type ChapterAssignmentBoard = {
  migrationApplied: boolean;
  schools: SchoolChapterGroup[];
  /** Students with a blank school_name; school-level assignment cannot reach them. */
  noSchool: UnschooledParticipant[];
};

export type ChapterAssignmentProgress = {
  migrationApplied: boolean;
  assigned: number;
  unassigned: number;
  total: number;
  /** Distinct school names that still have at least one unassigned student. */
  unassignedSchools: string[];
  /** Unassigned students carrying no school name at all. */
  unassignedWithoutSchool: number;
};

/** One paste-in row: a school on the roster and the chapter it should map to. */
export type BulkAssignRow = {
  schoolName: string;
  chapterName: string;
};

export type BulkAssignReport = {
  /** Participants whose row was actually written. */
  matchedParticipants: number;
  /** Rows that resolved to both a real school and an in-zone chapter. */
  appliedRows: number;
  /**
   * Every row that did NOT apply, with the reason. Never dropped silently — an
   * unreported miss is a student quietly left out of their chapter's tally.
   */
  unresolved: {
    schoolName: string;
    chapterName: string;
    reason:
      | "unknown_school"
      | "unknown_chapter"
      | "chapter_outside_zone"
      | "duplicate_row"
      | "blank_row";
  }[];
};

// ─── Shared helpers ────────────────────────────────────────────────

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

/** PostgREST caps an unbounded select at 1000 rows; a national roster exceeds that. */
const PAGE = 1000;

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Shown verbatim on screen, so it names the migration an admin has to apply. */
const MIGRATION_MISSING =
  "Chapter recording is not switched on yet — migration 20260829120000_yip_participant_chapter has not been applied to the database.";

/**
 * True when a PostgREST/Postgres error means `yi_chapter_id` does not exist yet
 * (migration 20260829120000 not applied).
 *   • SELECT naming an unknown column → Postgres 42703 "column … does not exist"
 *   • UPDATE payload with an unknown column → PostgREST PGRST204 "…schema cache"
 * Mirrors isMissingBillSourceError in lib/yip/bill-sources.ts.
 */
function isMissingChapterColumn(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code ?? "";
  const message = (err as { message?: string }).message ?? "";
  if (!/yi_chapter_id/.test(message)) return false;
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache/i.test(message)
  );
}

/**
 * The event's Yi zone. Fails CLOSED: an event with no zone recorded has no
 * legitimate chapter list, so callers must refuse rather than widen the picklist.
 * Real regional rounds carry the zone in both `zone` (enum) and `yi_zone_code`;
 * either is the event's OWN zone, so reading whichever is present is not a
 * relaxation.
 */
async function resolveEventZone(
  svc: Svc,
  eventId: string
): Promise<{ ok: true; zone: string } | { ok: false; error: string }> {
  const { data } = await svc
    .from("events")
    .select("zone, yi_zone_code")
    .eq("id", eventId)
    .maybeSingle();

  if (!data) return { ok: false, error: "Event not found." };

  const zone = (data.zone ?? data.yi_zone_code ?? "").trim().toUpperCase();
  if (!zone) {
    return {
      ok: false,
      error:
        "This event has no Yi zone set, so its chapter list cannot be scoped. Set the zone on the event first.",
    };
  }
  return { ok: true, zone };
}

/** The active chapters of one zone, ordered by name. */
async function chaptersInZone(svc: Svc, zone: string): Promise<ChapterOption[]> {
  // Only chapters explicitly flagged active are offered. A chapter added later
  // with is_active left null simply will not appear until it is switched on —
  // the safe direction for a picklist that decides where a student is counted.
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city")
    .eq("region", zone)
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((c) => ({ id: c.id, name: c.name, city: c.city }));
}

type RosterRow = {
  id: string;
  full_name: string;
  school_name: string;
  yi_chapter_id?: string | null;
};

type RosterRead =
  | { ok: true; rows: RosterRow[]; migrationApplied: boolean }
  | { ok: false; error: string };

/**
 * Every participant of the event, with the chapter column when it exists.
 *
 * Three outcomes are kept apart on purpose. A MISSING column means the
 * migration is not applied and the caller says so. A FAILED read is a real
 * fault and is surfaced as an error — returning an empty roster instead would
 * render "0 students to assign", which an organiser reads as "nothing to do".
 */
async function readRoster(svc: Svc, eventId: string): Promise<RosterRead> {
  type Attempt =
    | { kind: "rows"; rows: RosterRow[] }
    | { kind: "missing" }
    | { kind: "failed"; error: string };

  async function readAll(columns: string): Promise<Attempt> {
    const out: RosterRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await svc
        .from("participants")
        .select(columns)
        .eq("event_id", eventId)
        .order("full_name")
        .range(from, from + PAGE - 1);
      if (error) {
        if (isMissingChapterColumn(error)) return { kind: "missing" };
        return { kind: "failed", error: error.message };
      }
      const page = (data ?? []) as unknown as RosterRow[];
      out.push(...page);
      if (page.length < PAGE) break;
    }
    return { kind: "rows", rows: out };
  }

  const withChapter = await readAll("id, full_name, school_name, yi_chapter_id");
  if (withChapter.kind === "rows") {
    return { ok: true, rows: withChapter.rows, migrationApplied: true };
  }
  if (withChapter.kind === "failed") {
    return { ok: false, error: withChapter.error };
  }

  const without = await readAll("id, full_name, school_name");
  if (without.kind !== "rows") {
    return {
      ok: false,
      error:
        without.kind === "failed"
          ? without.error
          : "Could not read this event's roster.",
    };
  }
  return { ok: true, rows: without.rows, migrationApplied: false };
}

/**
 * Write one chapter id (or null) onto a set of participants, scoped to the
 * event so a stray id from another round can never be touched.
 */
async function writeChapter(
  svc: Svc,
  eventId: string,
  participantIds: string[],
  chapterId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (participantIds.length === 0) return { ok: true };

  for (let i = 0; i < participantIds.length; i += PAGE) {
    const slice = participantIds.slice(i, i + PAGE);
    const { error } = await svc
      .from("participants")
      .update({ yi_chapter_id: chapterId } as never)
      .eq("event_id", eventId)
      .in("id", slice);
    if (error) {
      if (isMissingChapterColumn(error)) {
        return { ok: false, error: MIGRATION_MISSING };
      }
      return { ok: false, error: error.message };
    }
  }
  return { ok: true };
}

function revalidateBoard(eventId: string) {
  revalidatePath(`/yip/dashboard/events/${eventId}/chapters`);
}

// ─── Reads ─────────────────────────────────────────────────────────

/**
 * The chapter picklist for this event — its OWN zone's active chapters only.
 * Gated on canView (organisers and above); the page itself requires canManage.
 */
export async function getEventChapterOptions(
  eventId: string
): Promise<ActionResult<ChapterOptions>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "You don't have access to this event." };
  }

  const svc = await createServiceClient();
  const zone = await resolveEventZone(svc, eventId);
  // No zone → an empty list, not every chapter. The caller shows the reason.
  if (!zone.ok) return { success: true, data: { zone: null, chapters: [] } };

  return {
    success: true,
    data: { zone: zone.zone, chapters: await chaptersInZone(svc, zone.zone) },
  };
}

/** Assigned vs unassigned, and which schools still need a chapter. */
export async function getChapterAssignmentProgress(
  eventId: string
): Promise<ActionResult<ChapterAssignmentProgress>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "You don't have access to this event." };
  }

  const svc = await createServiceClient();
  const roster = await readRoster(svc, eventId);
  if (!roster.ok) return { success: false, error: roster.error };
  const { rows, migrationApplied } = roster;

  let assigned = 0;
  let unassignedWithoutSchool = 0;
  const unassignedSchools = new Set<string>();

  for (const r of rows) {
    if (r.yi_chapter_id) {
      assigned += 1;
      continue;
    }
    const school = (r.school_name ?? "").trim();
    if (school) unassignedSchools.add(school);
    else unassignedWithoutSchool += 1;
  }

  return {
    success: true,
    data: {
      migrationApplied,
      assigned,
      unassigned: rows.length - assigned,
      total: rows.length,
      unassignedSchools: [...unassignedSchools].sort((a, b) =>
        a.localeCompare(b)
      ),
      unassignedWithoutSchool,
    },
  };
}

/**
 * The roster folded into one row per school, plus the students who carry no
 * school at all. School-level assignment is ~1/5 the clicks of per-student
 * (196 students across 124 schools on the live SRTN round), but it structurally
 * cannot reach a blank school — hence the separate list.
 */
export async function getChapterAssignmentBoard(
  eventId: string
): Promise<ActionResult<ChapterAssignmentBoard>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "You don't have access to this event." };
  }

  const svc = await createServiceClient();
  const roster = await readRoster(svc, eventId);
  if (!roster.ok) return { success: false, error: roster.error };
  const { rows, migrationApplied } = roster;

  const bySchool = new Map<
    string,
    { count: number; chapterIds: Set<string | null> }
  >();
  const noSchool: UnschooledParticipant[] = [];

  for (const r of rows) {
    const school = (r.school_name ?? "").trim();
    const chapterId = r.yi_chapter_id ?? null;
    if (!school) {
      noSchool.push({
        id: r.id,
        fullName: r.full_name,
        chapterId,
      });
      continue;
    }
    const entry = bySchool.get(school) ?? {
      count: 0,
      chapterIds: new Set<string | null>(),
    };
    entry.count += 1;
    entry.chapterIds.add(chapterId);
    bySchool.set(school, entry);
  }

  const schools: SchoolChapterGroup[] = [...bySchool.entries()]
    .map(([schoolName, e]) => {
      const ids = [...e.chapterIds];
      return {
        schoolName,
        participantCount: e.count,
        chapterId: ids.length === 1 ? ids[0] : null,
        mixed: ids.length > 1,
      };
    })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName));

  return { success: true, data: { migrationApplied, schools, noSchool } };
}

// ─── Writes ────────────────────────────────────────────────────────

/**
 * Validate a chapter id against the event's zone. Fails closed on every
 * unknown: no zone, no such chapter, inactive chapter, or a chapter belonging
 * to another zone.
 */
async function assertChapterInZone(
  svc: Svc,
  eventId: string,
  chapterId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const zone = await resolveEventZone(svc, eventId);
  if (!zone.ok) return { ok: false, error: zone.error };

  const { data: chapter } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, region, is_active")
    .eq("id", chapterId)
    .maybeSingle();

  if (!chapter) return { ok: false, error: "That chapter no longer exists." };
  if (chapter.is_active !== true) {
    return { ok: false, error: "That chapter is not active." };
  }
  if ((chapter.region ?? "").trim().toUpperCase() !== zone.zone) {
    return {
      ok: false,
      error: `That chapter is not in this event's zone (${zone.zone}).`,
    };
  }
  return { ok: true };
}

/** Set (or clear) the chapter for ONE participant of this event. */
export async function setParticipantChapter(
  eventId: string,
  participantId: string,
  chapterId: string | null
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "You can't change this event's roster." };
  }

  const svc = await createServiceClient();

  // The participant must belong to THIS event — an id from another round is
  // rejected here, not merely filtered out by the update's own event scope.
  const { data: participant } = await svc
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "That student is not on this event." };
  }

  if (chapterId) {
    const check = await assertChapterInZone(svc, eventId, chapterId);
    if (!check.ok) return { success: false, error: check.error };
  }

  const written = await writeChapter(svc, eventId, [participantId], chapterId);
  if (!written.ok) return { success: false, error: written.error };

  revalidateBoard(eventId);
  return { success: true, data: null };
}

/**
 * Set (or clear) the chapter for every student of one school on this event.
 * The school is matched exactly as it is stored on the roster — the caller
 * passes a name that came from getChapterAssignmentBoard, so there is nothing
 * to normalise here and no risk of sweeping a neighbouring school.
 */
export async function setSchoolChapter(
  eventId: string,
  schoolName: string,
  chapterId: string | null
): Promise<ActionResult<{ matchedParticipants: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "You can't change this event's roster." };
  }

  const school = schoolName.trim();
  if (!school) {
    return {
      success: false,
      error:
        "Students with no school on the roster must be assigned one at a time.",
    };
  }

  const svc = await createServiceClient();

  if (chapterId) {
    const check = await assertChapterInZone(svc, eventId, chapterId);
    if (!check.ok) return { success: false, error: check.error };
  }

  const roster = await readRoster(svc, eventId);
  if (!roster.ok) return { success: false, error: roster.error };
  if (!roster.migrationApplied) {
    return { success: false, error: MIGRATION_MISSING };
  }

  const ids = roster.rows
    .filter((r) => (r.school_name ?? "").trim() === school)
    .map((r) => r.id);

  if (ids.length === 0) {
    return { success: false, error: "No students on this event from that school." };
  }

  const written = await writeChapter(svc, eventId, ids, chapterId);
  if (!written.ok) return { success: false, error: written.error };

  revalidateBoard(eventId);
  return { success: true, data: { matchedParticipants: ids.length } };
}

/**
 * Apply a pasted `school_name,chapter` list in one pass.
 *
 * Chapter names resolve case-insensitively against the event's OWN zone, and
 * school names case-insensitively against the roster as stored. EVERY row that
 * does not apply comes back in `unresolved` with its reason — a row is never
 * dropped quietly, because an unnoticed miss means a student is left out of
 * their chapter's recognition with nothing on screen to say so.
 */
export async function bulkAssignChaptersBySchool(
  eventId: string,
  rows: BulkAssignRow[]
): Promise<ActionResult<BulkAssignReport>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "You can't change this event's roster." };
  }

  const svc = await createServiceClient();
  const zone = await resolveEventZone(svc, eventId);
  if (!zone.ok) return { success: false, error: zone.error };

  const roster = await readRoster(svc, eventId);
  if (!roster.ok) return { success: false, error: roster.error };
  if (!roster.migrationApplied) {
    return { success: false, error: MIGRATION_MISSING };
  }

  // Chapter name → id, for this zone only. A chapter from another zone is
  // simply absent from the map and is reported as out-of-zone below.
  const inZone = await chaptersInZone(svc, zone.zone);
  const chapterIdByName = new Map(inZone.map((c) => [norm(c.name), c.id]));

  // Every active chapter name nationally (65 rows), read ONCE so an unmatched
  // line can be told apart — a typo versus a real chapter from another zone —
  // without a database round-trip per bad line.
  const { data: allChapters } = await svc
    .schema("yi")
    .from("chapters")
    .select("name")
    .eq("is_active", true);
  const knownChapterNames = new Set(
    (allChapters ?? []).map((c) => norm(c.name))
  );

  // School name → the ids of everyone on the roster from it.
  const idsBySchool = new Map<string, string[]>();
  for (const r of roster.rows) {
    const key = norm(r.school_name);
    if (!key) continue;
    const list = idsBySchool.get(key) ?? [];
    list.push(r.id);
    idsBySchool.set(key, list);
  }

  const report: BulkAssignReport = {
    matchedParticipants: 0,
    appliedRows: 0,
    unresolved: [],
  };
  const seenSchools = new Set<string>();

  for (const raw of rows) {
    const schoolName = (raw.schoolName ?? "").trim();
    const chapterName = (raw.chapterName ?? "").trim();

    if (!schoolName || !chapterName) {
      report.unresolved.push({ schoolName, chapterName, reason: "blank_row" });
      continue;
    }

    const schoolKey = norm(schoolName);
    if (seenSchools.has(schoolKey)) {
      // Two lines for one school would race each other; report the later one
      // rather than letting the last line silently win.
      report.unresolved.push({ schoolName, chapterName, reason: "duplicate_row" });
      continue;
    }

    const ids = idsBySchool.get(schoolKey);
    if (!ids) {
      report.unresolved.push({ schoolName, chapterName, reason: "unknown_school" });
      continue;
    }

    const chapterId = chapterIdByName.get(norm(chapterName));
    if (!chapterId) {
      // Distinguish "no such chapter anywhere" from "real chapter, wrong zone"
      // so the organiser knows whether it is a typo or the wrong round.
      report.unresolved.push({
        schoolName,
        chapterName,
        reason: knownChapterNames.has(norm(chapterName))
          ? "chapter_outside_zone"
          : "unknown_chapter",
      });
      continue;
    }

    const written = await writeChapter(svc, eventId, ids, chapterId);
    if (!written.ok) {
      // Rows before this one are already committed. Say so — an organiser who
      // believes nothing was written would paste the whole list again.
      revalidateBoard(eventId);
      return {
        success: false,
        error: `${written.error} Stopped at "${schoolName}"; the ${report.appliedRows} school(s) before it were already saved.`,
      };
    }

    seenSchools.add(schoolKey);
    report.appliedRows += 1;
    report.matchedParticipants += ids.length;
  }

  revalidateBoard(eventId);
  return { success: true, data: report };
}
