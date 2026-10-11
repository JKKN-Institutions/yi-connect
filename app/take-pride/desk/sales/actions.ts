"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { isUuid } from "@/lib/take-pride/ai/schemas";
import { isChaseable } from "@/lib/take-pride/ai-partners/grounding";
import { loadPartnerForAi } from "@/lib/take-pride/ai-partners/load";
import { enqueuePartnerJobs, pingLiveTrigger } from "@/lib/take-pride/ai-partners/queue";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * "Draft chaser" on /take-pride/desk/sales. Organisers only (requireTpDesk).
 * Review mode may draft only for SAMPLE applicants; a real organiser for
 * any applicant still waiting to pay. Every deny returns { success:false }.
 * The app only queues work; the out-of-band routine writes it (no LLM here).
 */
export async function draftSalesChaser(partnerId: unknown): Promise<TpResult<{ remaining: number }>> {
  const g = await requireTpDesk();
  if (!g.ok) return { success: false, error: g.reason === "signed_out" ? "Sign in first" : "Only the Take Pride team can do this" };
  if (!isUuid(partnerId)) return { success: false, error: "Applicant not found" };
  const p = await loadPartnerForAi(partnerId);
  if (!p) return { success: false, error: "Applicant not found" };
  if (g.mode === "review" && !p.is_sample) return { success: false, error: "Review mode works with sample data only" };
  if (!isChaseable(p)) return { success: false, error: "This applicant is not waiting to pay any more" };
  const r = await enqueuePartnerJobs(p.id, "sales_chaser", [{ subject: null, input: { trigger: "desk" } }]);
  if (!r.ok) return { success: false, error: r.error };
  after(() => pingLiveTrigger());
  revalidatePath("/take-pride/desk/sales");
  return { success: true, data: { remaining: r.remaining } };
}
