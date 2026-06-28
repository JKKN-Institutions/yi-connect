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
export interface CommitteeChairRow {
  committee: string;
  /** Current chair(s) for this committee (normally 0 or 1). */
  chairs: PositionParticipant[];
  /** Everyone on this committee — the pool eligible to be made its chair. */
  members: PositionParticipant[];
}

export interface CommitteeChairsData {
  /** The committee_chair jury bonus (true live value via the admin reader). */
  bonus: number;
  committees: CommitteeChairRow[];
}

// Cabinet / Shadow ministers are committee-SCOPED like chairs, but each committee
// has TWO seats with bench-restricted pools: the Cabinet Minister comes from the
// RULING bench, the Shadow Minister from the OPPOSITION bench.
export interface CommitteeMinisterRow {
  committee: string;
  /** Current cabinet minister(s) for this committee (normally 0 or 1). */
  cabinet: PositionParticipant[];
  /** Current shadow minister(s) for this committee (normally 0 or 1). */
  shadow: PositionParticipant[];
  /** Ruling-bench members of this committee — eligible to be Cabinet Minister. */
  rulingMembers: PositionParticipant[];
  /** Opposition-bench members of this committee — eligible to be Shadow Minister. */
  oppositionMembers: PositionParticipant[];
}

export interface CommitteeMinistersData {
  /** Cabinet Minister jury bonus (true live value via the admin reader). */
  cabinetBonus: number;
  /** Shadow Minister jury bonus (true live value via the admin reader). */
  shadowBonus: number;
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
      .select("id, full_name, party_side, parliament_role, committee_name")
      .eq("event_id", eventId)
      .not("committee_name", "is", null)
      .order("full_name"),
  ]);

  const bonus = bonuses["committee_chair"] ?? 0;

  type Member = {
    id: string;
    full_name: string;
    party_side: string | null;
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
      parliament_role: p.parliament_role,
    };
    const list = byCommittee.get(committee);
    if (list) list.push(m);
    else byCommittee.set(committee, [m]);
  }

  const committees: CommitteeChairRow[] = [...byCommittee.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([committee, members]) => ({
      committee,
      chairs: members
        .filter((m) => m.parliament_role === "committee_chair")
        .map(({ id, full_name, party_side }) => ({ id, full_name, party_side })),
      members: members.map(({ id, full_name, party_side }) => ({
        id,
        full_name,
        party_side,
      })),
    }));

  return { bonus, committees };
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
  const { error } = await supabase.from("position_bonus_config").upsert(
    {
      id: true,
      bonuses: clean as unknown as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/scoring-rules");
  return { success: true };
}
