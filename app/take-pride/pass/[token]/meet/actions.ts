"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { DELEGATE_MEET_CAP, DELEGATE_NOTE_MAX, getDelegateMeByToken } from "@/lib/take-pride/delegate-match";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Delegate-to-delegate meeting requests. "Me" is always the delegate behind
 * the pass token; the browser only names the OTHER delegate or the request.
 * Every deny returns { success:false, error }. Never redirect.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BAD_LINK = "This pass link is not valid";

function refresh(token: string) {
  revalidatePath(`/take-pride/pass/${token}/meet`);
  revalidatePath(`/take-pride/pass/${token}`);
}

export async function askToMeet(token: string, toDelegateId: string, note: string): Promise<TpResult> {
  const me = await getDelegateMeByToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  if (typeof toDelegateId !== "string" || !UUID.test(toDelegateId)) return { success: false, error: "Delegate not found" };
  if (toDelegateId === me.id) return { success: false, error: "You cannot ask yourself to meet" };
  if (!me.delegate_meetings_opt_in) {
    return { success: false, error: "Turn on delegate meetings in your profile first, so people can answer you" };
  }
  const text = (typeof note === "string" ? note : "").trim();
  if (text.length > DELEGATE_NOTE_MAX) return { success: false, error: `Keep the note under ${DELEGATE_NOTE_MAX} characters` };

  const db = tpService();
  const { data: other } = await db
    .from("tp_delegates")
    .select("id, full_name, delegate_meetings_opt_in")
    .eq("id", toDelegateId)
    .maybeSingle();
  if (!other) return { success: false, error: "Delegate not found" };
  if (!other.delegate_meetings_opt_in) return { success: false, error: `${other.full_name} is not taking delegate meetings` };

  // They may have asked me first: answer theirs instead of sending a second one.
  const { data: reverse } = await db
    .from("tp_delegate_meetings")
    .select("status")
    .eq("from_delegate_id", other.id)
    .eq("to_delegate_id", me.id)
    .maybeSingle();
  if (reverse?.status === "requested") {
    return { success: false, error: `${other.full_name} has already asked to meet you. Accept their request below.` };
  }
  if (reverse?.status === "accepted") return { success: false, error: `You and ${other.full_name} are already meeting` };

  const { count, error: cErr } = await db
    .from("tp_delegate_meetings")
    .select("id", { count: "exact", head: true })
    .eq("from_delegate_id", me.id)
    .eq("status", "requested");
  if (cErr) return { success: false, error: "Could not send the request. Please try again." };
  if ((count ?? 0) >= DELEGATE_MEET_CAP) {
    return { success: false, error: `You have ${DELEGATE_MEET_CAP} requests waiting for an answer. Wait for some replies first.` };
  }

  const { error } = await db
    .from("tp_delegate_meetings")
    .insert({ from_delegate_id: me.id, to_delegate_id: other.id, note: text || null });
  if (error) {
    if (error.code === "23505") return { success: false, error: `You have already asked ${other.full_name}` };
    return { success: false, error: "Could not send the request. Please try again." };
  }
  refresh(token);
  return { success: true, data: null };
}

export async function answerMeet(token: string, meetingId: string, accept: boolean): Promise<TpResult> {
  const me = await getDelegateMeByToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  if (typeof meetingId !== "string" || !UUID.test(meetingId)) return { success: false, error: "Request not found" };
  const { data, error } = await tpService()
    .from("tp_delegate_meetings")
    .update({ status: accept === true ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", meetingId)
    .eq("to_delegate_id", me.id)
    .eq("status", "requested")
    .select("id");
  if (error) return { success: false, error: "Could not save your answer. Please try again." };
  if (!data?.length) return { success: false, error: "This request was already answered or is not yours" };
  refresh(token);
  return { success: true, data: null };
}
