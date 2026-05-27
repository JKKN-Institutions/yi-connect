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

import { createClient } from "@/lib/yip/supabase/server";
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

// ─── Display order + labels for the 6 "key" roles shown on the card ──

const KEY_ROLES: { role: ParliamentRole; label: string }[] = [
  { role: "prime_minister", label: "Prime Minister" },
  { role: "speaker", label: "Speaker" },
  { role: "deputy_speaker", label: "Deputy Speaker" },
  { role: "leader_of_opposition", label: "Leader of Opposition" },
  { role: "cabinet_minister", label: "Cabinet Minister" },
  { role: "mp", label: "Member of Parliament" },
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

export async function getParticipantsByRole(
  eventId: string
): Promise<PositionRoleGroup[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const [{ bonuses }, participantsRes] = await Promise.all([
    getPositionBonusConfig(),
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
