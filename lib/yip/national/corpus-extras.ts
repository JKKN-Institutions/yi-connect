import "server-only";

// ═══════════════════════════════════════════════════════════════════════
// YIP NATIONAL INTELLIGENCE — cross-event CORPUS layer (extended getters)
//
// Companion to lib/yip/national/corpus.ts. The architect's corpus.ts owns the
// shared scope helper + getMinistryCoverage(); this file adds the remaining
// cross-event rollups so the two files never have to be edited in the same
// merge:
//
//   getTopicCoverage()       — per central/regional DEBATE topic, how many
//                              chapters debated it (topics.title direct match).
//   getBillPipeline()        — every bill across events, deterministically
//                              tagged committee → ministry + schemes, with
//                              status + vote tally + source event/chapter.
//   getVerdictByMinistry()   — where bills/votes exist, pass/reject rolled up
//                              by ministry (empty-safe; ~2 mock bills today).
//   getParticipationRollup() — headline reach: chapters, delegates, schools,
//                              zones covered across all real rounds.
//
// Reuse contract: mirrors app/yip/actions/coverage.ts and corpus.ts EXACTLY —
// createServiceClient() (schema-pinned to yip → plain .from), fetchAllRows()
// for any list that can exceed the ~1000-row PostgREST cap, requireSuperAdmin()
// gate that returns an empty/hasData:false report on deny.
//
// DATA REALITY (2026-06, verified live): ~68 non-mock chapter events,
// 1442/1649 participants carry a committee_name, only ~2 mock bills exist
// (committee_name NULL). So every getter MUST render gracefully near-empty and
// EXCLUDE is_mock data from national rollups by default. Numbers grow as the
// 2026 season runs — never fabricate, never guess an untagged row.
//
// DETERMINISTIC ONLY — no LLM. Tagging is the committee_name → topics
// (category='committee') → linked_scheme string join, via taxonomy.ts. Where a
// future AI classifier would plug in is marked inline with `FUTURE AI HOOK`.
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

// ─── Shared event-scope helper (local copy) ─────────────────────────────
//
// corpus.ts keeps loadEventScope() module-private, so this file carries its own
// identical scoper to stay self-contained (no cross-file export to break on
// merge). Same contract: non-mock events only, returned id→meta so callers can
// label/group by chapter. If corpus.ts later exports its scope, collapse these.

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
  // ~70 events today, but page anyway so this never silently truncates as the
  // season scales to hundreds of rounds.
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

// A stable "which chapter does this event belong to" key — the canonical
// yi_chapter_id when present, else the event id, so a chapter without an FK
// still counts as exactly one chapter (never collapses distinct chapters).
function chapterKeyOf(ev: CorpusEvent | undefined, eventId: string): string {
  return ev?.yi_chapter_id ?? eventId;
}

// ═══════════════════════════════════════════════════════════════════════
// (2) getTopicCoverage — debate-topic reach across chapters
// ═══════════════════════════════════════════════════════════════════════
//
// Central/regional DEBATE topics map by topics.title DIRECTLY (no scheme).
// There is no per-event "topic chosen" column today, so the deterministic
// signal we CAN count is: which catalogue debate topics exist (central +
// regional), and — because debate topics drive the parliament agenda rather
// than a participant column — how many real rounds are in scope to debate them.
//
// We surface the catalogue honestly (every active central/regional topic, its
// zone, whether it's been linked to a scheme) and flag that per-round
// topic-selection capture is the next data point. This avoids fabricating a
// "chapters debated this" count we cannot derive yet.
//
// FUTURE AI HOOK: once a round records which debate topic(s) it ran (or once a
// classifier reads bill/agenda free-text and infers the topic), this getter
// fills chapter_count per topic from that signal instead of leaving it null.

export type TopicCoverage = {
  topic_id: string;
  title: string;
  category: string; // 'central' | 'regional'
  zone: string | null; // set for regional topics
  linked_scheme: string | null;
  // null = not yet measurable (no per-round topic-selection capture). NOT zero,
  // so the panel can say "not captured yet" rather than imply nobody ran it.
  chapter_count: number | null;
};

export type TopicCoverageReport = {
  hasData: boolean; // true when the catalogue has any active debate topic
  totals: {
    central_topics: number;
    regional_topics: number;
    rounds_in_scope: number; // real rounds that could debate these
    selection_capture_live: boolean; // per-round topic capture wired yet?
  };
  central: TopicCoverage[];
  regional: TopicCoverage[];
};

