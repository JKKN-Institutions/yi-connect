"use server";

import { revalidatePath } from "next/cache";
import { requireRxNationalLeadership } from "@/lib/recognitions/auth";
import { getAwardState } from "@/lib/recognitions/data";
import { recordDecision } from "@/lib/recognitions/governance";
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

  const res = await recordDecision({ state, personId, decision, reason });
  if (!res.ok) return { success: false, error: res.error };
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message:
      decision === "approve"
        ? `Approved. ${state.award.title} is finalised on version ${res.version}.`
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
