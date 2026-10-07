"use server";

import { revalidatePath } from "next/cache";
import { requireRxDuty, type RxDuty } from "@/lib/recognitions/auth";
import { audit, getAwardState, type AwardState } from "@/lib/recognitions/data";
import { rxService } from "@/lib/recognitions/supabase";
import { dutySeesNomination } from "@/lib/recognitions/scoring";
import { countWords } from "@/lib/recognitions/words";
import { PARAM_KEYS, WORDS } from "@/lib/recognitions/constants";
import type { ActionResult, NominationRow, ScoreParams, ScoreRow } from "@/lib/recognitions/types";
import { formatWhen } from "@/app/recognitions/_ui/primitives";
import { scoringWindow } from "@/app/recognitions/(desk)/score/score-rules";
import type { FlagInput, SaveScoreInput } from "@/app/recognitions/(desk)/score/score-types";

// Hard character caps so a single giant "word" can't slip past the word count.
const MAX_REASON_CHARS = 1000;
const MAX_COMMENT_CHARS = 5000;

type Ctx = { duty: RxDuty; personId: string; state: AwardState; nomination: NominationRow };

/**
 * Shared checks for every scoring-desk write: the duty is the caller's, the
 * scoring window is open, and the nomination is one this duty may see
 * (re-checked here — the client's id is never trusted).
 */
async function loadContext(evaluatorId: string, nominationId: string): Promise<
  { ok: true; ctx: Ctx } | { ok: false; error: string }
