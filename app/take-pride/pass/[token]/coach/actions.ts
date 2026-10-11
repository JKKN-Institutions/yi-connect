"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { isToken } from "@/lib/take-pride/auth";
import { tpService } from "@/lib/take-pride/supabase";
import { pingLiveTrigger } from "@/lib/take-pride/ai/queue";
import { submitCheckin } from "@/lib/take-pride/coach/queue";
import {
  UPDATE_MAX,
  UPDATE_MIN,
  canCheckIn,
  cleanUpdate,
  dueLabel,
  isCoachMood,
  isCoachStep,
} from "@/lib/take-pride/coach/schemas";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * A delegate's coach check-in. "Me" is ALWAYS resolved from the pass token on
 * the server; no delegate id comes from the browser. Never redirect. The app
 * only queues the check-in; the out-of-band routine writes the coach note.
 */

const BAD_LINK = "This pass link is not valid";

export async function sendCoachCheckin(token: string, step: unknown, update: unknown, mood: unknown): Promise<TpResult> {
  if (!isToken(token)) return { success: false, error: BAD_LINK };
  if (!isCoachStep(step)) return { success: false, error: "That check-in was not found." };
  if (!isCoachMood(mood)) return { success: false, error: "Pick how it is going." };
  const text = cleanUpdate(update);
  if (text.length < UPDATE_MIN) return { success: false, error: "Write a sentence or two about what you did." };
  if (text.length > UPDATE_MAX) return { success: false, error: `Keep it under ${UPDATE_MAX} characters.` };

  const { data, error } = await tpService()
    .from("tp_delegates")
    .select("id, pledge, is_sample")
    .eq("token", token)
    .maybeSingle();
  if (error) return { success: false, error: "Something went wrong. Please try again." };
  const me = data as { id: string; pledge: string | null; is_sample: boolean } | null;
  if (!me) return { success: false, error: BAD_LINK };
  if (!me.pledge?.trim()) return { success: false, error: "Set your 1% pledge on your profile first." };
  if (!canCheckIn(step, me.is_sample)) return { success: false, error: `This check-in opens on ${dueLabel(step)}.` };

  const r = await submitCheckin(me.id, step, text, mood);
  if (!r.ok) return { success: false, error: r.error };
  after(() => pingLiveTrigger());
  revalidatePath(`/take-pride/pass/${token}/coach`);
  return { success: true, data: null };
}
