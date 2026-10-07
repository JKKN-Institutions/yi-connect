"use server";

import { revalidatePath } from "next/cache";
import { requireRxNationalLeadership } from "@/lib/recognitions/auth";
import { audit, getAwardState } from "@/lib/recognitions/data";
import { rxService } from "@/lib/recognitions/supabase";
import type { ActionResult } from "@/lib/recognitions/types";

/**
 * Phase 4 governance: National Leadership approves the latest submitted
 * moderation or sends it back to the NMT leader with a reason. Decisions are
 * append-only rows; the send-back is what the NMT leader sees as their
 * notification in the Stage 2 room.
 */

// Technical cap only (the spec gives no word limit for the send-back reason).
const MAX_REASON_CHARS = 3000;

async function decide(awardId: string, decision: "approve" | "reevaluate", reason: string | null): Promise<ActionResult> {
  const gate = await requireRxNationalLeadership();
  if (!gate.ok) return { success: false, error: gate.error };
  const personId = gate.viewer.personId;

  const state = await getAwardState(awardId);
  if (!state) return { success: false, error: "This award no longer exists. Go back to Review and reload." };
  if (state.phase !== "governance") {
    return {
      success: false,
      error:
        state.phase === "finalized"
          ? "This award is already finalised."
          : state.phase === "reevaluation"
            ? "This award has already been sent back. Wait for the NMT leader to submit a revised version."
            : "There is no submitted moderation waiting for a decision on this award.",
    };
  }
  const version = state.latestSubmittedVersion;
  if (!version || version.id !== state.latestVersion?.id) {
    return { success: false, error: "The moderation changed while you were reading. Reload the page and decide again." };
  }

  const { data, error } = await rxService()
    .from("recognition_governance_decisions")
    .insert({
      award_id: awardId,
      moderation_version_id: version.id,
      decision,
      reason,
      decided_by: personId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      success: false,
      error: "The decision could not be recorded. Reload the page and try again; if it keeps failing, tell the Recognitions super admin.",
    };
  }

  await audit({
    cycleId: state.cycle.id,
    awardId,
    actorPersonId: personId,
    action: decision === "approve" ? "award_approved" : "award_sent_back",
    entity: "governance_decision",
    entityId: (data as { id: string }).id,
    detail: { moderation_version: version.version, moderation_version_id: version.id, reason },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message:
      decision === "approve"
        ? `Approved. ${state.award.title} is finalised on version ${version.version}.`
        : `Sent back. The NMT leader will see your reason and can reopen the moderation.`,
  };
}

/** Approve the latest submitted moderation. Finalises the award. */
export async function approveAward(awardId: string): Promise<ActionResult> {
  return decide(awardId, "approve", null);
}

/** Send the latest submitted moderation back to the NMT leader. Reason required. */
export async function sendBackForReevaluation(awardId: string, reason: string): Promise<ActionResult> {
  const text = String(reason ?? "").trim();
  if (text === "") {
    return { success: false, error: "Write the reason for the re-evaluation. The NMT leader needs it to know what to change." };
  }
  if (text.length > MAX_REASON_CHARS) {
    return { success: false, error: `The reason is too long. Keep it under ${MAX_REASON_CHARS} characters.` };
  }
  return decide(awardId, "reevaluate", text);
}
