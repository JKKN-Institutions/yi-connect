"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tpService } from "@/lib/take-pride/supabase";
import { isToken } from "@/lib/take-pride/auth";
import { TP_TAGS } from "@/lib/take-pride/constants";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * A delegate edits their own matching profile. The row is found by the pass
 * token only; no delegate id comes from the browser. Never redirect.
 */

const ProfileSchema = z.object({
  needs: z.array(z.enum(TP_TAGS)).max(5, "Pick up to 5 things you need"),
  offers: z.array(z.enum(TP_TAGS)).max(5, "Pick up to 5 things you offer"),
  partner_meetings_opt_in: z.boolean(),
  delegate_meetings_opt_in: z.boolean(),
});

export async function saveDelegateProfile(token: string, input: unknown): Promise<TpResult> {
  if (!isToken(token)) return { success: false, error: "This pass link is not valid" };
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your choices" };
  const v = parsed.data;
  const { data, error } = await tpService()
    .from("tp_delegates")
    .update({
      needs: [...new Set(v.needs)],
      offers: [...new Set(v.offers)],
      partner_meetings_opt_in: v.partner_meetings_opt_in,
      delegate_meetings_opt_in: v.delegate_meetings_opt_in,
    })
    .eq("token", token)
    .select("id");
  if (error) return { success: false, error: "Could not save. Please try again." };
  if (!data?.length) return { success: false, error: "This pass link is not valid" };
  revalidatePath(`/take-pride/pass/${token}`, "layout");
  return { success: true, data: null };
}
