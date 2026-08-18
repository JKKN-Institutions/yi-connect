"use server";

/**
 * Position-Bonus server actions (Phase 18 / F3).
 *
 * Reads the singleton `yip.position_bonus_config` row and groups event
 * participants by their `parliament_role` so the Control Panel can show
 * who currently holds each key position and what bonus the jury will
 * award for that role.
 *
 * Re-uses `setParliamentRole` from `./participants.ts` for write paths —
 * do NOT reimplement role-assignment here.
 */

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { effectiveMinistries } from "@/lib/yip/cabinet";
import {
  isMissingMinistryArraysError,
  participantPortfolios,
} from "@/lib/yip/ministries";
import { fetchParticipantMinistryState } from "@/lib/yip/ministries-server";
import { revalidatePath } from "next/cache";
import {
  normaliseRoundLevels,
  scopeAppliesToLevel,
  describeRoundLevels,
  type RoundLevel,
} from "@/lib/yip/round-level";
import type { Database } from "@/types/yip/database";

type ParliamentRole = Database["public"]["Enums"]["parliament_role"];

// ─── Types ─────────────────────────────────────────────────────────

export interface PositionBonusConfig {
  bonuses: Record<string, number>;
}

/**
 * One LEVEL-SCOPED merit table (a row of yip.position_bonus_config_levels).
 *
 * Each row is a COMPLETE role -> points dictionary for the rounds it names, not
 * a patch over the global one: resolution never mixes the two tiers. See
 * supabase/migrations/yip_position_bonus_config_round_level.sql.
 */
export type PositionBonusScope = {
  id: string;
  levels: RoundLevel[];
  bonuses: Record<string, number>;
  updated_at: string | null;
};

export interface PositionParticipant {
  id: string;
  full_name: string;
  party_side: string | null;
  /**
   * ALL ministry LABELS this member currently holds (multi-ministry model).
   * Only populated by getCommitteeMinisters; other cards omit it.
   */
  portfolios?: string[];
}

export interface PositionRoleGroup {
  role: ParliamentRole;
  label: string;
  bonus: number;
  participants: PositionParticipant[];
}

// committee_chair is committee-SCOPED (one chair per committee), unlike the
// event-wide KEY_ROLES. It gets its own committee-wise card instead of a flat
// tile, so the organiser sees and assigns a chair per committee.
// A committee member in the chair picker — carries constituency so the organiser
// can identify people by their canonical constituency number/name, not just the
// display name (multiple participants can share a name).
export interface CommitteeChairMember {
  id: string;
  full_name: string;
  party_side: string | null;
  constituency_number: number | null;
  constituency_name: string | null;
}

export interface CommitteeChairRow {
  committee: string;
  /** Current chair(s) for this committee (normally 0 or 1). */
  chairs: CommitteeChairMember[];
  /** Everyone on this committee — the pool eligible to be made its chair. */
  members: CommitteeChairMember[];
}

export interface CommitteeChairsData {
  /** The committee_chair jury bonus (true live value via the admin reader). */
  bonus: number;
  committees: CommitteeChairRow[];
}

// Cabinet / Shadow ministers come in two flavours depending on the event:
//  • PORTFOLIO mode (the event configured its cabinet on the Cabinet tab) — one
//    row per CHOSEN MINISTRY; pools are the whole ruling/opposition bench (a
//    minister need not sit in any matching committee). `committee` holds the
//    ministry label; the holder's portfolio is stored in participants.cabinet_portfolio.
//  • COMMITTEE mode (no cabinet configured) — one row per committee, pools
//    restricted to that committee's members. Legacy behaviour, unchanged.
export interface CommitteeMinisterRow {
  /** Ministry label (portfolio mode) or committee name (committee mode). */
  committee: string;
  /** Current cabinet minister(s) for this ministry/committee (normally 0 or 1). */
  cabinet: PositionParticipant[];
  /** Current shadow minister(s) for this ministry/committee (normally 0 or 1). */
  shadow: PositionParticipant[];
  /** Members eligible to be Cabinet Minister (ruling bench). */
  rulingMembers: PositionParticipant[];
  /** Members eligible to be Shadow Minister (opposition bench). */
  oppositionMembers: PositionParticipant[];
}

export interface CommitteeMinistersData {
  /** Cabinet Minister jury bonus (true live value via the admin reader). */
  cabinetBonus: number;
  /** Shadow Minister jury bonus (true live value via the admin reader). */
  shadowBonus: number;
  /** True when rows are the chapter's chosen ministries (Cabinet tab), not committees. */
  portfolioMode: boolean;
  committees: CommitteeMinisterRow[];
}

