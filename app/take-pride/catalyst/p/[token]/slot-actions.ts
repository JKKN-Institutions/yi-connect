"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { getPartnerByToken } from "@/lib/take-pride/data";
import { bookMeetingSlot, dKey, pKey, tableLabel } from "@/lib/take-pride/slots";
import type { TpResult } from "@/lib/take-pride/types";
import type { CatalystPartner } from "@/lib/take-pride/catalyst";
import { CANCELLED_MESSAGE } from "@/lib/take-pride/constants";

/*
 * A Catalyst Partner picks a time for an ACCEPTED meeting with a delegate.
 * "Me" is the partner behind the secret link token; the browser only names
 * the meeting and the slot. Every deny returns { success:false, error }.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLOT = /^d\d-\d{2}:\d{2}$/;

export async function pickPartnerMeetingTime(
  token: string,
  meetingId: string,
  slotKey: string
): Promise<TpResult<{ when: string }>> {
  const p = await getPartnerByToken(token);
  if (!p) return { success: false, error: "This partner link is not valid" };
  if ((p as CatalystPartner).cancelled_at) return { success: false, error: CANCELLED_MESSAGE };
  if (p.status !== "confirmed") return { success: false, error: "Meeting times open once your payment is confirmed" };
  if (typeof meetingId !== "string" || !UUID.test(meetingId)) return { success: false, error: "Meeting not found" };
  if (typeof slotKey !== "string" || !SLOT.test(slotKey)) return { success: false, error: "Pick one of the times shown" };

  const { data: m } = await tpService()
    .from("tp_meetings")
    .select("id, partner_id, delegate_id, status, delegate:tp_delegates(full_name)")
    .eq("id", meetingId)
    .maybeSingle();
  if (!m || m.partner_id !== p.id) return { success: false, error: "This meeting is not yours" };
  if (m.status !== "accepted") return { success: false, error: "Only an accepted meeting can be given a time" };
  const d = (m.delegate ?? null) as unknown as { full_name: string } | null;

  const r = await bookMeetingSlot({
    kind: "partner",
    meetingId,
    people: [pKey(p.id), dKey(m.delegate_id)],
    slotKey,
    otherName: d?.full_name ?? "The delegate",
  });
  if (!r.success) return r;
  revalidatePath(`/take-pride/catalyst/p/${token}`);
  return { success: true, data: { when: `${r.data.slot.label} · ${tableLabel(r.data.table_no)}` } };
}
