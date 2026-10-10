"use server";

import { revalidatePath } from "next/cache";
import { tpService } from "@/lib/take-pride/supabase";
import { hasReviewSession, requireTpDesk, requireTpOrganiser } from "@/lib/take-pride/auth";
import { awardInCurrentCycle, invalidateRevealFeed, isCategory, isUuid, revealCheck } from "@/lib/take-pride/recognitions-bridge";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Awards Night desk actions. Every one denies explicitly with
 * { success:false, error }. Never a redirect.
 *
 * The REAL reveal is for real organisers only (requireTpOrganiser). Review
 * mode (outside reviewers, /take-pride/review) may use REHEARSAL only: its
 * rehearsal rows carry revealed_by = null, and its "clear" removes only
 * those, never a real organiser's rehearsal.
 */

async function gate(): Promise<{ ok: true; personId: string } | { ok: false; error: string }> {
  const g = await requireTpOrganiser();
  if (!g.ok) {
    if (await hasReviewSession()) return { ok: false, error: "Not available in review mode. Review mode can rehearse only." };
    return {
      ok: false,
      error: g.reason === "signed_out" ? "Sign in with your Yi account first." : "Only the Take Pride team can run Awards Night.",
    };
  }
  return { ok: true, personId: g.personId };
}

/** Rehearsal gate: real organisers, or a review session (personId null). */
async function rehearsalGate(): Promise<{ ok: true; personId: string | null } | { ok: false; error: string }> {
  const g = await requireTpDesk();
  if (!g.ok) {
    return {
      ok: false,
      error: g.reason === "signed_out" ? "Sign in with your Yi account first." : "Only the Take Pride team can run Awards Night.",
    };
  }
  return { ok: true, personId: g.mode === "real" ? g.personId : null };
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
  const g = await rehearsalGate();
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

/**
 * Removes rehearsal reveals. Real reveals are never touched. A review
 * session clears only review rehearsals (revealed_by is null).
 */
export async function clearRehearsal(): Promise<TpResult<{ cleared: number }>> {
  const g = await rehearsalGate();
  if (!g.ok) return { success: false, error: g.error };
  const q = tpService().from("tp_award_reveals").delete().eq("is_rehearsal", true);
  const { data, error } = await (g.personId === null ? q.is("revealed_by", null) : q).select("id");
  if (error) return { success: false, error: "Could not clear the rehearsal. Try again." };
  await invalidateRevealFeed();
  revalidatePath("/take-pride/desk/awards");
  return { success: true, data: { cleared: (data ?? []).length } };
}
