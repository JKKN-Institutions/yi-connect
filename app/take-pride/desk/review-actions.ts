"use server";

import { revalidatePath } from "next/cache";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { tpService } from "@/lib/take-pride/supabase";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Desk actions for REVIEW MODE (an outside organiser signed in at
 * /take-pride/review). SAMPLE DATA ONLY: every write carries is_sample = true
 * in its WHERE clause, so a real row id or badge is never touched, whatever
 * the browser sends. Denies with { success:false, error }. Never redirects.
 * Real organisers keep using ../actions.ts.
 */

const DENIED = "Sign in on the organiser desk first.";

async function gate(): Promise<boolean> {
  const g = await requireTpDesk();
  return g.ok;
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function reviewConfirmPartner(partnerId: string): Promise<TpResult> {
  if (!(await gate())) return { success: false, error: DENIED };
  if (!isUuid(partnerId)) return { success: false, error: "That partner is not valid." };
  const { data, error } = await tpService()
    .from("tp_partners")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: null, reject_reason: null })
    .eq("id", partnerId)
    .eq("is_sample", true)
    .eq("status", "payment_submitted")
    .select("id");
  if (error) return { success: false, error: "Could not confirm. Please try again." };
  if (!data?.length) {
    return { success: false, error: "Review mode can only confirm a sample partner whose payment reference has arrived." };
  }
  revalidatePath("/take-pride/desk");
  return { success: true, data: null };
}

export async function reviewRejectPartner(partnerId: string, reason: string): Promise<TpResult> {
  if (!(await gate())) return { success: false, error: DENIED };
  if (!isUuid(partnerId)) return { success: false, error: "That partner is not valid." };
  const why = (reason ?? "").trim();
  if (why.length < 3) return { success: false, error: "Say why, so the member knows what to fix" };
  const { data, error } = await tpService()
    .from("tp_partners")
    .update({ status: "rejected", reject_reason: why.slice(0, 300) })
    .eq("id", partnerId)
    .eq("is_sample", true)
    .eq("status", "payment_submitted")
    .select("id");
  if (error) return { success: false, error: "Could not update this partner." };
  if (!data?.length) return { success: false, error: "Review mode can only send back a sample partner whose payment reference has arrived." };
  revalidatePath("/take-pride/desk");
  return { success: true, data: null };
}

/** Gate check-in for sample badges only. */
export async function reviewGateCheckIn(scanned: string): Promise<TpResult<{ name: string; chapter: string; already: boolean; at: string }>> {
  if (!(await gate())) return { success: false, error: DENIED };
  const code = extractBadgeCode(scanned);
  if (!code) return { success: false, error: "That is not a Take Pride badge code" };
  const db = tpService();
  const now = new Date().toISOString();
  const { data: first, error } = await db
    .from("tp_delegates")
    .update({ checked_in_at: now, checked_in_by: null })
    .eq("badge_code", code)
    .eq("is_sample", true)
    .is("checked_in_at", null)
    .select("full_name, chapter, checked_in_at");
  if (error) return { success: false, error: "Could not check in. Please try again." };
  if (first?.length) {
    revalidatePath("/take-pride/desk");
    return { success: true, data: { name: first[0].full_name, chapter: first[0].chapter, already: false, at: first[0].checked_in_at } };
  }
  const { data: d } = await db
    .from("tp_delegates")
    .select("full_name, chapter, checked_in_at")
    .eq("badge_code", code)
    .eq("is_sample", true)
    .maybeSingle();
  if (!d) return { success: false, error: `No sample delegate with badge ${code}. Review mode checks in sample badges only.` };
  return { success: true, data: { name: d.full_name, chapter: d.chapter, already: true, at: d.checked_in_at } };
}

/** Same reader as the real gate: "TP26-1001", "tp26 1001" or text containing it. */
function extractBadgeCode(raw: string): string | null {
  const m = (raw ?? "").toUpperCase().match(/TP26[-\s]?(\d{4})/);
  return m ? `TP26-${m[1]}` : null;
}
