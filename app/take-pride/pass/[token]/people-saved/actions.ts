"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { PEOPLE_NOTE_MAX, getConnectMe, saveMyNote } from "@/lib/take-pride/connections";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * "My people". "Me" is the delegate behind the pass token; the browser only
 * names the OTHER delegate. Notes and follow-up dates are private to me.
 * Every deny is { success:false, error }. Never redirect.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BAD_LINK = "This pass link is not valid";

function refresh(token: string) {
  revalidatePath(`/take-pride/pass/${token}/people-saved`);
}

/** "" or a real calendar date between 2026 and 2030, as YYYY-MM-DD. */
function cleanDate(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false };
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { ok: false };
  const y = d.getUTCFullYear();
  if (y < 2026 || y > 2030) return { ok: false };
  return { ok: true, value: v };
}

export async function savePersonNote(token: string, otherId: string, note: string, followUp: string): Promise<TpResult> {
  const me = await getConnectMe(token);
  if (!me) return { success: false, error: BAD_LINK };
  if (typeof otherId !== "string" || !UUID.test(otherId) || otherId === me.id) return { success: false, error: "Person not found" };
  const text = (typeof note === "string" ? note : "").trim();
  if (text.length > PEOPLE_NOTE_MAX) return { success: false, error: `Keep the note under ${PEOPLE_NOTE_MAX} characters` };
  const date = cleanDate(followUp);
  if (!date.ok) return { success: false, error: "Pick a follow-up date between 2026 and 2030, or leave it empty" };
  const r = await saveMyNote(me, otherId, text || null, date.value);
  if (r === "not_mutual") return { success: false, error: "You can only keep notes on people you are connected with" };
  if (r === "error") return { success: false, error: "Could not save. Please try again." };
  refresh(token);
  return { success: true, data: null };
}

export async function setShareContact(token: string, share: boolean): Promise<TpResult> {
  const me = await getConnectMe(token);
  if (!me) return { success: false, error: BAD_LINK };
  const { data, error } = await tpService()
    .from("tp_delegates")
    .update({ share_contact: share === true })
    .eq("id", me.id)
    .select("id");
  if (error || !data?.length) return { success: false, error: "Could not save. Please try again." };
  refresh(token);
  return { success: true, data: null };
}
