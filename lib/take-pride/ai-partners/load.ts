import "server-only";

import { tpService } from "../supabase";
import {
  DELEGATE_GROUND_COLS,
  PARTNER_GROUND_COLS,
  briefAllowed,
  buildBriefGrounding,
  buildFollowupGrounding,
  buildSalesGrounding,
  followupAllowed,
  type Built,
  type DelegateRow,
  type PartnerRow,
  type Relation,
} from "./grounding";
import type { PartnerAiJob } from "./queue";

/*
 * Server loaders for partner-side AI. Explicit column lists only (see
 * ./grounding.ts): tp_delegates and tp_partners also hold phone, email,
 * tokens and badge secrets, none of which may reach a grounding.
 */

export async function loadPartnerForAi(partnerId: string): Promise<PartnerRow | null> {
  const { data, error } = await tpService().from("tp_partners").select(PARTNER_GROUND_COLS).eq("id", partnerId).maybeSingle();
  if (error || !data) return null;
  return data as PartnerRow;
}

async function loadDelegate(id: string): Promise<DelegateRow | null> {
  const { data, error } = await tpService().from("tp_delegates").select(DELEGATE_GROUND_COLS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as DelegateRow;
}

/** How this partner knows this delegate, read live. null when unreadable. */
async function relationOf(partnerId: string, delegateId: string): Promise<Relation | null> {
  const db = tpService();
  const [m, l] = await Promise.all([
    db.from("tp_meetings").select("status").eq("partner_id", partnerId).eq("delegate_id", delegateId).maybeSingle(),
    db.from("tp_leads").select("note").eq("partner_id", partnerId).eq("delegate_id", delegateId).maybeSingle(),
  ]);
  if (m.error || l.error) return null;
  return {
    acceptedMeeting: (m.data as { status: string } | null)?.status === "accepted",
    lead: !!l.data,
    leadNote: (l.data as { note: string | null } | null)?.note ?? null,
  };
}

export type GroundingResult = { ok: true; built: Built } | { ok: false; reason: string };

/**
 * Build one claimed job's grounding. Eligibility is checked AGAIN here, at
 * drain time: a partner cancelled, a payment not confirmed, a delegate who
 * hid their listing or a meeting that was declined since the job was queued
 * all fail the job instead of handing anything out.
 */
export async function buildPartnerJobGrounding(job: PartnerAiJob): Promise<GroundingResult> {
  const p = await loadPartnerForAi(job.partner_id);
  if (!p) return { ok: false, reason: "Partner not found" };

  if (job.kind === "sales_chaser") {
    const { data, error } = await tpService()
      .from("tp_delegates")
      .select("needs, zone, industry, chapter, role_title, partner_meetings_opt_in, directory_visible, is_sample")
      .eq("is_sample", p.is_sample)
      .limit(5000);
    if (error) return { ok: false, reason: "Delegates could not be read" };
    const built = buildSalesGrounding(p, (data ?? []) as Parameters<typeof buildSalesGrounding>[1]);
    return built ? { ok: true, built } : { ok: false, reason: "Applicant is no longer waiting to pay" };
  }

  if (!job.subject_delegate_id) return { ok: false, reason: "No person on this job" };
  const [d, rel] = await Promise.all([loadDelegate(job.subject_delegate_id), relationOf(p.id, job.subject_delegate_id)]);
  if (!d) return { ok: false, reason: "Delegate not found" };
  if (!rel) return { ok: false, reason: "Meetings could not be read" };
  const built = job.kind === "partner_brief" ? buildBriefGrounding(p, d, rel) : buildFollowupGrounding(p, d, rel);
  return built ? { ok: true, built } : { ok: false, reason: "No longer allowed for this partner and person" };
}

/**
 * For the partner page: which of these delegates may get a brief / a
 * follow-up right now. Read live; an unreadable list allows nothing.
 */
export async function partnerAiEligibility(
  p: PartnerRow,
  delegateIds: string[],
  rel: { accepted: Set<string>; leads: Set<string> }
): Promise<{ brief: Set<string>; followup: Set<string> }> {
  const brief = new Set<string>();
  const followup = new Set<string>();
  const ids = [...new Set(delegateIds)];
  if (!ids.length) return { brief, followup };
  const { data, error } = await tpService()
    .from("tp_delegates")
    .select("id, directory_visible, is_sample")
    .in("id", ids.slice(0, 1000));
  if (error) return { brief, followup };
  for (const d of (data ?? []) as { id: string; directory_visible: boolean; is_sample: boolean }[]) {
    const r = { acceptedMeeting: rel.accepted.has(d.id), lead: rel.leads.has(d.id) };
    if (briefAllowed(p, d, r)) brief.add(d.id);
    if (followupAllowed(p, d, r)) followup.add(d.id);
  }
  return { brief, followup };
}