> {
  const gate = await requireRxDuty(evaluatorId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const duty = gate.value;

  const state = await getAwardState(duty.award_id);
  if (!state) return { ok: false, error: "This award no longer exists. Go back to your sheets and reload." };

  const win = scoringWindow(state.phase, state.cycle);
  if (win.state === "notYet") {
    return {
      ok: false,
      error: state.cycle.nomination_deadline
        ? `Scoring opens when nominations close on ${formatWhen(state.cycle.nomination_deadline)}.`
        : "Scoring opens once the nomination deadline has been set and has passed.",
    };
  }
  if (win.state === "closed") {
    return { ok: false, error: `Scoring closed on ${formatWhen(state.cycle.stage1_deadline)}.` };
  }
  if (win.state === "over") {
    return { ok: false, error: "Stage 1 is over for this award, so marks and flags can no longer change." };
  }

  const nomination = state.nominations.find((n) => n.id === nominationId);
  // Fail closed: a duty with no conflict entry is treated as unable to see anything.
  const conflicts = state.conflictsByDuty.get(duty.id);
  if (!nomination || !conflicts || !dutySeesNomination(duty, nomination, conflicts)) {
    return { ok: false, error: "This chapter is not on your scoring sheet. Reload the page and pick a chapter from the strip." };
  }
  return { ok: true, ctx: { duty, personId: gate.viewer.personId, state, nomination } };
}

/** Save a draft or submit marks for one chapter on one duty's sheet. */
export async function saveScore(input: SaveScoreInput): Promise<ActionResult> {
  const loaded = await loadContext(input?.evaluatorId ?? "", input?.nominationId ?? "");
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { duty, personId, state, nomination } = loaded.ctx;
  const submit = input.submit === true;

  // ---- parameters: integers 0-5, only p1..p5; drafts may be partial ----
  const params: ScoreParams = {};
  const raw = input.params && typeof input.params === "object" ? input.params : {};
  for (const key of Object.keys(raw)) {
    if (!(PARAM_KEYS as readonly string[]).includes(key)) {
      return { success: false, error: "The sheet sent a mark the matrix doesn't have. Reload the page and try again." };
    }
  }
  for (const key of PARAM_KEYS) {
    const v = raw[key];
    if (v === null || v === undefined) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 5) {
      return { success: false, error: "Each mark must be a whole number from 0 to 5." };
    }
    params[key] = v;
  }
  if (submit && PARAM_KEYS.some((k) => params[k] === undefined)) {
    const missing = PARAM_KEYS.filter((k) => params[k] === undefined).length;
    return { success: false, error: `Mark all five parameters before submitting (${missing} still unmarked).` };
  }

  // ---- justification: always five boxes, 50 words each ----
  if (!Array.isArray(input.reasons) || input.reasons.length !== 5 || input.reasons.some((r) => typeof r !== "string")) {
    return { success: false, error: "The sheet sent the wrong number of reasons. Reload the page and try again." };
  }
  const reasons = input.reasons.map((r) => r.trim());
  for (let i = 0; i < 5; i++) {
    const words = countWords(reasons[i]);
    // Word limits apply to drafts too, so a saved draft is always submittable on length.
    if (words > WORDS.evaluatorReason) {
      return { success: false, error: `Reason ${i + 1} is ${words} words; the limit is ${WORDS.evaluatorReason}. Shorten it and try again.` };
    }
    if (reasons[i].length > MAX_REASON_CHARS) {
      return { success: false, error: `Reason ${i + 1} is over ${MAX_REASON_CHARS} characters. Shorten it and try again.` };
    }
    if (submit && reasons[i] === "") {
      return { success: false, error: `Reason ${i + 1} is empty. Write all five reasons before submitting.` };
    }
  }

  // ---- NMT additional comments (optional, 250 words); RM always null ----
  let comments: string | null = null;
  if (duty.layer === "nmt") {
    const c = typeof input.comments === "string" ? input.comments.trim() : "";
    const words = countWords(c);
    if (words > WORDS.nmtComments) {
      return { success: false, error: `Additional comments are ${words} words; the limit is ${WORDS.nmtComments}.` };
    }
    if (c.length > MAX_COMMENT_CHARS) {
      return { success: false, error: `Additional comments are over ${MAX_COMMENT_CHARS} characters. Shorten them and try again.` };
    }
    comments = c === "" ? null : c;
  }

  // ---- frozen once submitted (the DB trigger enforces this too) ----
  const svc = rxService();
  const { data: existing, error: readErr } = await svc
    .from("recognition_scores")
    .select("id, status")
    .eq("evaluator_id", duty.id)
    .eq("nomination_id", nomination.id)
    .maybeSingle();
  if (readErr) {
    console.error(JSON.stringify({ tag: "recognitions_score_read_failed", error: readErr.message }));
    return { success: false, error: "Couldn't load your saved marks. Try again in a moment." };
  }
  if ((existing as Pick<ScoreRow, "id" | "status"> | null)?.status === "submitted") {
    return { success: false, error: "Your marks for this chapter are already submitted and can't be changed." };
  }

  const now = new Date().toISOString();
  const { data: written, error: writeErr } = await svc.from("recognition_scores").upsert(
    {
      nomination_id: nomination.id,
      evaluator_id: duty.id,
      layer: duty.layer,
      params,
      reasons,
      additional_comments: comments,
      status: submit ? "submitted" : "draft",
      submitted_at: submit ? now : null,
      updated_at: now,
    },
    { onConflict: "nomination_id,evaluator_id" }
  ).select("id").maybeSingle();
  if (writeErr) {
    console.error(JSON.stringify({ tag: "recognitions_score_write_failed", error: writeErr.message }));
    if (/frozen/i.test(writeErr.message)) {
      return { success: false, error: "These marks were already submitted and can't be changed." };
    }
    return { success: false, error: "Couldn't save your marks. Try again; if it keeps failing, tell the Recognitions super admin." };
  }

  // Audit without the marks themselves — the log is read by oversight, but marks stay in one place.
  // Only submissions are logged: drafts auto-save every few seconds while an
  // evaluator types, and logging each one would bury the trail.
  if (submit) await audit({
    cycleId: state.cycle.id,
    awardId: duty.award_id,
    actorPersonId: personId,
    action: "score_submitted",
    entity: "recognition_scores",
    entityId: (written as { id: string } | null)?.id ?? (existing as { id: string } | null)?.id ?? null,
    detail: { nomination_id: nomination.id, chapter_id: nomination.chapter_id, layer: duty.layer, evaluator_id: duty.id },
  });

  // ---- Stage 2 unlock (mail 1, Phase 3): 100% RM AND 100% NMT submitted ----
  if (submit) {
    const after = await getAwardState(duty.award_id);
    if (after && after.completeness.complete) {
      const { data: unlocked, error: unlockErr } = await svc
        .from("recognition_awards")
        .update({
          stage2_unlocked_at: new Date().toISOString(),
          stage2_unlock_reason: "All Regional Mentor and NMT marks submitted",
          stage2_unlocked_by: null,
        })
        .eq("id", duty.award_id)
        .is("stage2_unlocked_at", null) // only the first finisher records the unlock
        .select("id");
      if (unlockErr) {
        console.error(JSON.stringify({ tag: "recognitions_stage2_unlock_failed", error: unlockErr.message }));
      } else if ((unlocked ?? []).length > 0) {
        // audit() needs an actor: the submitter whose marks completed the set; the unlock itself is automatic.
        await audit({
          cycleId: state.cycle.id,
          awardId: duty.award_id,
          actorPersonId: personId,
          action: "stage2_unlocked",
          entity: "recognition_awards",
          entityId: duty.award_id,
          detail: { automatic: true, reason: "All Regional Mentor and NMT marks submitted" },
        });
      }
    }
  }

  revalidatePath("/recognitions", "layout");
  return { success: true, message: submit ? "Marks submitted." : "Draft saved." };
}

/**
 * Regional Mentor: recommend this chapter to the NMT (mail 1, user type 2).
 * One shared flag per nomination. Only the RM who set it can withdraw it;
 * withdrawing also clears any NMT approval of that recommendation.
 */
