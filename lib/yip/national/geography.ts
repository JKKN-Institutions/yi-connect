import "server-only";

// ═══════════════════════════════════════════════════════════════════════
// YIP NATIONAL INTELLIGENCE — GEOGRAPHIC FOOTPRINT
//
// Across all non-mock chapter rounds: which REAL Indian constituencies did
// young India represent, rolled up by state and region. The seat "number" each
// delegate carries in-room (1.. or 101..) is an internal seat id, NOT an
// official ECI number — so geography is keyed off constituency_NAME, which is a
// real Lok Sabha seat (Varanasi, Ernakulam, Baramulla…).
//
// A delegate's constituency_name is normalized and matched against the
// yip.constituencies reference (seeded from every name that has appeared in a
// real round → canonical seat + state + official Zonal-Council region). Match is
// exact on a normalized key, so it is deterministic — nothing is guessed. Names
// that don't resolve are surfaced as `unmatchedNames`, never silently dropped.
//
// Reuse contract mirrors corpus.ts: createServiceClient() (schema-pinned to
// yip), fetchAllRows() for the >1000-row PostgREST cap, requireSuperAdmin() gate
// → empty report on deny. is_mock excluded on both axes (event scope + per-row).
// ═══════════════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/yip/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";

// Denominators for the "X of Y" coverage framing. India has 28 states + 8 union
// territories (36), grouped into the 6 official Zonal Councils, across 543 Lok
// Sabha constituencies.
export const TOTAL_STATES_UTS = 36;
export const TOTAL_REGIONS = 6;
export const TOTAL_LS_SEATS = 543;

// Fixed display order for regions (geographic, not by count) so the board reads
// consistently run-to-run.
export const REGION_ORDER = [
  "North",
  "South",
  "East",
  "West",
  "Central",
  "Northeast",
] as const;

