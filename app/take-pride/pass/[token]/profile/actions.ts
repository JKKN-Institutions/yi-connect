"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { isToken } from "@/lib/take-pride/auth";
import { ProfileSchema } from "@/lib/take-pride/profile";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * A delegate edits their own profile. The row is found by the pass token
 * only; no delegate id comes from the browser. Every field is checked again
 * here (lib/take-pride/profile.ts). Never redirect.
 */

export async function saveDelegateProfile(token: string, input: unknown): Promise<TpResult> {
  if (!isToken(token)) return { success: false, error: "This pass link is not valid" };
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your choices" };
  const v = parsed.data;
  const { data, error } = await tpService()
    .from("tp_delegates")
    .update({
      needs: v.needs,
      offers: v.offers,
      partner_meetings_opt_in: v.partner_meetings_opt_in,
      delegate_meetings_opt_in: v.delegate_meetings_opt_in,
      working_on: v.working_on,
      ask_me_about: v.ask_me_about,
      pledge: v.pledge,
      yi_vertical: v.yi_vertical,
      chapter_strengths: v.chapter_strengths,
      chapter_wants: v.chapter_wants,
      directory_visible: v.directory_visible,
    })
    .eq("token", token)
    .select("id");
  if (error) return { success: false, error: "Could not save. Please try again." };
  if (!data?.length) return { success: false, error: "This pass link is not valid" };
  revalidatePath(`/take-pride/pass/${token}`, "layout");
  return { success: true, data: null };
}
