"use server";

import { revalidatePath } from "next/cache";
import { requireRxNmtLeader } from "@/lib/recognitions/auth";
import { audit, chapterMap, getAwardState, latestDecisionFor, type AwardState } from "@/lib/recognitions/data";
import { isPast } from "@/lib/recognitions/phase";
import { rxService } from "@/lib/recognitions/supabase";
import type { ActionResult } from "@/lib/recognitions/types";
import { formatWhen } from "@/app/recognitions/_ui/primitives";
import { validateModeration, type ModerationInput } from "@/app/recognitions/_parts/shared";

/**
 * Stage 2 moderation and Stage 3 re-evaluation (mail 1, Phases 3 and 5).
 * APPEND-ONLY: a draft version may be edited; submitting freezes it (the
 * database trigger refuses any later UPDATE). A send-back opens version N+1
 * as a draft copy of version N. Nothing here ever updates a submitted row.
 */

const TABLE = "recognition_moderation_versions";

function friendly(message: string | undefined, code?: string): string {
  if (code === "23505") {
    return "Someone started a moderation version for this award at the same moment. Reload the page and try again.";
  }
  if ((message ?? "").includes("frozen")) {
    return "This version has already been submitted, so it can no longer change. Reload the page to see it.";
  }
  return "The ranking could not be saved. Reload the page and try again; if it keeps failing, tell the Recognitions super admin.";
}

function notOpen(state: AwardState): string | null {
  switch (state.phase) {
    case "setup":
    case "nominations":
    case "stage1":
      return "Stage 2 opens when every Regional Mentor and NMT mark is in.";
    case "governance":
      return "This moderation is submitted and waiting for National Leadership. It can no longer change.";
    case "finalized":
      return "National Leadership has approved this award. The ranking can no longer change.";
    default:
      return null;
  }
}

function windowClosed(state: AwardState): string | null {
  if (state.phase === "stage2" && isPast(state.cycle.stage2_deadline)) {
    return `Stage 2 moderation closed on ${formatWhen(state.cycle.stage2_deadline)}.`;
  }
  if (state.phase === "reevaluation" && isPast(state.cycle.reevaluation_deadline)) {
    return `Re-evaluation closed on ${formatWhen(state.cycle.reevaluation_deadline)}.`;
  }
  return null;
}

