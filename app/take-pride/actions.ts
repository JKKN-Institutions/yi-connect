"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tpService } from "@/lib/take-pride/supabase";
import { isToken, requireTpOrganiser } from "@/lib/take-pride/auth";
import { TP_INDUSTRIES, TP_TAGS, TP_ZONES, withGst } from "@/lib/take-pride/constants";
import { getPartnerByToken, getSettings } from "@/lib/take-pride/data";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Every action returns { success:false, error } on a deny. Never redirect.
 * Partner and delegate actions are gated by their secret link token;
 * desk actions by requireTpOrganiser().
 */

const ApplySchema = z.object({
  member_name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[^\d+]/g, ""))
    .refine((s) => s.replace(/\D/g, "").length >= 10, "Enter a 10-digit mobile number"),
  chapter: z.string().trim().min(2, "Enter your Yi chapter").max(80),
  zone: z.enum(TP_ZONES),
  business_name: z.string().trim().min(2, "Enter your business name").max(120),
  industry: z.enum(TP_INDUSTRIES),
  offers: z.array(z.enum(TP_TAGS)).min(1, "Pick at least one thing you offer").max(5, "Pick up to 5"),
  wants_industries: z.array(z.enum(TP_INDUSTRIES)).max(6, "Pick up to 6").default([]),
  pitch: z.string().trim().max(280, "Keep it under 280 characters").optional().default(""),
});

export async function applyCatalyst(input: unknown): Promise<TpResult<{ token: string }>> {
  const parsed = ApplySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;
  const s = await getSettings();
  const db = tpService();

  // One live application per email: send them back to their own page.
  const { data: existing } = await db
    .from("tp_partners")
    .select("token")
    .eq("email", v.email)
    .neq("status", "rejected")
    .maybeSingle();
  if (existing?.token) return { success: true, data: { token: existing.token } };

  const { data, error } = await db
    .from("tp_partners")
    .insert({
      ...v,
      pitch: v.pitch || null,
      tier: "member",
      amount_due_inr: withGst(s.member_fee_inr, s.gst_pct),
      status: "applied",
    })
    .select("token")
    .single();
  if (error || !data) return { success: false, error: "Could not save your application. Please try again." };
  return { success: true, data: { token: data.token } };
}

export async function submitPayment(token: string, reference: string): Promise<TpResult> {
  const ref = (reference ?? "").trim();
  if (ref.length < 6 || ref.length > 60) return { success: false, error: "Enter the UPI or bank reference number (6 to 60 characters)" };
  const p = await getPartnerByToken(token);
  if (!p) return { success: false, error: "This partner link is not valid" };
  if (p.status === "confirmed") return { success: false, error: "Your payment is already confirmed" };
  const { error } = await tpService()
    .from("tp_partners")
    .update({ payment_reference: ref, payment_submitted_at: new Date().toISOString(), status: "payment_submitted", reject_reason: null })
    .eq("id", p.id)
    .in("status", ["applied", "payment_submitted", "rejected"]);
  if (error) return { success: false, error: "Could not save the reference. Please try again." };
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  revalidatePath("/take-pride/desk");
  return { success: true, data: null };
}

export async function requestMeeting(token: string, delegateId: string): Promise<TpResult> {
  const p = await getPartnerByToken(token);
  if (!p) return { success: false, error: "This partner link is not valid" };
  if (p.status !== "confirmed") return { success: false, error: "Meeting requests open once your payment is confirmed" };
  const s = await getSettings();
  const db = tpService();
  const { count } = await db
    .from("tp_meetings")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", p.id)
    .neq("status", "declined");
  if ((count ?? 0) >= s.meeting_cap) return { success: false, error: `You have reached the ${s.meeting_cap}-meeting limit` };
  const { data: d } = await db.from("tp_delegates").select("id, partner_meetings_opt_in").eq("id", delegateId).maybeSingle();
  if (!d) return { success: false, error: "Delegate not found" };
  if (!d.partner_meetings_opt_in) return { success: false, error: "This delegate is not taking partner meetings" };
  const { error } = await db.from("tp_meetings").insert({ partner_id: p.id, delegate_id: d.id });
  if (error) {
    if (error.code === "23505") return { success: false, error: "You have already asked this delegate" };
    return { success: false, error: "Could not send the request. Please try again." };
  }
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  return { success: true, data: null };
}

/** A partner scans a delegate's badge (or types the code) to save a lead. */
export async function captureLead(token: string, scanned: string, note: string): Promise<TpResult<{ name: string; chapter: string; duplicate: boolean }>> {
  const p = await getPartnerByToken(token);
  if (!p) return { success: false, error: "This partner link is not valid" };
  if (p.status !== "confirmed") return { success: false, error: "Lead capture opens once your payment is confirmed" };
  const code = extractBadgeCode(scanned);
  if (!code) return { success: false, error: "That is not a Take Pride badge code" };
  const db = tpService();
  const { data: d } = await db.from("tp_delegates").select("id, full_name, chapter").eq("badge_code", code).maybeSingle();
  if (!d) return { success: false, error: `No delegate with badge ${code}` };
  const { error } = await db
    .from("tp_leads")
    .insert({ partner_id: p.id, delegate_id: d.id, note: (note ?? "").trim().slice(0, 500) || null });
  if (error && error.code !== "23505") return { success: false, error: "Could not save the lead. Please try again." };
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  return { success: true, data: { name: d.full_name, chapter: d.chapter, duplicate: error?.code === "23505" } };
}

