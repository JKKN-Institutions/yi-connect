"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { TEAM_MAX, getCatalystPartner } from "@/lib/take-pride/catalyst";
import { CANCELLED_MESSAGE } from "@/lib/take-pride/constants";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * A confirmed Catalyst Partner adds or removes team scanners (name only).
 * "Me" is the partner behind the secret link token; a team member's own
 * token can never manage the team (it is not a partner token). Every deny
 * returns { success:false, error }.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function owner(token: string) {
  const p = await getCatalystPartner(token);
  if (!p) return { ok: false as const, error: "This partner link is not valid" };
  if (p.cancelled_at) return { ok: false as const, error: CANCELLED_MESSAGE };
  if (p.status !== "confirmed") return { ok: false as const, error: "Team scanners open once your payment is confirmed" };
  return { ok: true as const, p };
}

export async function addTeamMember(token: string, name: string): Promise<TpResult<{ id: string }>> {
  const g = await owner(token);
  if (!g.ok) return { success: false, error: g.error };
  const n = (name ?? "").trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 80) return { success: false, error: "Enter the person's name (2 to 80 characters)" };
  const db = tpService();
  const { data: made, error } = await db
    .from("tp_partner_team")
    .insert({ partner_id: g.p.id, name: n })
    .select("id")
    .single();
  if (error || !made) return { success: false, error: "Could not add this person. Please try again." };
  // Insert first, then count, so two quick taps cannot get past the cap.
  const { count, error: cErr } = await db
    .from("tp_partner_team")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", g.p.id)
    .eq("active", true);
  if (cErr || count === null || count > TEAM_MAX) {
    await db.from("tp_partner_team").delete().eq("id", made.id);
    return {
      success: false,
      error: cErr || count === null ? "Could not add this person. Please try again." : `You can add up to ${TEAM_MAX} people. Remove one first.`,
    };
  }
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  return { success: true, data: { id: made.id } };
}

/** Switches the member's link off. Their scanned leads stay with the partner. */
export async function removeTeamMember(token: string, memberId: string): Promise<TpResult> {
  const p = await getCatalystPartner(token);
  if (!p) return { success: false, error: "This partner link is not valid" };
  if (typeof memberId !== "string" || !UUID.test(memberId)) return { success: false, error: "Team member not found" };
  const { data, error } = await tpService()
    .from("tp_partner_team")
    .update({ active: false })
    .eq("id", memberId)
    .eq("partner_id", p.id)
    .eq("active", true)
    .select("id");
  if (error || !data?.length) return { success: false, error: "Could not remove this person" };
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  return { success: true, data: null };
}
