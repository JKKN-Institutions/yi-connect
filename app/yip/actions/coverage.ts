"use server";

// ═══════════════════════════════════════════════════════════════════════
// National coverage — chapter-by-chapter "has this chapter run a YIP yet?".
//
// Spine is the canonical 65-row yi.chapters (the mother source), NOT the
// free-text yip.events.chapter_name that getZoneSummary() leans on. This is
// only possible now that every event carries a real yi_chapter_id FK
// (chapter picker, #322).
//
// Super-admin only. Read-only. Used by /yip/dashboard/admin/coverage.
// ═══════════════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/yip/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { YI_ZONES } from "@/lib/yip/hierarchy";
import { EVENT_STATUSES, type EventStatus } from "@/lib/yip/constants";

// Coarse lifecycle stage a chapter has reached, derived from the
// furthest-along of its events. Drives the badge + the "not started" group.
export type CoverageStage =
  | "none" // no event created at all
  | "created" // event exists but still draft
  | "registration" // registration open/closed
  | "live" // day1/day2 in progress or complete
  | "completed"; // completed or results published

export type ChapterCoverage = {
  chapter_id: string;
  name: string;
  city: string | null;
  state: string | null;
  region: string;
  chair_name: string | null;
  chair_email: string | null;
  event_count: number;
  participant_count: number;
  furthest_status: EventStatus | null;
  stage: CoverageStage;
  // The furthest-along event, so the row can deep-link into it.
  latest_event_id: string | null;
  last_activity: string | null;
};

export type RegionCoverage = {
  code: string;
  label: string;
  total_chapters: number;
  with_event: number;
  completed: number;
  participant_count: number;
  chapters: ChapterCoverage[];
};

export type CoverageReport = {
  totals: {
    total_chapters: number;
    with_event: number;
    completed: number;
    participant_count: number;
    event_count: number;
  };
  regions: RegionCoverage[];
};

const EMPTY_REPORT: CoverageReport = {
  totals: {
    total_chapters: 0,
    with_event: 0,
    completed: 0,
    participant_count: 0,
    event_count: 0,
  },
  regions: [],
};

// Position in the canonical lifecycle; -1 for anything unrecognised so an
// unknown status never wins "furthest-along" over a real one.
function statusRank(status: string | null): number {
  if (!status) return -1;
  return (EVENT_STATUSES as readonly string[]).indexOf(status);
}

function stageFor(status: EventStatus | null): CoverageStage {
  switch (status) {
    case null:
      return "none";
    case "draft":
      return "created";
    case "registration_open":
    case "registration_closed":
      return "registration";
    case "day1_live":
    case "day1_complete":
    case "day2_live":
      return "live";
    case "completed":
    case "results_published":
      return "completed";
    default:
      // Unknown but non-null status: it exists, so at least "created".
      return "created";
  }
}

type EventRow = {
  id: string;
  status: string | null;
  yi_chapter_id: string | null;
  created_at: string | null;
  results_published_at: string | null;
};

/**
 * Coverage across all 65 chapters, grouped by the 6 Yi regions.
 *
 * Defence-in-depth: the page already sits behind the super-admin admin
 * layout, but this gate means a direct call still returns nothing for a
 * non-super-admin rather than leaking chapter/chair contact data.
 */
