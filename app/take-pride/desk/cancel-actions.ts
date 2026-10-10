"use server";

import { revalidatePath } from "next/cache";
import { requireTpOrganiser } from "@/lib/take-pride/auth";
import { tpService } from "@/lib/take-pride/supabase";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * An organiser cancels a Catalyst Partner, case by case (Director, 10 Oct).
 * REAL organisers only: requireTpOrganiser() never lets a review session in.
 * Review mode uses reviewCancelPartner in ./review-actions.ts (sample only).
 * A cancelled partner frees the seat and loses meeting requests and scanning.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS = ["refund_due", "no_refund", "credit"] as const;

export async function deskCancelPartner(partnerId: string, note: string, refund: string): Promise<TpResult> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: "Only Take Pride organisers can cancel a partner" };
  if (typeof partnerId !== "string" || !UUID.test(partnerId)) return { success: false, error: "That partner is not valid." };
  const why = (note ?? "").trim();
  if (why.length < 3) return { success: false, error: "Write a short note. The partner sees it on their page." };
  if (!DECISIONS.includes(refund as (typeof DECISIONS)[number])) return { success: false, error: "Choose what happens to the money" };
  const { data, error } = await tpService()
    .from("tp_partners")
    .update({ cancelled_at: new Date().toISOString(), cancel_note: why.slice(0, 500), refund_decision: refund })
    .eq("id", partnerId)
    .is("cancelled_at", null)
    .select("id");
  if (error) return { success: false, error: "Could not cancel. Please try again." };
  if (!data?.length) return { success: false, error: "This partner is already cancelled" };
  revalidatePath("/take-pride", "layout");
  return { success: true, data: null };
}