// ─── Display order + labels for the single-seat "key" roles ──────────
// Cabinet Minister / Shadow Minister are NOT here — they are committee-SCOPED
// (one cabinet minister from the ruling bench and one shadow minister from the
// opposition bench, per committee), so they get their own committee-wise card
// (getCommitteeMinisters) just like committee_chair. "Member of Parliament" is
// intentionally omitted — it's the default role, not a key position.

const KEY_ROLES: { role: ParliamentRole; label: string }[] = [
  { role: "prime_minister", label: "Prime Minister" },
  { role: "deputy_prime_minister", label: "Deputy Prime Minister" },
  { role: "speaker", label: "Speaker" },
  { role: "deputy_speaker", label: "Deputy Speaker" },
  { role: "leader_of_opposition", label: "Leader of Opposition" },
  // coalition_leader is a plain event-wide leadership role (no per-party link),
  // so it assigns cleanly through setParliamentRole like the others above.
  { role: "coalition_leader", label: "Coalition Leader" },
  // 2026 Regional Round. deputy_minister is a junior government role (ordinary
  // participant — votes and joins committees normally). The two duty officials
  // are announced at Oath and shown here, but are NOT scored, NOT voters and
  // NOT committee-allocatable (OFFICIAL_DUTY_ROLES in lib/yip/constants.ts).
  // None of the three carries a bonus unless position_bonus_config adds one —
  // absent config the card correctly shows +0.
  { role: "deputy_minister", label: "Deputy Minister" },
  { role: "parliamentary_administrator", label: "Parliamentary Administrator" },
  { role: "parliamentary_journalist", label: "Parliamentary Journalist" },
];

// Members already holding a points-bearing senior post are not offered as a
// party-leader candidate on the Positions tab (making them party leader would
// overwrite that post and strip its points). Mirrors the Parties-tab picker.
const SENIOR_POSITION_ROLES = new Set<string>([
  "speaker",
  "nominated_speaker",
  "deputy_speaker",
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
  "cabinet_minister",
  "shadow_minister",
  "coalition_leader",
  "committee_chair",
  "committee_drafter",
  "committee_presenter",
  "ex_prime_minister",
  "ex_deputy_prime_minister",
  "ex_speaker",
  "ex_deputy_speaker",
  "ex_leader_of_opposition",
  // Duty officials aren't competing MPs — never offered as party-leader
  // candidates. (deputy_minister is deliberately NOT here: like a plain MP it
  // may be promoted to party leader by the organiser.)
  "parliamentary_administrator",
  "parliamentary_journalist",
]);

// ─── Actions ───────────────────────────────────────────────────────

export async function getPositionBonusConfig(): Promise<PositionBonusConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("position_bonus_config")
    .select("bonuses")
    .eq("id", true)
    .single();

  if (error || !data) {
    // Fall back to handbook defaults so UI never blanks on a missing row.
    return {
      bonuses: {
        prime_minister: 5,
        speaker: 3,
        deputy_speaker: 2,
        leader_of_opposition: 3,
        cabinet_minister: 2,
        mp: 0,
      },
    };
  }

  // `bonuses` is JSONB — coerce to Record<string, number>.
  const raw = data.bonuses as Record<string, unknown>;
  const bonuses: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    bonuses[k] = typeof v === "number" ? v : Number(v) || 0;
  }
  return { bonuses };
}

function coerceBonuses(raw: unknown): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const [k, v] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    bonuses[k] = typeof v === "number" ? v : Number(v) || 0;
  }
  return bonuses;
}

// Service-client read of the SAME merit config. position_bonus_config has RLS
// enabled with no authenticated policy, so getPositionBonusConfig() (anon/auth
// client) silently falls back to defaults — wrong values, and a save would
// overwrite the real config. Admin EDIT screens must use this so the editor
// shows and writes the true live values.
//
// ROUND LEVEL (2026-08). `level` selects the merit table that SCORES a round at
// that level: a row of yip.position_bonus_config_levels covering it if one
// exists, otherwise the global singleton. The tiers are never merged — a scoped
// row is a complete merit table, so a role it omits is worth 0 at that level,
// which is the point (a chapter round has no Parliamentary Journalist).
//
// Omitting `level` — which is what every existing caller does — returns the
// GLOBAL table only. That is fail-safe in both directions: the overlay table
// ships empty, so today the answer is byte-identical to before; and once a
// scope exists, a caller that has not yet been taught about levels keeps using
// the global table it was written against rather than silently picking up
// another level's merit values.
export async function getPositionBonusConfigAdmin(
  level?: RoundLevel | null
): Promise<PositionBonusConfig> {
  const supabase = await createServiceClient();

  if (level) {
    const scoped = await readPositionBonusScopes(supabase);
    const hit = scoped.find((s) => scopeAppliesToLevel(s.levels, level));
    if (hit) return { bonuses: hit.bonuses };
  }

  const { data } = await supabase
    .from("position_bonus_config")
    .select("bonuses")
    .eq("id", true)
    .maybeSingle();
  return { bonuses: coerceBonuses(data?.bonuses) };
}

