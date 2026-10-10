"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { getDelegateMeByToken } from "@/lib/take-pride/delegate-match";
import { bookMeetingSlot, dKey, pKey, tableLabel } from "@/lib/take-pride/slots";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * A delegate picks a time for one of their ACCEPTED meetings: with another
 * delegate (tp_delegate_meetings) or with a Catalyst Partner (tp_meetings).
 * "Me" is always the delegate behind the pass token; the browser only names
 * the meeting and the slot, and both are checked here. Every deny returns
 * { success:false, error }. Never redirect.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLOT = /^d\d-\d{2}:\d{2}$/;
const BAD_LINK = "This pass link is not valid";

function refresh(token: string) {
  revalidatePath(`/take-pride/pass/${token}/meet`);
  revalidatePath(`/take-pride/pass/${token}/schedule`);
}

export async function pickDelegateMeetingTime(
  token: string,
  kind: "delegate" | "partner",
  meetingId: string,
  slotKey: string
): Promise<TpResult<{ when: string }>> {
  const me = await getDelegateMeByToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  if (kind !== "delegate" && kind !== "partner") return { success: false, error: "Meeting not found" };
  if (typeof meetingId !== "string" || !UUID.test(meetingId)) return { success: false, error: "Meeting not found" };
  if (typeof slotKey !== "string" || !SLOT.test(slotKey)) return { success: false, error: "Pick one of the times shown" };

  const db = tpService();
  let other: string;
  let otherName: string;
  if (kind === "delegate") {
    const { data: m } = await db
      .from("tp_delegate_meetings")
      .select("id, from_delegate_id, to_delegate_id, status")
      .eq("id", meetingId)
      .maybeSingle();
    if (!m || (m.from_delegate_id !== me.id && m.to_delegate_id !== me.id)) {
      return { success: false, error: "This meeting is not yours" };
    }
    if (m.status !== "accepted") return { success: false, error: "Only an accepted meeting can be given a time" };
    const otherId = m.from_delegate_id === me.id ? m.to_delegate_id : m.from_delegate_id;
    const { data: o } = await db.from("tp_delegates").select("full_name").eq("id", otherId).maybeSingle();
    other = dKey(otherId);
    otherName = o?.full_name ?? "The other delegate";
  } else {
    const { data: m } = await db
      .from("tp_meetings")
      .select("id, delegate_id, partner_id, status, partner:tp_partners(business_name, status)")
      .eq("id", meetingId)
      .maybeSingle();
    const partner = (m?.partner ?? null) as unknown as { business_name: string; status: string } | null;
    if (!m || m.delegate_id !== me.id || partner?.status !== "confirmed") {
      return { success: false, error: "This meeting is not yours" };
    }
    if (m.status !== "accepted") return { success: false, error: "Only an accepted meeting can be given a time" };
    other = pKey(m.partner_id);
    otherName = partner.business_name;
  }

  const r = await bookMeetingSlot({ kind, meetingId, people: [dKey(me.id), other], slotKey, otherName });
  if (!r.success) return r;
  refresh(token);
  return { success: true, data: { when: `${r.data.slot.label} · ${tableLabel(r.data.table_no)}` } };
}