async function persist(awardId: string, input: ModerationInput, submit: boolean): Promise<ActionResult> {
  const gate = await requireRxNmtLeader(awardId);
  if (!gate.ok) return { success: false, error: gate.error };
  const personId = gate.viewer.personId;

  const state = await getAwardState(awardId);
  if (!state) return { success: false, error: "This award no longer exists. Go back to Stage 2 and reload." };

  const blocked = notOpen(state) ?? windowClosed(state);
  if (blocked) return { success: false, error: blocked };
  if (state.submittedNominations.length === 0) {
    return { success: false, error: "There are no submitted nominations to rank for this award." };
  }

  const draft = state.latestVersion?.status === "draft" ? state.latestVersion : null;
  // In re-evaluation the new version must be opened on purpose (it records which send-back it answers).
  if (state.phase === "reevaluation" && !draft) {
    return { success: false, error: "Press \"Reopen moderation\" first. It starts a new version for the re-evaluation." };
  }

  const checked = validateModeration(input, state.submittedNominations, await chapterMap(), submit);
  if (!checked.ok) return { success: false, error: checked.error };

  const svc = rxService();
  const now = new Date().toISOString();
  const submitFields = submit ? { status: "submitted", submitted_by: personId, submitted_at: now } : {};
  let versionId: string;
  let versionNo: number;

  if (draft) {
    // The last allowed write to this row when submit=true: the trigger freezes it after.
    const { data, error } = await svc
      .from(TABLE)
      .update({ rankings: checked.rankings, top3: checked.top3, ...submitFields })
      .eq("id", draft.id)
      .eq("status", "draft")
      .select("id, version");
    if (error) return { success: false, error: friendly(error.message, error.code) };
    const row = (data ?? [])[0] as { id: string; version: number } | undefined;
    if (!row) {
      return { success: false, error: "This version was submitted in the meantime. Reload the page to see it." };
    }
    versionId = row.id;
    versionNo = row.version;
  } else {
    // Stage 2, nothing saved yet: version 1 (or the next number, should older versions exist).
    const next = (state.versions[0]?.version ?? 0) + 1;
    const { data, error } = await svc
      .from(TABLE)
      .insert({
        award_id: awardId,
        version: next,
        status: "draft",
        rankings: checked.rankings,
        top3: checked.top3,
        responds_to_decision_id: null,
        created_by: personId,
        ...submitFields,
      })
      .select("id, version")
      .single();
    if (error || !data) return { success: false, error: friendly(error?.message, error?.code) };
    versionId = (data as { id: string }).id;
    versionNo = (data as { version: number }).version;
  }

  await audit({
    cycleId: state.cycle.id,
    awardId,
    actorPersonId: personId,
    action: submit ? "moderation_submitted" : "moderation_draft_saved",
    entity: "moderation_version",
    entityId: versionId,
    detail: {
      version: versionNo,
      phase: state.phase,
      podium_places: checked.top3.length,
      ranked: checked.rankings.filter((r) => r.final_rank !== null).length,
    },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: submit
      ? `Version ${versionNo} submitted. National Leadership can now review it.`
      : `Draft saved as version ${versionNo}. Only you can change it until you submit.`,
  };
}

/** Save the NMT leader's working ranking without submitting it. */
export async function saveModerationDraft(awardId: string, input: ModerationInput): Promise<ActionResult> {
  return persist(awardId, input, false);
}

/** Submit the final ranking + podium texts. Freezes the version. */
export async function submitModeration(awardId: string, input: ModerationInput): Promise<ActionResult> {
  return persist(awardId, input, true);
}

/**
 * Phase 5: after National Leadership sends the award back, open version N+1
 * as a draft copy of version N, linked to that decision.
 */
export async function reopenModeration(awardId: string): Promise<ActionResult> {
  const gate = await requireRxNmtLeader(awardId);
  if (!gate.ok) return { success: false, error: gate.error };
  const personId = gate.viewer.personId;

  const state = await getAwardState(awardId);
  if (!state) return { success: false, error: "This award no longer exists. Go back to Stage 2 and reload." };
  if (state.phase !== "reevaluation") {
    return { success: false, error: "This award has not been sent back for re-evaluation, so there is nothing to reopen." };
  }
  const latest = state.latestVersion;
  if (latest?.status === "draft") {
    return { success: true, message: `Version ${latest.version} is already open for re-evaluation.` };
  }
  if (!latest) return { success: false, error: "There is no submitted moderation to reopen." };
  const decision = latestDecisionFor(state.decisions, latest.id);
  if (!decision || decision.decision !== "reevaluate") {
    return { success: false, error: "National Leadership has not sent this version back. Reload the page." };
  }
  const closed = windowClosed(state);
  if (closed) return { success: false, error: closed };

  const next = (state.versions[0]?.version ?? latest.version) + 1;
  const { data, error } = await rxService()
    .from(TABLE)
    .insert({
      award_id: awardId,
      version: next,
      status: "draft",
      rankings: latest.rankings,
      top3: latest.top3,
      responds_to_decision_id: decision.id,
      created_by: personId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: friendly(error?.message, error?.code) };

  await audit({
    cycleId: state.cycle.id,
    awardId,
    actorPersonId: personId,
    action: "moderation_reopened",
    entity: "moderation_version",
    entityId: (data as { id: string }).id,
    detail: { version: next, copied_from_version: latest.version, decision_id: decision.id },
  });
  revalidatePath("/recognitions", "layout");
  return { success: true, message: `Version ${next} opened as a copy of version ${latest.version}. Amend it and submit again.` };
}