// yip.position_bonus_config_levels is newer than the generated Database types,
// so it is read through an untyped client view (rows are coerced here).
async function readPositionBonusScopes(
  supabase: Awaited<ReturnType<typeof createServiceClient>>
): Promise<PositionBonusScope[]> {
  const { data } = await (
    supabase as unknown as {
      from: (n: string) => {
        select: (c: string) => Promise<{ data: unknown[] | null }>;
      };
    }
  )
    .from("position_bonus_config_levels")
    .select("id, levels, bonuses, updated_at");

  const rows: PositionBonusScope[] = [];
  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const levels = normaliseRoundLevels(raw.levels);
    // A row here exists BECAUSE it is scoped; a NULL/empty scope would be a
    // second spelling of the global singleton, so skip it rather than let it
    // masquerade as an override.
    if (!levels) continue;
    rows.push({
      id: String(raw.id),
      levels,
      bonuses: coerceBonuses(raw.bonuses),
      updated_at: (raw.updated_at as string | null) ?? null,
    });
  }
  return rows;
}

/** Every level-scoped merit table, for the admin screens. Super-admin only. */
export async function listPositionBonusScopes(): Promise<PositionBonusScope[]> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return [];
  const supabase = await createServiceClient();
  return readPositionBonusScopes(supabase);
}