// Normalize a constituency name to the reference match key. MUST stay identical
// to the key seeded into yip.constituencies.match_key (lowercase, every run of
// non-alphanumerics → single space, trimmed). Verified against live data: this
// resolves 100% of named delegates in real rounds.
export function normalizeConstituency(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type RegionFootprint = {
  region: string;
  participants: number;
  seats: number; // distinct constituencies represented in this region
  states: number; // distinct states/UTs touched in this region
};

export type StateFootprint = {
  state: string;
  region: string;
  participants: number;
  seats: number;
};

export type GeographicFootprintReport = {
  hasData: boolean;
  totals: {
    participants: number; // named delegates matched to a real constituency
    constituencies: number; // distinct seats represented
    states: number; // distinct states/UTs represented (of 36)
    regions: number; // distinct regions represented (of 6)
    events_in_scope: number; // non-mock rounds considered
    unmatched: number; // named delegates whose seat name did not resolve
    unnamed: number; // delegates with no constituency_name at all
  };
  regions: RegionFootprint[];
  topStates: StateFootprint[];
  // Honest tail: constituency names present in the data but not in the
  // reference table — a nudge to extend the seed, never silently ignored.
  unmatchedNames: { name: string; count: number }[];
};

const EMPTY_REPORT: GeographicFootprintReport = {
  hasData: false,
  totals: {
    participants: 0,
    constituencies: 0,
    states: 0,
    regions: 0,
    events_in_scope: 0,
    unmatched: 0,
    unnamed: 0,
  },
  regions: [],
  topStates: [],
  unmatchedNames: [],
};

type RefRow = {
  match_key: string | null;
  name: string | null;
  state: string | null;
  region: string | null;
};

/**
 * National geographic footprint across all non-mock chapter rounds.
 *
 * Resolves each delegate's constituency_name → a real constituency (state +
 * region) via the yip.constituencies reference, and rolls up distinct seats /
 * states / regions represented plus per-region and top-state breakdowns.
 *
 * Super-admin only; returns hasData:false on deny OR when no real round has any
 * named, resolvable delegate yet.
 */
export async function getGeographicFootprint(): Promise<GeographicFootprintReport> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return EMPTY_REPORT;

  const svc = await createServiceClient();

  // Reference: normalized name → { canonical name, state, region }.
  const refRows = await fetchAllRows<RefRow>((from, to) =>
    svc
      .from("constituencies")
      .select("match_key, name, state, region")
      .order("match_key", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: RefRow[] | null;
      error: unknown;
    }>
  );
  const ref = new Map<string, { name: string; state: string; region: string }>();
  for (const r of refRows) {
    if (!r.match_key || !r.state || !r.region) continue;
    ref.set(r.match_key, {
      name: r.name ?? r.match_key,
      state: r.state,
      region: r.region,
    });
  }
  // No reference seeded → nothing to map against.
  if (ref.size === 0) return EMPTY_REPORT;

  // Non-mock event scope (small today, paged so it never silently truncates).
  const eventRows = await fetchAllRows<{ id: string; is_mock: boolean | null }>(
    (from, to) =>
      svc
        .from("events")
        .select("id, is_mock")
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: { id: string; is_mock: boolean | null }[] | null;
        error: unknown;
      }>
  );
  const scopeIds = new Set(
    eventRows.filter((e) => e.is_mock !== true).map((e) => String(e.id))
  );
  if (scopeIds.size === 0) return EMPTY_REPORT;

  // Delegates across all events (paged), filtered to the non-mock scope.
  const participants = await fetchAllRows<{
    event_id: string | null;
    constituency_name: string | null;
    is_mock: boolean | null;
  }>((from, to) =>
    svc
      .from("participants")
      .select("event_id, constituency_name, is_mock")
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: {
        event_id: string | null;
        constituency_name: string | null;
        is_mock: boolean | null;
      }[] | null;
      error: unknown;
    }>
  );

  type RegionAcc = {
    participants: number;
    seats: Set<string>;
    states: Set<string>;
  };
  type StateAcc = { region: string; participants: number; seats: Set<string> };
  const regionAcc = new Map<string, RegionAcc>();
  const stateAcc = new Map<string, StateAcc>();
  const unmatched = new Map<string, number>();
  const allSeats = new Set<string>();
  const allStates = new Set<string>();
  let matched = 0;
  let unmatchedCount = 0;
  let unnamed = 0;

  for (const p of participants) {
    if (p.is_mock === true) continue;
    if (!p.event_id || !scopeIds.has(String(p.event_id))) continue;
    const raw = (p.constituency_name ?? "").trim();
    if (!raw) {
      unnamed += 1;
      continue;
    }
    const hit = ref.get(normalizeConstituency(raw));
    if (!hit) {
      unmatchedCount += 1;
      unmatched.set(raw, (unmatched.get(raw) ?? 0) + 1);
      continue;
    }
    matched += 1;
    const seatKey = `${hit.state}::${hit.name}`;
    allSeats.add(seatKey);
    allStates.add(hit.state);

    let ra = regionAcc.get(hit.region);
    if (!ra) {
      ra = { participants: 0, seats: new Set(), states: new Set() };
      regionAcc.set(hit.region, ra);
    }
    ra.participants += 1;
    ra.seats.add(seatKey);
    ra.states.add(hit.state);

    let sa = stateAcc.get(hit.state);
    if (!sa) {
      sa = { region: hit.region, participants: 0, seats: new Set() };
      stateAcc.set(hit.state, sa);
    }
    sa.participants += 1;
    sa.seats.add(seatKey);
  }

  const regions: RegionFootprint[] = [...regionAcc.entries()]
    .map(([region, a]) => ({
      region,
      participants: a.participants,
      seats: a.seats.size,
      states: a.states.size,
    }))
    .sort(
      (a, b) =>
        REGION_ORDER.indexOf(a.region as (typeof REGION_ORDER)[number]) -
        REGION_ORDER.indexOf(b.region as (typeof REGION_ORDER)[number])
    );

  const topStates: StateFootprint[] = [...stateAcc.entries()]
    .map(([state, a]) => ({
      state,
      region: a.region,
      participants: a.participants,
      seats: a.seats.size,
    }))
    .sort(
      (a, b) => b.participants - a.participants || a.state.localeCompare(b.state)
    );

  const unmatchedNames = [...unmatched.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    hasData: matched > 0,
    totals: {
      participants: matched,
      constituencies: allSeats.size,
      states: allStates.size,
      regions: regionAcc.size,
      events_in_scope: scopeIds.size,
      unmatched: unmatchedCount,
      unnamed,
    },
    regions,
    topStates,
    unmatchedNames,
  };
}
