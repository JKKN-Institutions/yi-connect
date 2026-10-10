"use server";

import { revalidatePath } from "next/cache";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { tpService } from "@/lib/take-pride/supabase";
import type { TpResult } from "@/lib/take-pride/types";
import { NAME_SEARCH_MIN, checkInByName, cleanNameQuery, searchByName, type GateNameCheckIn, type GateNameHit } from "./_core";

/*
 * "No badge? Search by name" at the gate. Both actions re-check the desk gate
 * themselves and decide the row scope on the server: a real organiser reaches
 * real delegates only; review mode reaches sample delegates only. Nothing the
 * browser sends can widen that. Denies with { success:false, error }.
 */

const DENIED = "Only Take Pride organisers can check delegates in. Sign in on the organiser desk first.";

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function gateSearchByName(query: string): Promise<TpResult<GateNameHit[]>> {
  const g = await requireTpDesk();
  if (!g.ok) return { success: false, error: DENIED };
  const q = cleanNameQuery(query);
  if (q.replace(/[^\p{L}\p{N}]/gu, "").length < NAME_SEARCH_MIN) {
    return { success: false, error: `Type at least ${NAME_SEARCH_MIN} letters of their name.` };
  }
  try {
    return { success: true, data: await searchByName(tpService(), q, { sample: g.mode === "review" }) };
  } catch {
    return { success: false, error: "Could not search. Check the connection and try again." };
  }
}

export async function gateCheckInByName(delegateId: string): Promise<TpResult<GateNameCheckIn>> {
  const g = await requireTpDesk();
  if (!g.ok) return { success: false, error: DENIED };
  if (!isUuid(delegateId)) return { success: false, error: "That delegate is not valid." };
  const review = g.mode === "review";
  const out = await checkInByName(tpService(), delegateId, { sample: review, by: review ? null : g.userId });
  if (!out.ok) return { success: false, error: out.error };
  if (!out.data.already) revalidatePath("/take-pride/desk");
  return { success: true, data: out.data };
}