// Create or update ONE level-scoped merit table. Super-admin only.
//
// Identity is the row `id`; when none is given the row covering this exact
// scope is updated, else a new one is created. A NEW scope is seeded from the
// GLOBAL table first and the caller's keys laid over it, so an admin who scopes
// "regional" and edits two roles does not silently zero every other role — the
// tiers are not merged at read time, so the copy has to be complete at write
// time.
export async function upsertPositionBonusScope(input: {
  id?: string;
  levels: string[];
  bonuses: Record<string, number>;
}): Promise<{ success: true; data: PositionBonusScope } | { success: false; error: string }> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const levels = normaliseRoundLevels(input.levels);
  if (!levels) {
    return {
      success: false,
      error:
        "Pick at least one round level. To change every round, edit the shared merit points instead.",
    };
  }

  // Same 0–10 range the global writer enforces — the security boundary, since
  // the client check can be bypassed.
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.bonuses ?? {})) {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      return { success: false, error: `Bonus for "${k}" must be a number.` };
    }
    if (n < 0 || n > 10) {
      return {
        success: false,
        error: `Leadership bonuses must be between 0 and 10 — got ${n} for "${k}".`,
      };
    }
    clean[k] = n;
  }

  const supabase = await createServiceClient();
  const existingScopes = await readPositionBonusScopes(supabase);

  const target =
    (input.id
      ? existingScopes.find((s) => s.id === input.id)
      : existingScopes.find(
          (s) => describeRoundLevels(s.levels) === describeRoundLevels(levels)
        )) ?? null;

  // Two scoped tables must not both claim a level — resolution would be
  // ambiguous. The global table never conflicts: it is the documented fallback.
  const clash = existingScopes.find(
    (s) =>
      s.id !== target?.id && s.levels.some((l) => levels.includes(l))
  );
  if (clash) {
    return {
      success: false,
      error: `Another merit table already covers ${describeRoundLevels(
        clash.levels
      )}. Change the rounds this one applies to, or edit that one instead.`,
    };
  }

  // Start from the row's own prior values when editing (the three admin screens
  // each own a different subset of role keys, so a save must never drop a key
  // it did not list) and from the GLOBAL table when creating.
  const base = target
    ? target.bonuses
    : (await getPositionBonusConfigAdmin()).bonuses;
  const merged = { ...base, ...clean };

  const db = supabase as unknown as {
    from: (n: string) => {
      update: (v: Record<string, unknown>) => {
        eq: (
          k: string,
          v: string
        ) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
      };
      insert: (v: Record<string, unknown>) => {
        select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
  };

  const values = {
    levels,
    bonuses: merged,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = target
    ? await db
        .from("position_bonus_config_levels")
        .update(values)
        .eq("id", target.id)
        .select("id, levels, bonuses, updated_at")
    : await db
        .from("position_bonus_config_levels")
        .insert(values)
        .select("id, levels, bonuses, updated_at");

  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (error || !row) {
    return { success: false, error: error?.message ?? "Failed to save merit points" };
  }

  revalidatePath("/dashboard/admin/scoring-rules");
  revalidatePath("/dashboard/admin/scoring-framework");
  revalidatePath("/dashboard/admin/scoring-config");
  return {
    success: true,
    data: {
      id: String(row.id),
      levels: normaliseRoundLevels(row.levels) ?? levels,
      bonuses: coerceBonuses(row.bonuses),
      updated_at: (row.updated_at as string | null) ?? null,
    },
  };
}

// Remove ONE level-scoped merit table. Those rounds fall back to the shared
// (global) merit points, which is where they were before the scope existed.
export async function deletePositionBonusScope(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "No merit table was specified" };

  const supabase = await createServiceClient();
  const { error } = await (
    supabase as unknown as {
      from: (n: string) => {
        delete: () => {
          eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("position_bonus_config_levels")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/scoring-rules");
  revalidatePath("/dashboard/admin/scoring-framework");
  revalidatePath("/dashboard/admin/scoring-config");
  return { success: true };
}

export async function getParticipantsByRole(
  eventId: string
): Promise<PositionRoleGroup[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const [{ bonuses }, participantsRes] = await Promise.all([
    // Service-client read: the anon getPositionBonusConfig() RLS-falls-back to a
    // partial defaults dict (0 for committee_chair / deputy_pm / shadow_minister),
    // so the card would show "+0 bonus" for roles that actually earn points. Use
    // the admin reader so the displayed bonus matches what the jury awards.
    getPositionBonusConfigAdmin(),
    supabase
      .from("participants")
      .select("id, full_name, party_side, parliament_role")
      .eq("event_id", eventId)
      .order("full_name"),
  ]);

  const participants = participantsRes.data ?? [];

  return KEY_ROLES.map(({ role, label }) => ({
    role,
    label,
    bonus: bonuses[role] ?? 0,
    participants: participants
      .filter((p) => p.parliament_role === role)
      .map((p) => ({
        id: p.id,
        full_name: p.full_name,
        party_side: p.party_side,
      })),
  }));
}

// ─── Party leaders (Positions tab, per-party) ────────────────────────
// party_leader is PARTY-scoped (one per party) and carries a second field —
// parties.party_leader_id — so it can't ride the flat KEY_ROLES card. Like
// committee_chair it gets a per-party card, and its writes route through
// electPartyLeader / clearPartyLeader (parties.ts) which keep party_leader_id
// and parliament_role in sync + demote the outgoing leader.

export type PartyLeaderMember = {
  id: string;
  full_name: string;
  party_side: string | null;
  constituency_number: number | null;
  constituency_name: string | null;
};

export type PartyLeaderRow = {
  partyId: string;
  partyName: string;
  partyNumber: number;
  side: string | null;
  leader: PartyLeaderMember | null;
  // Party members eligible to be made leader: excludes anyone already holding a
  // points-bearing senior post (and the current leader is handled in the UI).
  eligibleMembers: PartyLeaderMember[];
};

export type PartyLeadersData = { bonus: number; parties: PartyLeaderRow[] };

/**
 * Per-party leaders for the Positions tab. Reads the party's party_leader_id as
 * the source of truth for who leads it (kept in sync with parliament_role by
 * electPartyLeader / clearPartyLeader and the reveal reconciliation).
 */
export async function getPartyLeaders(
  eventId: string
): Promise<PartyLeadersData> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return { bonus: 0, parties: [] };

  const supabase = await createServiceClient();
  const [{ bonuses }, partiesRes, participantsRes] = await Promise.all([
    getPositionBonusConfigAdmin(),
    supabase
      .from("parties")
      .select("id, name, party_number, side, party_leader_id")
      .eq("event_id", eventId)
      .order("party_number", { ascending: true }),
    supabase
      .from("participants")
      .select(
        "id, full_name, party_side, parliament_role, party_id, constituency_number, constituency_name"
      )
      .eq("event_id", eventId)
      .order("constituency_number", { nullsFirst: false })
      .order("full_name"),
  ]);

  const bonus = bonuses["party_leader"] ?? 0;
  const parts = participantsRes.data ?? [];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const byParty = new Map<string, typeof parts>();
  for (const p of parts) {
    if (!p.party_id) continue;
    const list = byParty.get(p.party_id);
    if (list) list.push(p);
    else byParty.set(p.party_id, [p]);
  }

  const toMember = (p: (typeof parts)[number]): PartyLeaderMember => ({
    id: p.id,
    full_name: p.full_name,
    party_side: p.party_side,
    constituency_number: p.constituency_number,
    constituency_name: p.constituency_name,
  });

  const parties: PartyLeaderRow[] = (partiesRes.data ?? []).map((party) => {
    const members = byParty.get(party.id) ?? [];
    const leaderP = party.party_leader_id
      ? byId.get(party.party_leader_id)
      : null;
    // Only surface a leader whose role is ACTUALLY party_leader. If
    // party_leader_id still points to someone who has since moved to a senior
    // post (PM / minister / …), the party-leader seat is effectively vacant —
    // show it as assignable rather than mislabel a PM as "Party Leader (+6)".
    const activeLeader =
      leaderP && leaderP.parliament_role === "party_leader" ? leaderP : null;
    return {
      partyId: party.id,
      partyName: party.name,
      partyNumber: party.party_number,
      side: party.side,
      leader: activeLeader ? toMember(activeLeader) : null,
      eligibleMembers: members
        .filter((m) => !SENIOR_POSITION_ROLES.has(m.parliament_role ?? ""))
        .map(toMember),
    };
  });

  return { bonus, parties };
}

/**
 * Committee-wise chairs for the Positions tab. committee_chair is committee-
 * scoped (one chair per committee), so this returns one row per committee —
 * derived from the committees that actually have members — with its current
 * chair(s) and the full member pool eligible to be made chair. Reuses
 * setParliamentRole for the write: that sets only parliament_role and leaves
 * committee_name intact, so making a committee's own member a committee_chair
 * makes them that committee's chair (isChair = role===committee_chair &&
 * committee_name===room → needsChair flips false, bill editing unlocks).
 */
export async function getCommitteeChairs(
  eventId: string
): Promise<CommitteeChairsData> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return { bonus: 0, committees: [] };

  const supabase = await createServiceClient();
  const [{ bonuses }, participantsRes] = await Promise.all([
    // Admin (service-client) reader — the anon reader RLS-falls-back to defaults
    // that omit committee_chair, which would show "+0" for a role that earns +2.
    getPositionBonusConfigAdmin(),
    supabase
      .from("participants")
      .select(
        "id, full_name, party_side, parliament_role, committee_name, constituency_number, constituency_name"
      )
      .eq("event_id", eventId)
      .not("committee_name", "is", null)
      // Order by the canonical constituency number (nulls last), then name, so the
      // picker reads in constituency order.
      .order("constituency_number", { nullsFirst: false })
      .order("full_name"),
  ]);

  const bonus = bonuses["committee_chair"] ?? 0;

  type Member = CommitteeChairMember & {
    parliament_role: ParliamentRole | null;
  };
  const byCommittee = new Map<string, Member[]>();
  for (const p of participantsRes.data ?? []) {
    const committee = (p.committee_name ?? "").trim();
    if (!committee) continue;
    const m: Member = {
      id: p.id,
      full_name: p.full_name,
      party_side: p.party_side,
      constituency_number: p.constituency_number,
      constituency_name: p.constituency_name,
      parliament_role: p.parliament_role,
    };
    const list = byCommittee.get(committee);
    if (list) list.push(m);
    else byCommittee.set(committee, [m]);
  }

  const toMember = ({
    id,
    full_name,
    party_side,
    constituency_number,
    constituency_name,
  }: Member): CommitteeChairMember => ({
    id,
    full_name,
    party_side,
    constituency_number,
    constituency_name,
  });

  const committees: CommitteeChairRow[] = [...byCommittee.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([committee, members]) => ({
      committee,
      chairs: members
        .filter((m) => m.parliament_role === "committee_chair")
        .map(toMember),
      members: members.map(toMember),
    }));

  return { bonus, committees };
}

/**
 * Committee-wise Cabinet & Shadow ministers for the Positions tab. Mirrors
 * getCommitteeChairs, but each committee has two bench-restricted seats: the
 * Cabinet Minister is picked from the committee's RULING members and the Shadow
 * Minister from its OPPOSITION members. Writes reuse setParliamentRole (sets only
 * parliament_role; committee_name is untouched), so making a committee's own
 * ruling member a cabinet_minister makes them that committee's cabinet minister.
 */
export async function getCommitteeMinisters(
  eventId: string
): Promise<CommitteeMinistersData> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView)
    return { cabinetBonus: 0, shadowBonus: 0, portfolioMode: false, committees: [] };

  const supabase = await createServiceClient();
  const [{ bonuses }, participantsRes, eventRes] = await Promise.all([
    // Admin (service-client) reader — the anon reader RLS-falls-back to defaults
    // that omit shadow_minister, which would show "+0" for a role that earns points.
    getPositionBonusConfigAdmin(),
    // No committee_name filter — portfolio-mode pools span the whole bench, so we
    // need every participant; committee-mode grouping skips null committees below.
    // cabinet_portfolio + the multi-ministry arrays are newer columns not in the
    // generated types, hence the loose builder cast (the reads are plain text).
    // GRACEFUL DEGRADATION: the array columns may not exist yet (migration not
    // applied) — on that specific failure retry without them.
    (async () => {
      const select = (cols: string) =>
        (supabase.from("participants") as ReturnType<typeof supabase.from>)
          .select(cols)
          .eq("event_id", eventId)
          .order("full_name");
      let res = await select(
        "id, full_name, party_side, parliament_role, committee_name, cabinet_portfolio, cabinet_portfolios"
      );
      if (res.error && isMissingMinistryArraysError(res.error)) {
        res = await select(
          "id, full_name, party_side, parliament_role, committee_name, cabinet_portfolio"
        );
      }
      return res;
    })(),
    supabase
      .from("events")
      .select("cabinet_ministries")
      .eq("id", eventId)
      .single(),
  ]);

  const cabinetBonus = bonuses["cabinet_minister"] ?? 0;
  const shadowBonus = bonuses["shadow_minister"] ?? 0;

  type Member = {
    id: string;
    full_name: string;
    party_side: string | null;
    parliament_role: ParliamentRole | null;
    committee_name: string | null;
    cabinet_portfolio: string | null;
    cabinet_portfolios?: (string | null)[] | null;
  };
  const all = (participantsRes.data ?? []) as unknown as Member[];

  const strip = (m: Member): PositionParticipant => ({
    id: m.id,
    full_name: m.full_name,
    party_side: m.party_side,
    portfolios: participantPortfolios(m),
  });

  const cabinetJson = eventRes.data?.cabinet_ministries ?? null;
  const portfolioMode = Array.isArray(cabinetJson) && cabinetJson.length > 0;

  let committees: CommitteeMinisterRow[];

  if (portfolioMode) {
    // One row per chosen ministry (in the chapter's chosen order). MULTI-
    // MINISTRY model: a member may hold SEVERAL portfolios, so a minister is
    // listed under EVERY ministry label in their set (cabinet_portfolios array,
    // falling back to the single cabinet_portfolio pre-migration). Pools are
    // the whole ruling/opposition bench — a sitting minister may be given an
    // ADDITIONAL ministry (the card excludes this row's current holders).
    const labels = effectiveMinistries(cabinetJson).map((m) => m.label.trim());

    committees = labels.map((label) => {
      const cabinet = all.filter(
        (m) =>
          m.parliament_role === "cabinet_minister" &&
          participantPortfolios(m).includes(label)
      );
      const shadow = all.filter(
        (m) =>
          m.parliament_role === "shadow_minister" &&
          participantPortfolios(m).includes(label)
      );
      const rulingMembers = all.filter((m) => m.party_side === "ruling");
      const oppositionMembers = all.filter(
        (m) => m.party_side === "opposition"
      );
      return {
        committee: label,
        cabinet: cabinet.map(strip),
        shadow: shadow.map(strip),
        rulingMembers: rulingMembers.map(strip),
        oppositionMembers: oppositionMembers.map(strip),
      };
    });
  } else {
    // Legacy committee mode — one row per committee, pools restricted to that
    // committee's members. Unchanged from before the portfolio model.
    const byCommittee = new Map<string, Member[]>();
    for (const m of all) {
      const committee = (m.committee_name ?? "").trim();
      if (!committee) continue;
      const list = byCommittee.get(committee);
      if (list) list.push(m);
      else byCommittee.set(committee, [m]);
    }
    committees = [...byCommittee.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([committee, members]) => ({
        committee,
        cabinet: members
          .filter((m) => m.parliament_role === "cabinet_minister")
          .map(strip),
        shadow: members
          .filter((m) => m.parliament_role === "shadow_minister")
          .map(strip),
        rulingMembers: members
          .filter((m) => m.party_side === "ruling")
          .map(strip),
        oppositionMembers: members
          .filter((m) => m.party_side === "opposition")
          .map(strip),
      }));
  }

  return { cabinetBonus, shadowBonus, portfolioMode, committees };
}

/**
 * Assign a participant a ministry portfolio (Cabinet or Shadow Minister) in the
 * portfolio-based cabinet model. MULTI-MINISTRY: this is ADD-TO-SET — the
 * ministry key+label are APPENDED to participants.ministries /
 * cabinet_portfolios (no-op if already held); the FIRST ministry also fills the
 * legacy single columns (ministry / cabinet_portfolio = the PRIMARY), which
 * legacy readers keep using. parliament_role is set to the seat's role.
 * Bench is enforced: Cabinet Minister must be ruling, Shadow Minister opposition.
 * Organiser-gated (canManage).
 *
 * GRACEFUL DEGRADATION: before the migration lands the array columns don't
 * exist — the write falls back to the legacy single-column overwrite.
 */
export async function setCabinetPortfolio(input: {
  eventId: string;
  participantId: string;
  ministry: string;
  seat: "cabinet" | "shadow";
}): Promise<{ success: boolean; error?: string }> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const ministry = input.ministry.trim();
  if (!ministry) return { success: false, error: "Missing ministry" };

  const supabase = await createServiceClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id, party_side")
    .eq("id", input.participantId)
    .eq("event_id", input.eventId)
    .single();
  if (!participant) return { success: false, error: "Participant not found" };

  const wantSide = input.seat === "cabinet" ? "ruling" : "opposition";
  if (participant.party_side !== wantSide) {
    return {
      success: false,
      error:
        input.seat === "cabinet"
          ? "Cabinet Ministers must be from the ruling bench."
          : "Shadow Ministers must be from the opposition bench.",
    };
  }

  const role = input.seat === "cabinet" ? "cabinet_minister" : "shadow_minister";

  // Resolve the chosen ministry LABEL to its per-event cabinet KEY and store it
  // in participants.ministry/ministries too. The Minister + Shadow desks
  // (ministry.ts / shadow.ts) route Question-Hour questions by the cabinet KEY a
  // question is directed to — so without this, a portfolio-assigned minister
  // would never see their questions. FAIL CLOSED: an unresolvable label is
  // rejected (a keyless entry can't route AND would break the index alignment
  // between the ministries/cabinet_portfolios arrays).
  const { data: eventRow } = await supabase
    .from("events")
    .select("cabinet_ministries")
    .eq("id", input.eventId)
    .single();
  const ministryKey =
    effectiveMinistries(eventRow?.cabinet_ministries ?? null).find(
      (m) => m.label.trim() === ministry
    )?.key ?? null;
  if (!ministryKey) {
    return {
      success: false,
      error: "That ministry isn't part of this event's cabinet.",
    };
  }

  // Legacy single-column overwrite — the pre-migration behaviour and the
  // fallback when the array columns don't exist yet.
  const legacyUpdate = () =>
    (supabase.from("participants") as ReturnType<typeof supabase.from>)
      .update({
        parliament_role: role,
        cabinet_portfolio: ministry,
        ministry: ministryKey,
      })
      .eq("id", input.participantId);

  const state = await fetchParticipantMinistryState(
    supabase,
    input.participantId,
    input.eventId
  );

  let error: { message: string } | null = null;
  if (!state || state.degraded) {
    ({ error } = await legacyUpdate());
  } else {
    const keys = [...state.keys];
    const labels = [...state.labels];
    const idx = keys.indexOf(ministryKey);
    if (idx >= 0) {
      labels[idx] = ministry; // already held — just refresh the label slot
    } else {
      keys.push(ministryKey);
      labels.push(ministry);
    }
    const res = await (
      supabase.from("participants") as ReturnType<typeof supabase.from>
    )
      .update({
        parliament_role: role,
        // Single columns always mirror the PRIMARY (first array element).
        ministry: keys[0],
        cabinet_portfolio: labels[0],
        ministries: keys,
        cabinet_portfolios: labels,
      })
      .eq("id", input.participantId);
    error = res.error;
    if (error && isMissingMinistryArraysError(error)) {
      ({ error } = await legacyUpdate());
    }
  }
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/positions`);
  return { success: true };
}

/**
 * Remove ONE ministry from a participant's set (by its label — the Positions
 * grid row). If the removed ministry was the PRIMARY, the next array element is
 * promoted into the single columns; removing the LAST ministry resets
 * parliament_role to plain MP. Organiser-gated (canManage).
 *
 * GRACEFUL DEGRADATION: pre-migration there is only the single ministry, so a
 * matching remove behaves exactly like clearCabinetPortfolio.
 */
export async function removeCabinetPortfolio(input: {
  eventId: string;
  participantId: string;
  /** Ministry LABEL to remove (a KEY is also accepted). */
  ministry: string;
}): Promise<{ success: boolean; error?: string }> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const target = input.ministry.trim();
  if (!target) return { success: false, error: "Missing ministry" };

  const supabase = await createServiceClient();
  const state = await fetchParticipantMinistryState(
    supabase,
    input.participantId,
    input.eventId
  );
  if (!state) return { success: false, error: "Participant not found" };

  // Full clear — also the degraded-mode path (single-ministry world).
  const legacyClear = () =>
    (supabase.from("participants") as ReturnType<typeof supabase.from>)
      .update({ parliament_role: "mp", cabinet_portfolio: null, ministry: null })
      .eq("id", input.participantId)
      .eq("event_id", input.eventId);

  let error: { message: string } | null = null;

  if (state.degraded) {
    const holds =
      (state.cabinet_portfolio ?? "").trim() === target ||
      state.ministry === target;
    if (!holds) {
      return {
        success: false,
        error: "This participant doesn't hold that ministry.",
      };
    }
    ({ error } = await legacyClear());
  } else {
    const idx = state.labels.findIndex((l) => (l ?? "").trim() === target);
    const at = idx >= 0 ? idx : state.keys.indexOf(target);
    if (at < 0) {
      return {
        success: false,
        error: "This participant doesn't hold that ministry.",
      };
    }
    const keys = [...state.keys];
    const labels = [...state.labels];
    keys.splice(at, 1);
    labels.splice(at, 1);

    const res = await (
      supabase.from("participants") as ReturnType<typeof supabase.from>
    )
      .update(
        keys.length === 0
          ? {
              // Last ministry removed — back to plain MP, clear the routing key
              // so the Minister/Shadow desks stop surfacing their questions.
              parliament_role: "mp",
              ministry: null,
              cabinet_portfolio: null,
              ministries: [],
              cabinet_portfolios: [],
            }
          : {
              // Promote the next element into the PRIMARY single columns
              // (no-op when a non-primary was removed). Role is kept — they
              // are still a minister of the remaining ministries.
              ministry: keys[0],
              cabinet_portfolio: labels[0],
              ministries: keys,
              cabinet_portfolios: labels,
            }
      )
      .eq("id", input.participantId)
      .eq("event_id", input.eventId);
    error = res.error;
    if (error && isMissingMinistryArraysError(error)) {
      // Migration state changed under us — fall back to the single-column world.
      ({ error } = await legacyClear());
    }
  }
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/positions`);
  return { success: true };
}