export async function respondMeeting(delegateToken: string, meetingId: string, accept: boolean): Promise<TpResult> {
  if (!isToken(delegateToken)) return { success: false, error: "This pass link is not valid" };
  const db = tpService();
  const { data: d } = await db.from("tp_delegates").select("id").eq("token", delegateToken).maybeSingle();
  if (!d) return { success: false, error: "This pass link is not valid" };
  const { data, error } = await db
    .from("tp_meetings")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", meetingId)
    .eq("delegate_id", d.id)
    .select("id");
  if (error || !data?.length) return { success: false, error: "Could not update this request" };
  revalidatePath(`/take-pride/pass/${delegateToken}`);
  return { success: true, data: null };
}

export async function setPartnerMeetingsOptIn(delegateToken: string, optIn: boolean): Promise<TpResult> {
  if (!isToken(delegateToken)) return { success: false, error: "This pass link is not valid" };
  const { data, error } = await tpService()
    .from("tp_delegates")
    .update({ partner_meetings_opt_in: optIn })
    .eq("token", delegateToken)
    .select("id");
  if (error || !data?.length) return { success: false, error: "Could not save" };
  revalidatePath(`/take-pride/pass/${delegateToken}`);
  return { success: true, data: null };
}

// ---------------------------------------------------------------- desk ----

export async function deskConfirmPartner(partnerId: string): Promise<TpResult> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: "Only Take Pride organisers can confirm payments" };
  const { data, error } = await tpService()
    .from("tp_partners")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: g.userId, reject_reason: null })
    .eq("id", partnerId)
    .eq("status", "payment_submitted")
    .select("id");
  if (error) return { success: false, error: "Could not confirm. Please try again." };
  if (!data?.length) return { success: false, error: "Only a partner whose payment reference has arrived can be confirmed" };
  revalidatePath("/take-pride/desk");
  return { success: true, data: null };
}

export async function deskRejectPartner(partnerId: string, reason: string): Promise<TpResult> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: "Only Take Pride organisers can do this" };
  const why = (reason ?? "").trim();
  if (why.length < 3) return { success: false, error: "Say why, so the member knows what to fix" };
  const { data, error } = await tpService()
    .from("tp_partners")
    .update({ status: "rejected", reject_reason: why.slice(0, 300) })
    .eq("id", partnerId)
    .eq("status", "payment_submitted")
    .select("id");
  if (error || !data?.length) return { success: false, error: "Could not update this partner" };
  revalidatePath("/take-pride/desk");
  return { success: true, data: null };
}

export async function deskSavePaymentInstructions(text: string): Promise<TpResult> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: "Only Take Pride organisers can do this" };
  const t = (text ?? "").trim().slice(0, 1000);
  const { error } = await tpService()
    .from("tp_settings")
    .update({ payment_instructions: t || null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { success: false, error: "Could not save" };
  revalidatePath("/take-pride", "layout");
  return { success: true, data: null };
}

export async function gateCheckIn(scanned: string): Promise<TpResult<{ name: string; chapter: string; already: boolean; at: string }>> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: "Only Take Pride organisers can check delegates in" };
  const code = extractBadgeCode(scanned);
  if (!code) return { success: false, error: "That is not a Take Pride badge code" };
  const db = tpService();
  const now = new Date().toISOString();
  // Only the first scan stamps the time; a second scan reports "already in".
  const { data: first } = await db
    .from("tp_delegates")
    .update({ checked_in_at: now, checked_in_by: g.userId })
    .eq("badge_code", code)
    .is("checked_in_at", null)
    .select("full_name, chapter, checked_in_at");
  if (first?.length) {
    revalidatePath("/take-pride/desk");
    return { success: true, data: { name: first[0].full_name, chapter: first[0].chapter, already: false, at: first[0].checked_in_at } };
  }
  const { data: d } = await db.from("tp_delegates").select("full_name, chapter, checked_in_at").eq("badge_code", code).maybeSingle();
  if (!d) return { success: false, error: `No delegate with badge ${code}` };
  return { success: true, data: { name: d.full_name, chapter: d.chapter, already: true, at: d.checked_in_at } };
}

/** Accepts "TP26-1001", "tp26 1001" or any scanned text containing the code. */
function extractBadgeCode(raw: string): string | null {
  const m = (raw ?? "").toUpperCase().match(/TP26[-\s]?(\d{4})/);
  return m ? `TP26-${m[1]}` : null;
}
