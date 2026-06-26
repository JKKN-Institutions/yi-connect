import "server-only";

// ═══════════════════════════════════════════════════════════════════════
// YIP NATIONAL INTELLIGENCE — cross-event CORPUS layer
//
// Aggregates the deliberation corpus across ALL chapter rounds and tags every
// slice by GoI ministry/scheme via the deterministic committee→topics join
// (lib/yip/national/taxonomy.ts). This is the data spine the /national
// dashboard panels consume. Each panel calls one getter here.
//
// Reuse contract: mirrors app/yip/actions/coverage.ts EXACTLY —
// createServiceClient() (schema-pinned to yip), fetchAllRows() for any list
// that can exceed the ~1000-row PostgREST cap, requireSuperAdmin() gate that
// returns an empty report on deny.
//
// DATA REALITY (2026-06): ~68 non-mock chapter events, 1442/1649 participants
// carry a committee_name, only ~2 mock bills exist. So every getter MUST render
// gracefully near-empty and EXCLUDE is_mock data from national rollups by
// default. Numbers grow as the 2026 season runs — never fabricate.
//
// is_mock exclusion is BELT-AND-SUSPENDERS: events filtered to is_mock!==true
// (so a mock event's participants never enter scope) AND each participant row's
// own is_mock flag is skipped (so a mock delegate attached to a real event
// can't leak into a national count). Today there are 0 mock participants on real
// events, but the rule is exclude-is_mock-from-rollups, so we enforce both.
//
// FUTURE AI HOOK: bill objective/problem_statement/provisions are rich free
// text. A later layer could classify a bill → ministry/scheme when committee_name
// is null, and synthesize a national "verdict" per scheme. Today tagging is
// purely the committee_name string join; un-tagged bills are counted as
// "untagged", never guessed.
// ═══════════════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/yip/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  getCommitteeMinistryMap,
  indexByCommittee,
  normalizeMinistry,
  type CommitteeMinistryMapping,
} from "@/lib/yip/national/taxonomy";

// ─── Shared event-scope helper ──────────────────────────────────────────

// The set of events that count toward national rollups: non-mock, real
// chapter rounds. Returned as id→meta so callers can label/group by chapter.
export type CorpusEvent = {
  id: string;
  name: string | null;
  level: string | null;
  status: string | null;
  chapter_name: string | null;
  city: string | null;
  state: string | null;
  zone: string | null;
  yi_zone_code: string | null;
  yi_chapter_id: string | null;
};

type EventScope = {
  events: CorpusEvent[];
  byId: Map<string, CorpusEvent>;
};

const EVENT_COLS =
  "id, name, level, status, chapter_name, city, state, zone, yi_zone_code, yi_chapter_id, is_mock";

