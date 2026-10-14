"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { getCatalystPartner } from "@/lib/take-pride/catalyst";
import { CANCELLED_MESSAGE } from "@/lib/take-pride/constants";
import { isUuid } from "@/lib/take-pride/ai/schemas";
import { loadPartnerForAi, partnerAiEligibility } from "@/lib/take-pride/ai-partners/load";
import { enqueuePartnerJobs, pingLiveTrigger } from "@/lib/take-pride/ai-partners/queue";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Catalyst Partner AI requests: meeting briefs and lead follow-ups.
 * "Me" is ALWAYS the partner behind the secret link token, resolved on the
 * server; the browser names at most one delegate id, and whether that
 * delegate may be written about is re-derived here. Confirmed, not
 * cancelled partners only. Every deny returns { success:false, error }.
 * The app only queues work; the out-of-band routine writes it (no LLM here).
 */

const BAD_LINK = "This partner link is not valid";
const NOT_CONFIRMED = "AI help opens once your payment is confirmed";

type Gate = { ok: true; partnerId: string } | { ok: false; error: string };

async function gate(token: string): Promise<Gate> {
  const p = await getCatalystPartner(token);
  if (!p) return { ok: false, error: BAD_LINK };
  if (p.cancelled_at) return { ok: false, error: CANCELLED_MESSAGE };
  if (p.status !== "confirmed") return { ok: false, error: NOT_CONFIRMED };
  return { ok: true, partnerId: p.id };
}

/** Accepted meetings and leads of this partner, read live. null when unreadable. */
async function relations(partnerId: string): Promise<{ accepted: Set<string>; leads: Set<string> } | null> {
  const db = tpService();
  const [m, l] = await Promise.all([
    db.from("tp_meetings").select("delegate_id").eq("partner_id", partnerId).eq("status", "accepted"),
    db.from("tp_leads").select("delegate_id").eq("partner_id", partnerId),
  ]);
  if (m.error || l.error) return null;
  return {
    accepted: new Set(((m.data ?? []) as { delegate_id: string }[]).map((r) => r.delegate_id)),
    leads: new Set(((l.data ?? []) as { delegate_id: string }[]).map((r) => r.delegate_id)),
  };
}

/** "Prepare me": queue a meeting brief about one delegate. */
export async function preparePartnerBrief(token: string, delegateId: unknown): Promise<TpResult<{ remaining: number }>> {
  const g = await gate(token);
  if (!g.ok) return { success: false, error: g.error };
  if (!isUuid(delegateId)) return { success: false, error: "That delegate was not found" };
  const [p, rel] = await Promise.all([loadPartnerForAi(g.partnerId), relations(g.partnerId)]);
  if (!p || !rel) return { success: false, error: "Something went wrong. Please try again." };
  const ok = await partnerAiEligibility(p, [delegateId], rel);
  if (!ok.brief.has(delegateId)) {
    return { success: false, error: "A brief is available for delegates listed in the directory or who accepted your meeting." };
  }
  const r = await enqueuePartnerJobs(p.id, "partner_brief", [{ subject: delegateId, input: { trigger: "prepare_me" } }]);
  if (!r.ok) return { success: false, error: r.error };
  after(() => pingLiveTrigger());
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  return { success: true, data: { remaining: r.remaining } };
}

/**
 * "Draft follow-ups": queue one follow-up for every lead and accepted
 * meeting that has no draft yet, up to the daily limit.
 */
export async function draftPartnerFollowups(
  token: string
): Promise<TpResult<{ queued: number; skipped: number; limited: number; remaining: number }>> {
  const g = await gate(token);
  if (!g.ok) return { success: false, error: g.error };
  const [p, rel] = await Promise.all([loadPartnerForAi(g.partnerId), relations(g.partnerId)]);
  if (!p || !rel) return { success: false, error: "Something went wrong. Please try again." };
  const ids = [...new Set([...rel.accepted, ...rel.leads])];
  if (!ids.length) return { success: false, error: "No leads or accepted meetings yet." };
  const ok = await partnerAiEligibility(p, ids, rel);
  const items = ids.filter((id) => ok.followup.has(id)).map((id) => ({ subject: id, input: { trigger: "draft_followups" } }));
  if (!items.length) return { success: false, error: "No leads or accepted meetings to follow up." };
  const r = await enqueuePartnerJobs(p.id, "lead_followup", items);
  if (!r.ok) {
    return {
      success: false,
      error: r.reason === "busy" ? "Every lead and accepted meeting already has a follow-up draft." : r.error,
    };
  }
  after(() => pingLiveTrigger());
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  return { success: true, data: { queued: r.queued, skipped: r.skipped, limited: r.limited, remaining: r.remaining } };
}