/**
 * Remove a participant from ALL ministry portfolios: clears the single columns
 * AND the multi-ministry arrays, and resets parliament_role to plain MP.
 * Organiser-gated (canManage).
 */
export async function clearCabinetPortfolio(input: {
  eventId: string;
  participantId: string;
}): Promise<{ success: boolean; error?: string }> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  // Clear the routing key(s) too, so the Minister/Shadow desks stop surfacing
  // this (now-removed) minister's questions. Array columns may not exist yet
  // (migration not applied) — retry without them on that specific failure.
  let { error } = await (
    supabase.from("participants") as ReturnType<typeof supabase.from>
  )
    .update({
      parliament_role: "mp",
      cabinet_portfolio: null,
      ministry: null,
      ministries: [],
      cabinet_portfolios: [],
    })
    .eq("id", input.participantId)
    .eq("event_id", input.eventId);
  if (error && isMissingMinistryArraysError(error)) {
    ({ error } = await (
      supabase.from("participants") as ReturnType<typeof supabase.from>
    )
      .update({ parliament_role: "mp", cabinet_portfolio: null, ministry: null })
      .eq("id", input.participantId)
      .eq("event_id", input.eventId));
  }
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/positions`);
  return { success: true };
}

/**
 * All participants for an event (used to populate the assignment dropdown).
 * Light-weight projection — keep payload small.
 */
export async function getAllEventParticipants(
  eventId: string
): Promise<
  {
    id: string;
    full_name: string;
    party_side: string | null;
    parliament_role: ParliamentRole | null;
  }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("participants")
    .select("id, full_name, party_side, parliament_role")
    .eq("event_id", eventId)
    .order("full_name");

  return data ?? [];
}

// Super-admin: update the per-role position bonuses (singleton, global).
export async function updatePositionBonusConfig(
  bonuses: Record<string, number>
): Promise<{ success: true } | { success: false; error: string }> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  // Leadership bonuses are "points, 0–10" — enforce the range here (the
  // security/correctness boundary; the client also checks, but that can be
  // bypassed). Reject explicitly rather than silently clamp, so the caller sees
  // why. Shared by 3 admin screens (scoring-config / scoring-framework /
  // scoring-rules); all surface res.error.
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(bonuses ?? {})) {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      return { success: false, error: `Bonus for "${k}" must be a number.` };
    }
    if (n < 0 || n > 10) {
      return {
        success: false,
        error: `Leadership bonuses must be between 0 and 10 — got ${n} for "${k}".`,
      };
    }
    clean[k] = n;
  }

  const supabase = await createServiceClient();
  // MERGE over the existing config rather than REPLACE it. The three admin
  // screens (scoring-config / scoring-framework / scoring-rules) each edit a
  // DIFFERENT subset of role keys, and a full-replace upsert meant saving from
  // one screen silently wiped every key the other screens own — e.g. the ex_*
  // roles (absent from scoring-rules) and the committee_drafter /
  // committee_presenter bill-role merit (only on scoring-framework). Read the
  // current row, overlay only the keys this caller sent, and write the union, so
  // a save never drops a key it didn't list.
  const { data: existing } = await supabase
    .from("position_bonus_config")
    .select("bonuses")
    .eq("id", true)
    .maybeSingle();
  const prior: Record<string, number> = {};
  for (const [k, v] of Object.entries(
    (existing?.bonuses ?? {}) as Record<string, unknown>
  )) {
    const n = Number(v);
    if (Number.isFinite(n)) prior[k] = n;
  }
  const merged = { ...prior, ...clean };
  const { error } = await supabase.from("position_bonus_config").upsert(
    {
      id: true,
      bonuses: merged as unknown as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/scoring-rules");
  return { success: true };
}
