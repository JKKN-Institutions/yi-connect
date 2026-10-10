"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { hasReviewSession, requireTpOrganiser } from "@/lib/take-pride/auth";
import { awardInCurrentCycle, invalidateRevealFeed, isCategory, isUuid, revealCheck } from "@/lib/take-pride/recognitions-bridge";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Awards Night desk actions. Every one denies explicitly with
 * { success:false, error }. Never a redirect.
 *
 * Real organisers only (requireTpOrganiser), rehearsal included: reveals
 * land in the shared tp_award_reveals table that the public hall screen
 * reads, so review mode (outside reviewers) gets no Awards Night actions.
 */

async function gate(): Promise<{ ok: true; personId: string } | { ok: false; error: string }> {
  const g = await requireTpOrganiser();
  if (!g.ok) {
    if (await hasReviewSession()) return { ok: false, error: "Awards Night is not available in review mode." };
    return {
      ok: false,
      error: g.reason === "signed_out" ? "Sign in with your Yi account first." : "Only the Take Pride team can run Awards Night.",
    };
  }
  return { ok: true, personId: g.personId };
}

async function existing(awardId: string, category: string) {
  const { data, error } = await tpService()
    .from("tp_award_reveals")
    .select("id, is_rehearsal, moderation_version_id")
    .eq("award_id", awardId)
    .eq("category", category)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; is_rehearsal: boolean; moderation_version_id: string | null } | null;
}

/**
 * Real reveal: puts the approved winner on the hall screen. The row stores the
 * approved moderation version, so the screen hides it if the result changes.
 * A real reveal whose result changed since ("stale") can be revealed again.
 */
export async function revealAward(awardId: string, category: string): Promise<TpResult> {
  const g = await gate();
  if (!g.ok) return { success: false, error: g.error };
  if (!isUuid(awardId) || !isCategory(category)) return { success: false, error: "That award is not valid." };

  // Re-verify approval immediately before the write.
  const check = await revealCheck(awardId, category);
  if (!check.ok) return { success: false, error: check.error };

  const db = tpService();
  const prior = await existing(awardId, category);
  if (prior && !prior.is_rehearsal && prior.moderation_version_id === check.versionId) {
    return { success: false, error: "This award is already on the screen." };
  }
  if (prior) {
    // A rehearsal, or a real reveal of an older approved result.
    const { error } = await db.from("tp_award_reveals").delete().eq("id", prior.id);
    if (error) return { success: false, error: "Could not replace the earlier reveal. Try again." };
  }
  const { error } = await db.from("tp_award_reveals").insert({
    award_id: awardId,
    category,
    revealed_by: g.personId,
    is_rehearsal: false,
    moderation_version_id: check.versionId,
  });
  if (error) return { success: false, error: "The reveal was not saved. Try again." };
  await invalidateRevealFeed();
  revalidatePath("/take-pride/desk/awards");
  return { success: true, data: null };
}

/** Rehearsal reveal: placeholder only, never a real chapter. */
export async function rehearseReveal(awardId: string, category: string): Promise<TpResult> {
  const g = await gate();
  if (!g.ok) return { success: false, error: g.error };
  if (!isUuid(awardId) || !isCategory(category)) return { success: false, error: "That award is not valid." };
  if (!(await awardInCurrentCycle(awardId))) return { success: false, error: "This award is not in the current Recognitions cycle." };

  const prior = await existing(awardId, category);
  if (prior) {
    return {
      success: false,
      error: prior.is_rehearsal ? "This one is already on the screen as a rehearsal." : "This award is already revealed for real.",
    };
  }
  const { error } = await tpService()
    .from("tp_award_reveals")
    .insert({ award_id: awardId, category, revealed_by: g.personId, is_rehearsal: true });
  if (error) return { success: false, error: "The rehearsal reveal was not saved. Try again." };
  await invalidateRevealFeed();
  revalidatePath("/take-pride/desk/awards");
  return { success: true, data: null };
}

/** Removes every rehearsal reveal. Real reveals are never touched. */
export async function clearRehearsal(): Promise<TpResult<{ cleared: number }>> {
  const g = await gate();
  if (!g.ok) return { success: false, error: g.error };
  const { data, error } = await tpService().from("tp_award_reveals").delete().eq("is_rehearsal", true).select("id");
  if (error) return { success: false, error: "Could not clear the rehearsal. Try again." };
  await invalidateRevealFeed();
  revalidatePath("/take-pride/desk/awards");
  return { success: true, data: { cleared: (data ?? []).length } };
}
