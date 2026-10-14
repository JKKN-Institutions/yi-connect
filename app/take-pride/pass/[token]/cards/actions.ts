"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getConnectMe } from "@/lib/take-pride/connections";
import { pingLiveTrigger } from "@/lib/take-pride/ai/queue";
import { deleteCardContact, enqueueScan, updateCardContact } from "@/lib/take-pride/cards/queue";
import { checkCardPhoto, isCardId, validateContact } from "@/lib/take-pride/cards/schemas";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Business-card scans. "Me" is ALWAYS the delegate behind the pass token,
 * resolved on the server; the browser never names a delegate. Contacts are
 * private to me: every write is filtered by my id. Every deny is
 * { success:false, error }. Never redirect. The app only stores the photo;
 * the out-of-band routine reads it (no LLM here).
 */

const BAD_LINK = "This pass link is not valid";
const SAMPLE_OFF = "Card scanning is turned off on the sample pass.";

function refresh(token: string) {
  revalidatePath(`/take-pride/pass/${token}/cards`);
  revalidatePath(`/take-pride/pass/${token}/people-saved`);
}

export async function uploadCardPhoto(token: string, photo: unknown): Promise<TpResult<{ scanId: string }>> {
  const me = await getConnectMe(token);
  if (!me) return { success: false, error: BAD_LINK };
  // The sample pass sits behind a SHARED review login: a real card scanned there would be
  // visible to every reviewer. Scanning is off on sample passes (fail closed).
  if (me.is_sample) return { success: false, error: SAMPLE_OFF };
  const p = checkCardPhoto(photo);
  if (!p.ok) return { success: false, error: p.error };
  const r = await enqueueScan(me.id, p.b64);
  if (!r.ok) return { success: false, error: r.error };
  after(() => pingLiveTrigger());
  refresh(token);
  return { success: true, data: { scanId: r.scanId } };
}

export async function saveCardContact(token: string, contactId: unknown, fields: unknown): Promise<TpResult> {
  const me = await getConnectMe(token);
  if (!me) return { success: false, error: BAD_LINK };
  if (!isCardId(contactId)) return { success: false, error: "Contact not found" };
  const v = validateContact(fields, "edit");
  if (!v.ok) return { success: false, error: v.error };
  const ok = await updateCardContact(me.id, contactId, v.contact);
  if (!ok) return { success: false, error: "Could not save. Please try again." };
  refresh(token);
  return { success: true, data: null };
}

export async function removeCardContact(token: string, contactId: unknown): Promise<TpResult> {
  const me = await getConnectMe(token);
  if (!me) return { success: false, error: BAD_LINK };
  if (!isCardId(contactId)) return { success: false, error: "Contact not found" };
  const ok = await deleteCardContact(me.id, contactId);
  if (!ok) return { success: false, error: "Could not delete. Please try again." };
  refresh(token);
  return { success: true, data: null };
}
