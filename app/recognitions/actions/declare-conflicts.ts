"use server";

import { revalidatePath } from "next/cache";
import { requireRxDuty } from "@/lib/recognitions/auth";
import { audit, getAwardState, listScoresForDuty } from "@/lib/recognitions/data";
import { rxService } from "@/lib/recognitions/supabase";
import { dutySeesNomination } from "@/lib/recognitions/scoring";
import type { ActionResult } from "@/lib/recognitions/types";

/**
 * An NMT member or Regional Mentor declares their own conflicts (Piyush,
 * 28 Oct: "should be done by the NMT or RM themselves"). Add-only: a declared
 * conflict can be lifted only by the super admin on the Evaluators page.
 * A chapter they have already submitted marks for can't be declared here.
 */
export async function declareConflicts(input: { evaluatorId: string; chapterIds: string[] }): Promise<ActionResult> {
  const gate = await requireRxDuty(input.evaluatorId);
  if (!gate.ok) return { success: false, error: gate.error };
  const duty = gate.value;

  const state = await getAwardState(duty.award_id);
  if (!state) return { success: false, error: "This recognition no longer exists. Go back to your sheets and reload." };

  // Only chapters this duty would otherwise score: in the race, and in the Mentor's region.
  const inScope = new Set(
    state.nominations.filter((n) => dutySeesNomination(duty, n, new Set())).map((n) => n.chapter_id)
  );
  const wanted = [...new Set(input.chapterIds ?? [])];
  if (wanted.length === 0) return { success: false, error: "Tick at least one chapter first." };
  if (wanted.some((id) => !inScope.has(id))) {
    return { success: false, error: "One of those chapters is not on your sheet any more. Reload the page and try again." };
  }

  const scored = new Set(
    (await listScoresForDuty(duty.id))
      .filter((s) => s.status === "submitted")
      .map((s) => state.nominations.find((n) => n.id === s.nomination_id)?.chapter_id)
  );
  if (wanted.some((id) => scored.has(id))) {
    return { success: false, error: "You have already submitted marks for one of those chapters. Ask the Recognitions super admin." };
  }

  // Read the row fresh so an admin's change made meanwhile is kept.
  const svc = rxService();
  const { data, error: readError } = await svc
    .from("recognition_evaluators")
    .select("conflict_chapter_ids")
    .eq("id", duty.id)
    .maybeSingle();
  if (readError || !data) return { success: false, error: "Couldn't read your sheet. Try again." };
  const before: string[] = (data as { conflict_chapter_ids: string[] | null }).conflict_chapter_ids ?? [];
  const added = wanted.filter((id) => !before.includes(id));
  if (added.length === 0) return { success: true, message: "Those chapters were already declared." };

  const { error } = await svc
    .from("recognition_evaluators")
    .update({ conflict_chapter_ids: [...before, ...added] })
    .eq("id", duty.id);
  if (error) return { success: false, error: "Couldn't save your conflicts. Try again." };

  await audit({
    cycleId: state.cycle.id,
    awardId: duty.award_id,
    actorPersonId: gate.viewer.personId,
    action: "declare_conflicts",
    entity: "evaluator",
    entityId: duty.id,
    detail: { added, by: "self" },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: `Saved. ${added.length === 1 ? "That chapter is" : `Those ${added.length} chapters are`} off your sheet.`,
  };
}