async function loadEventScope(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<EventScope> {
  // Events comfortably fit under the row cap today (~70), but page anyway so
  // this never silently truncates as the season scales to hundreds of rounds.
  const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
    svc
      .from("events")
      .select(EVENT_COLS)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: Record<string, unknown>[] | null;
      error: unknown;
    }>
  );

  const events: CorpusEvent[] = rows
    .filter((r) => r.is_mock !== true)
    .map((r) => ({
      id: String(r.id),
      name: (r.name as string | null) ?? null,
      level: (r.level as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      chapter_name: (r.chapter_name as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      state: (r.state as string | null) ?? null,
      zone: (r.zone as string | null) ?? null,
      yi_zone_code: (r.yi_zone_code as string | null) ?? null,
      yi_chapter_id: (r.yi_chapter_id as string | null) ?? null,
    }));

  const byId = new Map(events.map((e) => [e.id, e]));
  return { events, byId };
}

// ─── Coverage-by-ministry getter (the reference panel's data) ────────────

// One ministry/committee, with how many distinct chapters ran it and how many
// participants sat on it across all non-mock rounds.
export type MinistryCoverage = {
  ministry: string;
  committee_name: string;
  schemes: string[];
  in_taxonomy: boolean;
  chapter_count: number; // distinct chapters (or events, if chapter id missing)
  event_count: number; // distinct events featuring this committee
  participant_count: number; // participants sitting on this committee
};

export type MinistryCoverageReport = {
  // Real signal present? false ⇒ panels show the "scales as rounds run" empty
  // state instead of an all-zero table.
  hasData: boolean;
  totals: {
    events_in_scope: number; // non-mock events considered
    chapters_in_scope: number; // distinct chapters with any tagged participant
    ministries_touched: number; // committees that appear at least once
    tagged_participants: number; // participants with a resolvable committee
    untagged_participants: number; // participants with NULL/blank committee_name
  };
  ministries: MinistryCoverage[];
  // Committees defined in the catalogue but never run yet — honest "not yet
  // deliberated" list rather than hiding them.
  untouched_committees: { ministry: string; schemes: string[] }[];
};

const EMPTY_MINISTRY_REPORT: MinistryCoverageReport = {
  hasData: false,
  totals: {
    events_in_scope: 0,
    chapters_in_scope: 0,
    ministries_touched: 0,
    tagged_participants: 0,
    untagged_participants: 0,
  },
  ministries: [],
  untouched_committees: [],
};

/**
 * Cross-event coverage by ministry/committee.
 *
 * For every non-mock event, counts participants per committee_name, resolves
 * each committee to its ministry + schemes via the deterministic topics join,
 * and rolls up distinct chapters / events / participants per ministry. Mock
 * participants are skipped on both axes (mock event scope + per-row is_mock).
 *
 * Super-admin only; returns a hasData:false empty report on deny OR when the
 * corpus has no tagged participants yet.
 */
export async function getMinistryCoverage(): Promise<MinistryCoverageReport> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return EMPTY_MINISTRY_REPORT;

  const svc = await createServiceClient();

  // The committee→ministry→scheme bridge (one read, indexed for O(1) lookup).
  const mappingRows = await getCommitteeMinistryMap();
  const mapping = indexByCommittee(mappingRows);

  const scope = await loadEventScope(svc);
  if (scope.events.length === 0) return EMPTY_MINISTRY_REPORT;
  const scopeIds = new Set(scope.events.map((e) => e.id));

  // Participants across ALL events (paged), then filtered to in-scope events.
  // committee_name is the deterministic tag key. is_mock is read so we can
  // skip any mock delegate even if it were attached to a real event
  // (defence-in-depth on top of the non-mock event scope) — rule 8: never let
  // is_mock data into a national rollup.
  const participants = await fetchAllRows<{
    event_id: string | null;
    committee_name: string | null;
    is_mock: boolean | null;
  }>((from, to) =>
    svc
      .from("participants")
      .select("event_id, committee_name, is_mock")
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data:
        | {
            event_id: string | null;
            committee_name: string | null;
            is_mock: boolean | null;
          }[]
        | null;
      error: unknown;
    }>
  );

  // Accumulate per normalized ministry key.
  type Acc = {
    ministry: string;
    committee_name: string;
    schemes: string[];
    in_taxonomy: boolean;
    chapters: Set<string>;
    events: Set<string>;
    participants: number;
  };
  const acc = new Map<string, Acc>();
  const chaptersInScope = new Set<string>();
  let tagged = 0;
  let untagged = 0;

  for (const p of participants) {
    // Exclude mock delegates from national rollups (rule 8, defence-in-depth).
    if (p.is_mock === true) continue;
    if (!p.event_id || !scopeIds.has(p.event_id)) continue;
    const ev = scope.byId.get(p.event_id);
    const committeeRaw = (p.committee_name ?? "").trim();
    if (!committeeRaw) {
      untagged += 1;
      continue;
    }
    tagged += 1;

    const key = normalizeMinistry(committeeRaw);
    const m: CommitteeMinistryMapping | undefined = mapping.get(key);
    const display = m?.ministry ?? committeeRaw;
    const schemes = m?.schemes ?? [];
    const inTax = m?.in_taxonomy ?? false;

    let bucket = acc.get(key);
    if (!bucket) {
      bucket = {
        ministry: display,
        committee_name: committeeRaw,
        schemes,
        in_taxonomy: inTax,
        chapters: new Set<string>(),
        events: new Set<string>(),
        participants: 0,
      };
      acc.set(key, bucket);
    }
    // Prefer catalogue display/schemes once we ever see a mapped instance.
    if (m) {
      bucket.ministry = m.ministry;
      bucket.schemes = m.schemes;
      bucket.in_taxonomy = m.in_taxonomy;
    }
    bucket.events.add(p.event_id);
    const chapterKey = ev?.yi_chapter_id ?? p.event_id;
    bucket.chapters.add(chapterKey);
    chaptersInScope.add(chapterKey);
    bucket.participants += 1;
  }

  const ministries: MinistryCoverage[] = [...acc.values()]
    .map((b) => ({
      ministry: b.ministry,
      committee_name: b.committee_name,
      schemes: b.schemes,
      in_taxonomy: b.in_taxonomy,
      chapter_count: b.chapters.size,
      event_count: b.events.size,
      participant_count: b.participants,
    }))
    .sort(
      (a, b) =>
        b.chapter_count - a.chapter_count ||
        b.participant_count - a.participant_count ||
        a.ministry.localeCompare(b.ministry)
    );

  // Catalogue committees that never appeared in any non-mock round yet.
  const touchedKeys = new Set(acc.keys());
  const untouched = mappingRows
    .filter((row) => !touchedKeys.has(normalizeMinistry(row.committee_name)))
    .map((row) => ({ ministry: row.ministry, schemes: row.schemes }))
    .sort((a, b) => a.ministry.localeCompare(b.ministry));

  return {
    hasData: tagged > 0,
    totals: {
      events_in_scope: scope.events.length,
      chapters_in_scope: chaptersInScope.size,
      ministries_touched: ministries.length,
      tagged_participants: tagged,
      untagged_participants: untagged,
    },
    ministries,
    untouched_committees: untouched,
  };
}
