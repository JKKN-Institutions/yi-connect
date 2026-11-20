"use server";

import { revalidatePath } from "next/cache";
import { requireRxNmtLeader } from "@/lib/recognitions/auth";
import { audit, getAwardState } from "@/lib/recognitions/data";
import { mentorRescoreOpen, scoreSight } from "@/lib/recognitions/sight";
import { isPast } from "@/lib/recognitions/phase";
import { rxService } from "@/lib/recognitions/supabase";
import { countWords } from "@/lib/recognitions/words";
import { MENTOR_SENDBACK_CLOSED, MENTOR_SENDBACK_ENABLED } from "@/lib/recognitions/constants";
import type { ActionResult } from "@/lib/recognitions/types";
import { formatWhen } from "../_ui/primitives";

/**
 * The NMT leader sends a recognition back to its Regional Mentors with a
 * compulsory remark (recognitions_05, Piyush 15 Oct 2026). Every submitted
 * Mentor mark is copied into the score history and reopened as a draft of
 * the next round (marks kept as the starting point). Nothing is deleted.
 * Director, 16 Nov 2026: until a Mentor resubmits, their earlier submitted
 * mark counts, and it stays counted if they never do
 * (lib/recognitions/scoring.ts withEarlierMarks). It counts as in for Stage 2
 * too, so Stage 2 doesn't wait for the Mentors; they can re-score until the
 * leader submits the ranking, at the latest the cycle's Stage 2 deadline.
 */

const REMARK_WORDS = 100;
const REMARK_CHARS = 2000;

export async function sendBackToMentors(awardId: string, remark: string): Promise<ActionResult> {
  const gate = await requireRxNmtLeader(typeof awardId === "string" ? awardId : "");
  if (!gate.ok) return { success: false, error: gate.error };
  // 20 Nov 2026 (Piyush, approved by the Director): no NMT may send marks back to the Mentors any more.
  if (!MENTOR_SENDBACK_ENABLED) {
    console.log(JSON.stringify({ tag: "recognitions_mentor_sendback_refused", reason: "closed", person: gate.viewer.personId, awardId }));
    return { success: false, error: MENTOR_SENDBACK_CLOSED };
  }
  const personId = gate.viewer.personId;

  const text = typeof remark === "string" ? remark.trim() : "";
  if (text === "") return { success: false, error: "Write a remark for the Regional Mentors. It is compulsory." };
  const words = countWords(text);
  if (words > REMARK_WORDS) return { success: false, error: `The remark is ${words} words; the limit is ${REMARK_WORDS}.` };
  if (text.length > REMARK_CHARS) return { success: false, error: `The remark is over ${REMARK_CHARS} characters.` };

  const state = await getAwardState(awardId);
  if (!state) return { success: false, error: "This recognition no longer exists. Reload the page." };
  if (state.phase !== "stage1" && state.phase !== "stage2") {
    return {
      success: false,
      error:
        state.phase === "setup" || state.phase === "nominations"
          ? "Scoring hasn't started yet, so there is nothing to send back."
          : "The final ranking is already with National Leadership, so the Mentors' marks can no longer be sent back.",
    };
  }
  if (isPast(state.cycle.stage2_deadline)) {
    return { success: false, error: `Stage 2 closed on ${formatWhen(state.cycle.stage2_deadline)}, so the Mentors can't re-score.` };
  }
  const sight = scoreSight(state, gate.viewer.duties);
  if (!sight.sees) return { success: false, error: `Not yet: ${sight.reason}` };
  if (mentorRescoreOpen(state)) {
    return { success: false, error: "The Regional Mentors are still re-scoring after your last send-back. Wait for them to resubmit." };
  }

  const { data, error } = await rxService().rpc("recognition_send_back_to_mentors", {
    p_award_id: state.award.id,
    p_remark: text,
    p_sent_by: personId,
  });
  if (error || !data) {
    console.error(JSON.stringify({ tag: "recognitions_mentor_sendback_failed", error: error?.message, code: error?.code }));
    if (/nothing to send back/i.test(error?.message ?? "")) {
      return { success: false, error: "No Regional Mentor has submitted marks on this recognition yet, so there is nothing to send back." };
    }
    return { success: false, error: "The send-back could not be recorded. Reload the page and try again; if it keeps failing, tell the Recognitions super admin." };
  }
  const out = data as { id: string; round: number; reopened: number };

  await audit({
    cycleId: state.cycle.id,
    awardId: state.award.id,
    actorPersonId: personId,
    action: "sent_back_to_mentors",
    entity: "recognition_mentor_sendbacks",
    entityId: out.id,
    detail: { round: out.round, sheets_reopened: out.reopened, remark: text },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: `Sent back. ${out.reopened} Mentor mark${out.reopened === 1 ? " is" : "s are"} open again as round ${out.round}, until you submit the final ranking (at the latest ${formatWhen(state.cycle.stage2_deadline)}). Until a Mentor resubmits, their earlier marks still count; if they don't resubmit, the earlier marks stay. Stage 2 doesn't wait for them.`,
  };
}