const EMPTY_TOPIC_REPORT: TopicCoverageReport = {
  hasData: false,
  totals: {
    central_topics: 0,
    regional_topics: 0,
    rounds_in_scope: 0,
    selection_capture_live: false,
  },
  central: [],
  regional: [],
};

export async function getTopicCoverage(): Promise<TopicCoverageReport> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return EMPTY_TOPIC_REPORT;

  const svc = await createServiceClient();
  const scope = await loadEventScope(svc);

  // Active central + regional debate topics from the catalogue. Committee rows
  // (the ministry vocabulary) are handled by the ministry getters, not here.
  const { data: topicRows, error } = (await svc
    .from("topics")
    .select("id, title, category, zone, linked_scheme")
    .in("category", ["central", "regional"])
    .eq("is_active", true)
    .order("category")
    .order("zone")
    .order("topic_number")) as {
    data:
      | {
          id: string;
          title: string | null;
          category: string | null;
          zone: string | null;
          linked_scheme: string | null;
        }[]
      | null;
    error: unknown;
  };

  if (error || !topicRows || topicRows.length === 0) {
    return {
      ...EMPTY_TOPIC_REPORT,
      totals: {
        ...EMPTY_TOPIC_REPORT.totals,
        rounds_in_scope: scope.events.length,
      },
    };
  }

  const toRow = (r: {
    id: string;
    title: string | null;
    category: string | null;
    zone: string | null;
    linked_scheme: string | null;
  }): TopicCoverage => ({
    topic_id: String(r.id),
    title: String(r.title ?? "").trim(),
    category: String(r.category ?? ""),
    zone: r.zone ?? null,
    linked_scheme: r.linked_scheme ?? null,
    // No per-round topic-selection capture exists yet → honestly null.
    chapter_count: null,
  });

  const central = topicRows
    .filter((r) => r.category === "central")
    .map(toRow);
  const regional = topicRows
    .filter((r) => r.category === "regional")
    .map(toRow);

  return {
    hasData: central.length > 0 || regional.length > 0,
    totals: {
      central_topics: central.length,
      regional_topics: regional.length,
      rounds_in_scope: scope.events.length,
      selection_capture_live: false,
    },
    central,
    regional,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// (3) getBillPipeline — every bill, tagged to ministry + scheme
// ═══════════════════════════════════════════════════════════════════════
//
// One row per non-mock bill across ALL real rounds, with: its committee →
// ministry + schemes (deterministic join), title, lifecycle status, vote tally
// (votes_for/against/abstain as stored on the bill), and source event/chapter
// so the national team can drill back to the round.
//
// Near-empty today (~2 mock bills, committee_name NULL). Bills with a NULL/blank
// committee_name are kept and marked `untagged:true` — counted, never guessed.
//
// FUTURE AI HOOK: an untagged bill carries rich free text
// (objective/problem_statement/provisions). A later classifier would read that
// text and PROPOSE a ministry/scheme, writing the proposal somewhere reviewable
// (e.g. gov_taxonomy.needs_review) — it would NOT silently overwrite the
// deterministic tag here. Until then, untagged bills surface as a gap, honestly.

export type BillStatusBucket = "passed" | "rejected" | "draft" | "other";

export type BillPipelineRow = {
  bill_id: string;
  title: string;
  status_raw: string | null;
  status_bucket: BillStatusBucket;
  committee_name: string | null;
  ministry: string | null; // resolved via taxonomy join; null if untagged
  schemes: string[];
  in_taxonomy: boolean;
  untagged: boolean; // committee_name NULL/blank → no deterministic ministry
  party_side: string | null;
  votes_for: number | null;
  votes_against: number | null;
  votes_abstain: number | null;
  event_id: string;
  event_name: string | null;
  chapter_name: string | null;
  zone: string | null;
};

export type BillPipelineReport = {
  hasData: boolean;
  totals: {
    total_bills: number;
    tagged_bills: number; // resolvable committee → ministry
    untagged_bills: number; // NULL/blank committee_name
    passed: number;
    rejected: number;
    draft: number;
    other: number;
    ministries_with_bills: number;
  };
  bills: BillPipelineRow[];
};

const EMPTY_BILL_REPORT: BillPipelineReport = {
  hasData: false,
  totals: {
    total_bills: 0,
    tagged_bills: 0,
    untagged_bills: 0,
    passed: 0,
    rejected: 0,
    draft: 0,
    other: 0,
    ministries_with_bills: 0,
  },
  bills: [],
};

// Map free-text bill.status onto the four PRD buckets. Anything unrecognised is
// "other" (never silently coerced to passed/rejected) so the tally is honest.
function bucketBillStatus(status: string | null): BillStatusBucket {
  const s = (status ?? "").toLowerCase().trim();
  if (s === "passed" || s === "approved") return "passed";
  if (s === "rejected" || s === "failed" || s === "defeated") return "rejected";
  if (s === "draft" || s === "drafting" || s === "submitted") return "draft";
  return "other";
}

export async function getBillPipeline(): Promise<BillPipelineReport> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return EMPTY_BILL_REPORT;

  const svc = await createServiceClient();

  const mapping = indexByCommittee(await getCommitteeMinistryMap());
  const scope = await loadEventScope(svc);
  if (scope.events.length === 0) return EMPTY_BILL_REPORT;
  const scopeIds = new Set(scope.events.map((e) => e.id));

  // Every bill (paged), incl. is_mock so we can filter consistently below.
  const rows = await fetchAllRows<{
    id: string;
    event_id: string | null;
    committee_name: string | null;
    party_side: string | null;
    title: string | null;
    status: string | null;
    votes_for: number | null;
    votes_against: number | null;
    votes_abstain: number | null;
    is_mock: boolean | null;
  }>((from, to) =>
    svc
      .from("bills")
      .select(
        "id, event_id, committee_name, party_side, title, status, votes_for, votes_against, votes_abstain, is_mock"
      )
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data:
        | {
            id: string;
            event_id: string | null;
            committee_name: string | null;
            party_side: string | null;
            title: string | null;
            status: string | null;
            votes_for: number | null;
            votes_against: number | null;
            votes_abstain: number | null;
            is_mock: boolean | null;
          }[]
        | null;
      error: unknown;
    }>
  );

  const bills: BillPipelineRow[] = [];
  const ministrySet = new Set<string>();
  let passed = 0;
  let rejected = 0;
  let draft = 0;
  let other = 0;
  let tagged = 0;
  let untagged = 0;

  for (const b of rows) {
    // Exclude mock + out-of-scope (e.g. a bill on a mock event) from rollups.
    if (b.is_mock === true) continue;
    if (!b.event_id || !scopeIds.has(b.event_id)) continue;

    const ev = scope.byId.get(b.event_id);
    const committeeRaw = (b.committee_name ?? "").trim();
    const isUntagged = committeeRaw.length === 0;

    let ministry: string | null = null;
    let schemes: string[] = [];
    let inTax = false;
    if (!isUntagged) {
      const m: CommitteeMinistryMapping | undefined = mapping.get(
        normalizeMinistry(committeeRaw)
      );
      ministry = m?.ministry ?? committeeRaw; // fall back to the raw committee
      schemes = m?.schemes ?? [];
      inTax = m?.in_taxonomy ?? false;
      tagged += 1;
      ministrySet.add(normalizeMinistry(ministry));
    } else {
      untagged += 1;
    }

    const bucket = bucketBillStatus(b.status);
    if (bucket === "passed") passed += 1;
    else if (bucket === "rejected") rejected += 1;
    else if (bucket === "draft") draft += 1;
    else other += 1;

    bills.push({
      bill_id: String(b.id),
      title: (b.title ?? "").trim() || "Untitled bill",
      status_raw: b.status ?? null,
      status_bucket: bucket,
      committee_name: isUntagged ? null : committeeRaw,
      ministry,
      schemes,
      in_taxonomy: inTax,
      untagged: isUntagged,
      party_side: b.party_side ?? null,
      votes_for: b.votes_for ?? null,
      votes_against: b.votes_against ?? null,
      votes_abstain: b.votes_abstain ?? null,
      event_id: String(b.event_id),
      event_name: ev?.name ?? null,
      chapter_name: ev?.chapter_name ?? null,
      zone: ev?.zone ?? ev?.yi_zone_code ?? null,
    });
  }

  // Most-recent / highest-signal first: tagged before untagged, then by title.
  bills.sort(
    (a, b) =>
      Number(a.untagged) - Number(b.untagged) ||
      a.ministry?.localeCompare(b.ministry ?? "") ||
      a.title.localeCompare(b.title)
  );

  return {
    hasData: bills.length > 0,
    totals: {
      total_bills: bills.length,
      tagged_bills: tagged,
      untagged_bills: untagged,
      passed,
      rejected,
      draft,
      other,
      ministries_with_bills: ministrySet.size,
    },
    bills,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// (4) getVerdictByMinistry — pass/reject aggregated by ministry
// ═══════════════════════════════════════════════════════════════════════
//
// Where bills exist, roll the deterministic ministry tag up to a per-ministry
// verdict: how many bills passed vs rejected vs still in draft, and the summed
// vote tally. This is the "what did young India DECIDE on each ministry"
// national view. Empty-safe: with ~2 mock bills today this returns hasData:false
// and the panel shows the "verdicts appear as committees pass bills" state.
//
// Built ON TOP of getBillPipeline so the deterministic tagging lives in exactly
// one place. Untagged bills (NULL committee_name) are excluded from per-ministry
// verdicts (we will not attribute a verdict to a ministry we cannot resolve) but
// counted in `untagged_bills` so the gap is visible.
//
// FUTURE AI HOOK: the synthesized national "verdict per scheme" narrative (free
// text summarising the deliberation) is exactly the kind of output a later LLM
// layer would generate FROM this deterministic tally — it would consume these
// numbers, not replace them. No LLM is called here.

export type MinistryVerdict = {
  ministry: string;
  schemes: string[];
  in_taxonomy: boolean;
  bills_total: number;
  passed: number;
  rejected: number;
  draft: number;
  other: number;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
};

export type VerdictByMinistryReport = {
  hasData: boolean;
  totals: {
    ministries_with_verdicts: number;
    bills_considered: number; // tagged bills only (untagged excluded here)
    untagged_bills: number; // surfaced so the gap is honest
    passed: number;
    rejected: number;
  };
  ministries: MinistryVerdict[];
};

const EMPTY_VERDICT_REPORT: VerdictByMinistryReport = {
  hasData: false,
  totals: {
    ministries_with_verdicts: 0,
    bills_considered: 0,
    untagged_bills: 0,
    passed: 0,
    rejected: 0,
  },
  ministries: [],
};

export async function getVerdictByMinistry(): Promise<VerdictByMinistryReport> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return EMPTY_VERDICT_REPORT;

  const pipeline = await getBillPipeline();
  if (!pipeline.hasData) {
    return {
      ...EMPTY_VERDICT_REPORT,
      totals: {
        ...EMPTY_VERDICT_REPORT.totals,
        untagged_bills: pipeline.totals.untagged_bills,
      },
    };
  }

  type Acc = {
    ministry: string;
    schemes: string[];
    in_taxonomy: boolean;
    bills_total: number;
    passed: number;
    rejected: number;
    draft: number;
    other: number;
    votes_for: number;
    votes_against: number;
    votes_abstain: number;
  };
  const acc = new Map<string, Acc>();

  for (const b of pipeline.bills) {
    if (b.untagged || !b.ministry) continue; // honest: no verdict without a tag
    const key = normalizeMinistry(b.ministry);
    let bucket = acc.get(key);
    if (!bucket) {
      bucket = {
        ministry: b.ministry,
        schemes: b.schemes,
        in_taxonomy: b.in_taxonomy,
        bills_total: 0,
        passed: 0,
        rejected: 0,
        draft: 0,
        other: 0,
        votes_for: 0,
        votes_against: 0,
        votes_abstain: 0,
      };
      acc.set(key, bucket);
    }
    bucket.bills_total += 1;
    if (b.status_bucket === "passed") bucket.passed += 1;
    else if (b.status_bucket === "rejected") bucket.rejected += 1;
    else if (b.status_bucket === "draft") bucket.draft += 1;
    else bucket.other += 1;
    bucket.votes_for += b.votes_for ?? 0;
    bucket.votes_against += b.votes_against ?? 0;
    bucket.votes_abstain += b.votes_abstain ?? 0;
    // Prefer the schemes/taxonomy flag from any tagged instance.
    if (b.schemes.length > 0) bucket.schemes = b.schemes;
    bucket.in_taxonomy = bucket.in_taxonomy || b.in_taxonomy;
  }

  const ministries: MinistryVerdict[] = [...acc.values()].sort(
    (a, b) =>
      b.bills_total - a.bills_total ||
      b.passed - a.passed ||
      a.ministry.localeCompare(b.ministry)
  );

  let passed = 0;
  let rejected = 0;
  let considered = 0;
  for (const m of ministries) {
    passed += m.passed;
    rejected += m.rejected;
    considered += m.bills_total;
  }

  return {
    hasData: ministries.length > 0,
    totals: {
      ministries_with_verdicts: ministries.length,
      bills_considered: considered,
      untagged_bills: pipeline.totals.untagged_bills,
      passed,
      rejected,
    },
    ministries,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// (5) getParticipationRollup — national reach headline
// ═══════════════════════════════════════════════════════════════════════
//
// The top-of-dashboard "how far has YIP reached" numbers, all from real rounds:
// distinct chapters that ran a round, total delegates, distinct schools
// represented, and zones covered. Plus an awards count from yip.results so the
// dashboard can show recognised outcomes once results are published.
//
// Empty-safe: with only draft chapters this returns small numbers / hasData
// based on whether any real delegate exists. is_mock excluded throughout.

export type ParticipationRollup = {
  hasData: boolean;
  chapters_with_round: number; // distinct chapters that ran ≥1 real round
  rounds: number; // real rounds in scope
  delegates: number; // participants on real rounds
  checked_in_day1: number; // attendance signal
  schools: number; // distinct school_name represented
  zones_covered: number; // distinct zones with ≥1 round
  zone_breakdown: { zone: string; chapters: number; delegates: number }[];
  awards_published: number; // rows in yip.results carrying an award_category
};

const EMPTY_PARTICIPATION: ParticipationRollup = {
  hasData: false,
  chapters_with_round: 0,
  rounds: 0,
  delegates: 0,
  checked_in_day1: 0,
  schools: 0,
  zones_covered: 0,
  zone_breakdown: [],
  awards_published: 0,
};

export async function getParticipationRollup(): Promise<ParticipationRollup> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return EMPTY_PARTICIPATION;

  const svc = await createServiceClient();
  const scope = await loadEventScope(svc);
  if (scope.events.length === 0) return EMPTY_PARTICIPATION;
  const scopeIds = new Set(scope.events.map((e) => e.id));

  // Participants across all events (paged), filtered to in-scope (non-mock).
  const participants = await fetchAllRows<{
    event_id: string | null;
    school_name: string | null;
    checked_in_day1: boolean | null;
    is_mock: boolean | null;
  }>((from, to) =>
    svc
      .from("participants")
      .select("event_id, school_name, checked_in_day1, is_mock")
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data:
        | {
            event_id: string | null;
            school_name: string | null;
            checked_in_day1: boolean | null;
            is_mock: boolean | null;
          }[]
        | null;
      error: unknown;
    }>
  );

  const chaptersWithDelegates = new Set<string>();
  const eventsWithDelegates = new Set<string>();
  const schools = new Set<string>();
  const zonesCovered = new Set<string>();
  let delegates = 0;
  let checkedInDay1 = 0;

  // zone → { chapters:Set, delegates:number }
  const zoneAgg = new Map<
    string,
    { chapters: Set<string>; delegates: number }
  >();

  for (const p of participants) {
    if (p.is_mock === true) continue;
    if (!p.event_id || !scopeIds.has(p.event_id)) continue;
    const ev = scope.byId.get(p.event_id);

    delegates += 1;
    if (p.checked_in_day1 === true) checkedInDay1 += 1;

    const chapterKey = chapterKeyOf(ev, p.event_id);
    chaptersWithDelegates.add(chapterKey);
    eventsWithDelegates.add(p.event_id);

    const school = (p.school_name ?? "").trim();
    if (school) schools.add(school.toLowerCase());

    const zone = (ev?.zone ?? ev?.yi_zone_code ?? "").trim();
    if (zone) {
      zonesCovered.add(zone);
      let za = zoneAgg.get(zone);
      if (!za) {
        za = { chapters: new Set<string>(), delegates: 0 };
        zoneAgg.set(zone, za);
      }
      za.chapters.add(chapterKey);
      za.delegates += 1;
    }
  }

  // Awards: rows in yip.results with a non-null award_category, scoped to real
  // events. results comfortably fits today but page for future scale.
  const resultRows = await fetchAllRows<{
    event_id: string | null;
    award_category: string | null;
  }>((from, to) =>
    svc
      .from("results")
      .select("event_id, award_category")
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data:
        | { event_id: string | null; award_category: string | null }[]
        | null;
      error: unknown;
    }>
  );

  let awards = 0;
  for (const r of resultRows) {
    if (!r.event_id || !scopeIds.has(r.event_id)) continue;
    if ((r.award_category ?? "").trim().length > 0) awards += 1;
  }

  const zone_breakdown = [...zoneAgg.entries()]
    .map(([zone, v]) => ({
      zone,
      chapters: v.chapters.size,
      delegates: v.delegates,
    }))
    .sort(
      (a, b) =>
        b.delegates - a.delegates ||
        b.chapters - a.chapters ||
        a.zone.localeCompare(b.zone)
    );

  return {
    hasData: delegates > 0,
    chapters_with_round: chaptersWithDelegates.size,
    rounds: eventsWithDelegates.size,
    delegates,
    checked_in_day1: checkedInDay1,
    schools: schools.size,
    zones_covered: zonesCovered.size,
    zone_breakdown,
    awards_published: awards,
  };
}