export async function getChapterCoverage(): Promise<CoverageReport> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return EMPTY_REPORT;

  const svc = await createServiceClient();

  const [chaptersRes, eventsRes] = await Promise.all([
    svc
      .schema("yi")
      .from("chapters")
      .select("id, name, city, state, region, chair_name, chair_email")
      .order("region")
      .order("name"),
    svc
      .from("events")
      .select("id, status, yi_chapter_id, created_at, results_published_at")
      .not("yi_chapter_id", "is", null),
  ]);

  // PostgREST caps a single response at ~1000 rows; participants across all
  // events already exceeds that, so a bare select silently undercounts the
  // per-chapter rollup below. Page through in full batches.
  const participants = await fetchAllRows<{ event_id: string | null }>(
    (from, to) =>
      svc
        .from("participants")
        .select("event_id")
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: { event_id: string | null }[] | null;
        error: unknown;
      }>
  );

  const chapters = chaptersRes.data ?? [];
  const events = (eventsRes.data ?? []) as EventRow[];

  // event_id → chapter_id, so participant counts roll up to the chapter.
  const eventToChapter = new Map<string, string>();
  const eventsByChapter = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!e.yi_chapter_id) continue;
    eventToChapter.set(e.id, e.yi_chapter_id);
    const arr = eventsByChapter.get(e.yi_chapter_id) ?? [];
    arr.push(e);
    eventsByChapter.set(e.yi_chapter_id, arr);
  }

  const participantsByChapter = new Map<string, number>();
  for (const p of participants) {
    const ch = p.event_id ? eventToChapter.get(p.event_id) : undefined;
    if (ch) participantsByChapter.set(ch, (participantsByChapter.get(ch) ?? 0) + 1);
  }

  const chapterRows: ChapterCoverage[] = chapters.map((c) => {
    const evs = eventsByChapter.get(c.id) ?? [];

    // Furthest-along event: highest status rank, tie-broken by recency.
    let furthest: EventRow | null = null;
    for (const e of evs) {
      if (
        furthest === null ||
        statusRank(e.status) > statusRank(furthest.status) ||
        (statusRank(e.status) === statusRank(furthest.status) &&
          (e.created_at ?? "") > (furthest.created_at ?? ""))
      ) {
        furthest = e;
      }
    }

    const furthestStatus = (furthest?.status ?? null) as EventStatus | null;
    const lastActivity =
      furthest?.results_published_at ?? furthest?.created_at ?? null;

    return {
      chapter_id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      region: c.region ?? "—",
      chair_name: c.chair_name ?? null,
      chair_email: c.chair_email ?? null,
      event_count: evs.length,
      participant_count: participantsByChapter.get(c.id) ?? 0,
      furthest_status: furthestStatus,
      stage: stageFor(furthestStatus),
      latest_event_id: furthest?.id ?? null,
      last_activity: lastActivity,
    };
  });

  // Group into the 6 canonical regions (YI_ZONES order). A chapter whose
  // region code isn't recognised still surfaces under its raw code so it
  // is never silently dropped from the national total.
  const knownCodes = YI_ZONES.map((z) => z.code as string);
  const byRegion = new Map<string, ChapterCoverage[]>();
  for (const row of chapterRows) {
    const arr = byRegion.get(row.region) ?? [];
    arr.push(row);
    byRegion.set(row.region, arr);
  }

  const orderedCodes = [
    ...knownCodes,
    ...[...byRegion.keys()].filter((c) => !knownCodes.includes(c)).sort(),
  ];

  const regions: RegionCoverage[] = orderedCodes
    .filter((code) => byRegion.has(code))
    .map((code) => {
      const rows = byRegion.get(code) ?? [];
      const label = YI_ZONES.find((z) => z.code === code)?.label ?? code;
      // Active (has event) first by stage, then alphabetical; not-started last.
      rows.sort((a, b) => {
        const order: CoverageStage[] = [
          "completed",
          "live",
          "registration",
          "created",
          "none",
        ];
        const d = order.indexOf(a.stage) - order.indexOf(b.stage);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      });
      return {
        code,
        label,
        total_chapters: rows.length,
        with_event: rows.filter((r) => r.event_count > 0).length,
        completed: rows.filter((r) => r.stage === "completed").length,
        participant_count: rows.reduce((s, r) => s + r.participant_count, 0),
        chapters: rows,
      };
    });

  return {
    totals: {
      total_chapters: chapterRows.length,
      with_event: chapterRows.filter((r) => r.event_count > 0).length,
      completed: chapterRows.filter((r) => r.stage === "completed").length,
      participant_count: chapterRows.reduce((s, r) => s + r.participant_count, 0),
      event_count: events.length,
    },
    regions,
  };
}