export async function setRmRecommendation(input: FlagInput): Promise<ActionResult> {
  const loaded = await loadContext(input?.evaluatorId ?? "", input?.nominationId ?? "");
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { duty, personId, state, nomination } = loaded.ctx;
  if (duty.layer !== "rm") return { success: false, error: "Only a Regional Mentor can recommend a chapter to the NMT." };

  const svc = rxService();
  const now = new Date().toISOString();
  if (input.on) {
    if (nomination.rm_recommended_by) return { success: true, message: "Already recommended to the NMT." };
    const { data, error } = await svc
      .from("recognition_nominations")
      .update({ rm_recommended_by: personId, rm_recommended_at: now, updated_at: now })
      .eq("id", nomination.id)
      .is("rm_recommended_by", null)
      .select("id");
    if (error) return writeFailed("recommend", error.message);
    if ((data ?? []).length === 0) return { success: true, message: "Already recommended to the NMT." };
  } else {
    if (!nomination.rm_recommended_by) return { success: true, message: "Not recommended." };
    if (nomination.rm_recommended_by !== personId) {
      return { success: false, error: "Another Regional Mentor made this recommendation, so only they can withdraw it." };
    }
    const { error } = await svc
      .from("recognition_nominations")
      .update({
        rm_recommended_by: null,
        rm_recommended_at: null,
        nmt_approved_by: null,
        nmt_approved_at: null,
        updated_at: now,
      })
      .eq("id", nomination.id)
      .eq("rm_recommended_by", personId);
    if (error) return writeFailed("withdraw", error.message);
  }

  await audit({
    cycleId: state.cycle.id,
    awardId: duty.award_id,
    actorPersonId: personId,
    action: input.on ? "rm_recommended" : "rm_recommendation_withdrawn",
    entity: "recognition_nominations",
    entityId: nomination.id,
    detail: { chapter_id: nomination.chapter_id, evaluator_id: duty.id, cleared_nmt_approval: !input.on && !!nomination.nmt_approved_by },
  });
  revalidatePath("/recognitions", "layout");
  return { success: true, message: input.on ? "Recommended to the NMT." : "Recommendation withdrawn." };
}

/**
 * NMT: approve a Regional Mentor's recommendation (mail 1, user type 3).
 * Only possible while the chapter is recommended. Only the NMT member who
 * approved can withdraw the approval.
 */
export async function setNmtApproval(input: FlagInput): Promise<ActionResult> {
  const loaded = await loadContext(input?.evaluatorId ?? "", input?.nominationId ?? "");
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { duty, personId, state, nomination } = loaded.ctx;
  if (duty.layer !== "nmt") return { success: false, error: "Only the NMT can approve a Regional Mentor's recommendation." };

  const svc = rxService();
  const now = new Date().toISOString();
  if (input.on) {
    if (!nomination.rm_recommended_by) {
      return { success: false, error: "No Regional Mentor has recommended this chapter, so there is nothing to approve." };
    }
    if (nomination.nmt_approved_by) return { success: true, message: "Already approved." };
    const { data, error } = await svc
      .from("recognition_nominations")
      .update({ nmt_approved_by: personId, nmt_approved_at: now, updated_at: now })
      .eq("id", nomination.id)
      .not("rm_recommended_by", "is", null)
      .is("nmt_approved_by", null)
      .select("id");
    if (error) return writeFailed("approve", error.message);
    if ((data ?? []).length === 0) return { success: true, message: "Already approved, or the recommendation was withdrawn. Reload to see the current state." };
  } else {
    if (!nomination.nmt_approved_by) return { success: true, message: "Not approved." };
    if (nomination.nmt_approved_by !== personId) {
      return { success: false, error: "Another NMT member approved this recommendation, so only they can withdraw it." };
    }
    const { error } = await svc
      .from("recognition_nominations")
      .update({ nmt_approved_by: null, nmt_approved_at: null, updated_at: now })
      .eq("id", nomination.id)
      .eq("nmt_approved_by", personId);
    if (error) return writeFailed("withdraw approval", error.message);
  }

  await audit({
    cycleId: state.cycle.id,
    awardId: duty.award_id,
    actorPersonId: personId,
    action: input.on ? "nmt_approved_recommendation" : "nmt_approval_withdrawn",
    entity: "recognition_nominations",
    entityId: nomination.id,
    detail: { chapter_id: nomination.chapter_id, evaluator_id: duty.id },
  });
  revalidatePath("/recognitions", "layout");
  return { success: true, message: input.on ? "Recommendation approved." : "Approval withdrawn." };
}

async function writeFailed(what: string, message: string): Promise<ActionResult> {
  console.error(JSON.stringify({ tag: "recognitions_flag_write_failed", what, error: message }));
  return { success: false, error: `Couldn't ${what} just now. Try again; if it keeps failing, tell the Recognitions super admin.` };
}
