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
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/yip/database";

type ParliamentRole = Database["public"]["Enums"]["parliament_role"];

// ─── Types ─────────────────────────────────────────────────────────

export interface PositionBonusConfig {
  bonuses: Record<string, number>;
}

export interface PositionParticipant {
  id: string;
  full_name: string;
  party_side: string | null;
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
];

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

// Service-client read of the SAME merit config. position_bonus_config has RLS
// enabled with no authenticated policy, so getPositionBonusConfig() (anon/auth
// client) silently falls back to defaults — wrong values, and a save would
// overwrite the real config. Admin EDIT screens must use this so the editor
// shows and writes the true live values.
export async function getPositionBonusConfigAdmin(): Promise<PositionBonusConfig> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("position_bonus_config")
    .select("bonuses")
    .eq("id", true)
    .maybeSingle();
  const raw = (data?.bonuses ?? {}) as Record<string, unknown>;
  const bonuses: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    bonuses[k] = typeof v === "number" ? v : Number(v) || 0;
  }
  return { bonuses };
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
    // cabinet_portfolio is a newer column not yet in the generated types, hence
    // the loose builder cast (the read is plain text).
    (supabase.from("participants") as ReturnType<typeof supabase.from>)
      .select(
        "id, full_name, party_side, parliament_role, committee_name, cabinet_portfolio"
      )
      .eq("event_id", eventId)
      .order("full_name"),
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
  };
  const all = (participantsRes.data ?? []) as unknown as Member[];

  const strip = ({ id, full_name, party_side }: Member): PositionParticipant => ({
    id,
    full_name,
    party_side,
  });

  const cabinetJson = eventRes.data?.cabinet_ministries ?? null;
  const portfolioMode = Array.isArray(cabinetJson) && cabinetJson.length > 0;

  let committees: CommitteeMinisterRow[];

  if (portfolioMode) {
    // One row per chosen ministry (in the chapter's chosen order). Pools are the
    // whole ruling/opposition bench, minus anyone who already holds a DIFFERENT
    // ministry post (so they can't be double-booked). The holder of THIS row is
    // matched by parliament_role + cabinet_portfolio === ministry label.
    const labels = effectiveMinistries(cabinetJson).map((m) => m.label.trim());
    const isMinister = (m: Member) =>
      m.parliament_role === "cabinet_minister" ||
      m.parliament_role === "shadow_minister";

    committees = labels.map((label) => {
      const cabinet = all.filter(
        (m) =>
          m.parliament_role === "cabinet_minister" &&
          (m.cabinet_portfolio ?? "").trim() === label
      );
      const shadow = all.filter(
        (m) =>
          m.parliament_role === "shadow_minister" &&
          (m.cabinet_portfolio ?? "").trim() === label
      );
      const cabinetIds = new Set(cabinet.map((m) => m.id));
      const shadowIds = new Set(shadow.map((m) => m.id));
      // Eligible = bench member who is NOT already a minister elsewhere, OR is the
      // current holder of this exact seat (so they show as removable).
      const rulingMembers = all.filter(
        (m) =>
          m.party_side === "ruling" && (!isMinister(m) || cabinetIds.has(m.id))
      );
      const oppositionMembers = all.filter(
        (m) =>
          m.party_side === "opposition" &&
          (!isMinister(m) || shadowIds.has(m.id))
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
 * Assign a participant to a ministry portfolio (Cabinet or Shadow Minister) in
 * the portfolio-based cabinet model. Sets BOTH parliament_role and
 * participants.cabinet_portfolio (the ministry label), decoupled from committee.
 * Bench is enforced: Cabinet Minister must be ruling, Shadow Minister opposition.
 * Organiser-gated (canManage).
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
  // in participants.ministry too. The Minister + Shadow desks (ministry.ts /
  // shadow.ts) route Question-Hour questions by participants.ministry == the
  // cabinet KEY a question is directed to — so without this, a portfolio-assigned
  // minister would never see their questions. The label comes straight from the
  // cabinet config (getCommitteeMinisters builds the rows from effectiveMinistries),
  // so a match is expected; fall back to null defensively.
  const { data: eventRow } = await supabase
    .from("events")
    .select("cabinet_ministries")
    .eq("id", input.eventId)
    .single();
  const ministryKey =
    effectiveMinistries(eventRow?.cabinet_ministries ?? null).find(
      (m) => m.label.trim() === ministry
    )?.key ?? null;

  const { error } = await (
    supabase.from("participants") as ReturnType<typeof supabase.from>
  )
    .update({
      parliament_role: role,
      cabinet_portfolio: ministry,
      ministry: ministryKey,
    })
    .eq("id", input.participantId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/positions`);
  return { success: true };
}

/**
 * Remove a participant from their ministry portfolio: clears cabinet_portfolio
 * and resets parliament_role to plain MP. Organiser-gated (canManage).
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
  const { error } = await (
    supabase.from("participants") as ReturnType<typeof supabase.from>
  )
    // Clear the routing key too, so the Minister/Shadow desks stop surfacing
    // this (now-removed) minister's questions.
    .update({ parliament_role: "mp", cabinet_portfolio: null, ministry: null })
    .eq("id", input.participantId)
    .eq("event_id", input.eventId);
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
