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
