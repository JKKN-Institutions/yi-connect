"use server";

import { revalidatePath } from "next/cache";
import { requireRxOversight } from "@/lib/recognitions/auth";
import { audit, getAward, getAwardState, getCurrentCycle } from "@/lib/recognitions/data";
import { recordDecision } from "@/lib/recognitions/governance";
import { addWindow, chapterAddRefusal } from "@/lib/recognitions/nl-add";
import { canFix, fixDeadlineFor, isNlAdded } from "@/lib/recognitions/check-rules";
import { rxService } from "@/lib/recognitions/supabase";
import { countWords } from "@/lib/recognitions/words";
import { WORDS } from "@/lib/recognitions/constants";
import type { ActionResult, NominationRow } from "@/lib/recognitions/types";
import { formatWhen } from "../_ui/primitives";

/**
 * National Leadership adds a chapter that did not nominate (recognitions_03).
 * Take Pride 2026 briefing: National Leadership may find a chapter "which has
 * done great but they have not nominated ... they deserve to be there", and
 * that triggers re-evaluation. Director, 2026-10-10:
 *   - National Leadership (or the Recognitions super admin) adds it with ONE
 *     short reason (100 words); the chapter fills nothing.
 *   - It still needs the Regional Chair + Regional Mentor check. A send-back
 *     comes to National Leadership, which edits the reason and resubmits
 *     (both passes cleared). All of it until the re-evaluation deadline.
 *   - Adding puts the award into re-evaluation: in National Leadership
 *     review it records the same "send back for re-evaluation" decision as
 *     the Review page; if it is already being re-evaluated it just adds.
 * Every write is audited. Every denial is { success:false, error }.
 */

/** Technical cap only; the real limit is 100 words. Matches the DB CHECK in migration 03. */
const MAX_REASON_CHARS = 2000;

function checkReason(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return { ok: false, error: "Write why this chapter deserves to be considered. The checkers and the NMT read it instead of a nomination form." };
  const words = countWords(text);
  if (words > WORDS.nlAddedReason) {
    return { ok: false, error: `The reason is ${words} words; the limit is ${WORDS.nlAddedReason}. Shorten it and try again.` };
  }
  if (text.length > MAX_REASON_CHARS) {
    return { ok: false, error: `The reason is over ${MAX_REASON_CHARS} characters. Shorten it and try again.` };
  }
  return { ok: true, text };
}

function writeFailed(what: string, message: string, code?: string): ActionResult {
  console.error(JSON.stringify({ tag: "recognitions_nl_add_write_failed", what, error: message, code }));
  return { success: false, error: `Couldn't ${what} just now. Try again; if it keeps failing, tell the Recognitions super admin.` };
}

/** Add a chapter that did not nominate to an award, with National Leadership's reason. */
export async function addChapterToAward(awardId: string, chapterId: string, reason: string): Promise<ActionResult> {
  const gate = await requireRxOversight();
  if (!gate.ok) return { success: false, error: gate.error };
  const personId = gate.viewer.personId;

  const r = checkReason(reason);
  if (!r.ok) return { success: false, error: r.error };
  if (typeof awardId !== "string" || awardId === "" || typeof chapterId !== "string" || chapterId === "") {
    return { success: false, error: "Pick a chapter first." };
  }

  const state = await getAwardState(awardId);
  if (!state) return { success: false, error: "This award no longer exists. Go back to Review and reload." };
  const win = addWindow(state);
  if (!win.open) return { success: false, error: win.reason };

  const pick = await chapterAddRefusal(state, chapterId);
  if (!pick.ok) return { success: false, error: pick.error };
  const chapter = pick.chapter;

  // In National Leadership review: send the award back first, exactly like
  // "Send back for re-evaluation". If that fails nothing else is written.
  // (Decision first on purpose: if the add below then fails, the award is
  // already in re-evaluation and adding again "just adds".)
  let sentBack = false;
  if (state.phase === "governance") {
    const decided = await recordDecision({
      state,
      personId,
      decision: "reevaluate",
      reason: `National Leadership added ${chapter.name}, which did not nominate: ${r.text}`,
      auditDetail: { nl_added_chapter_id: chapter.id },
    });
    if (!decided.ok) return { success: false, error: decided.error };
    sentBack = true;
  }

  const now = new Date().toISOString();
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .insert({
      award_id: state.award.id,
      chapter_id: chapter.id,
      // Snapshots at add time, exactly like a chapter submission.
      category: chapter.category,
      region: chapter.region,
      status: "submitted",
      submitted_at: now,
      submitted_by: personId,
      origin: "nl_added",
      added_by: personId,
      added_at: now,
      added_reason: r.text,
      created_by: personId,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (sentBack) revalidatePath("/recognitions", "layout");
    const tail = sentBack ? " The award has already been sent back for re-evaluation, so adding again will just add the chapter." : "";
    if (error?.code === "23505") {
      return { success: false, error: `${chapter.name} already has a nomination for this award (it was added a moment ago).${tail}` };
    }
    console.error(JSON.stringify({ tag: "recognitions_nl_add_write_failed", what: "add", error: error?.message, code: error?.code }));
    return {
      success: false,
      error: `Couldn't add ${chapter.name} just now. Try again; if it keeps failing, tell the Recognitions super admin.${tail}`,
    };
  }

  await audit({
    cycleId: state.cycle.id,
    awardId: state.award.id,
    actorPersonId: personId,
    action: "nomination_nl_added",
    entity: "recognition_nominations",
    entityId: (data as { id: string }).id,
    detail: {
      chapter_id: chapter.id,
      category: chapter.category,
      region: chapter.region,
      reason: r.text,
      sent_back_for_reevaluation: sentBack,
    },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: `${chapter.name} added.${sentBack ? " The award is now back with the NMT leader for re-evaluation." : ""} The Regional Chair and a Regional Mentor for ${chapter.region} must both pass it before it is scored, by ${formatWhen(state.cycle.reevaluation_deadline)}.`,
  };
}

type FixCtx = { personId: string; nomination: NominationRow; title: string; cycleId: string; reevaluationDeadline: string | null };

/** Shared preconditions for editing / resubmitting a sent-back NL-added nomination. */
async function fixContext(nominationId: string): Promise<{ ok: true; ctx: FixCtx } | { ok: false; error: string }> {
  const gate = await requireRxOversight();
  if (!gate.ok) return { ok: false, error: gate.error };
  if (typeof nominationId !== "string" || nominationId === "") {
    return { ok: false, error: "No nomination was chosen. Reload the page and try again." };
  }
  const { data, error } = await rxService().from("recognition_nominations").select("*").eq("id", nominationId).maybeSingle();
  if (error) {
    console.error(JSON.stringify({ tag: "recognitions_nl_fix_read_failed", error: error.message }));
    return { ok: false, error: "Couldn't load that nomination just now. Try again." };
  }
  const n = data as NominationRow | null;
  if (!n) return { ok: false, error: "That nomination no longer exists. Reload the page." };
  if (!isNlAdded(n)) {
    return { ok: false, error: "The chapter filed this nomination itself, so only the chapter can change it." };
  }
  const [award, cycle] = await Promise.all([getAward(n.award_id), getCurrentCycle()]);
  if (!award || !award.is_active || !cycle || award.cycle_id !== cycle.id) {
    return { ok: false, error: "That nomination is not part of this year's open awards." };
  }
  if (n.status !== "returned") {
    return { ok: false, error: "This nomination is not waiting for a fix. Reload the page to see where it stands." };
  }
  if (!canFix(n, cycle)) {
    return {
      ok: false,
      error: `Re-evaluation closed on ${formatWhen(fixDeadlineFor(n, cycle))}, so this nomination can no longer be resubmitted. It is out of the race.`,
    };
  }
  return {
    ok: true,
    ctx: { personId: gate.viewer.personId, nomination: n, title: award.title, cycleId: cycle.id, reevaluationDeadline: cycle.reevaluation_deadline },
  };
}

/** Edit the reason of a sent-back NL-added nomination without resubmitting it yet. */
export async function saveAddedReason(nominationId: string, reason: string): Promise<ActionResult> {
  const r = checkReason(reason);
  if (!r.ok) return { success: false, error: r.error };
  const loaded = await fixContext(nominationId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { ctx } = loaded;
  if (ctx.nomination.added_reason === r.text) return { success: true, message: "No change to save." };

  const now = new Date().toISOString();
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .update({ added_reason: r.text, updated_at: now })
    .eq("id", ctx.nomination.id)
    .eq("status", "returned")
    .select("id");
  if (error) return writeFailed("save the reason", error.message, error.code);
  if ((data ?? []).length === 0) {
    return { success: false, error: "Someone changed this nomination a moment ago. Reload the page to see where it stands." };
  }
  await audit({
    cycleId: ctx.cycleId,
    awardId: ctx.nomination.award_id,
    actorPersonId: ctx.personId,
    action: "nomination_nl_reason_edited",
    entity: "recognition_nominations",
    entityId: ctx.nomination.id,
    detail: { chapter_id: ctx.nomination.chapter_id, before: ctx.nomination.added_reason, after: r.text },
  });
  revalidatePath("/recognitions", "layout");
  return { success: true, message: "Reason saved. Resubmit it when you're ready; the checkers only see it again after that." };
}

/**
 * Resubmit a sent-back NL-added nomination with its (possibly edited) reason.
 * CLEARS BOTH PASSES, the same rule as a chapter's resubmission: the
 * Regional Chair and the Regional Mentor pass the final version. The
 * database trigger refuses a resubmission that keeps either pass.
 */
export async function resubmitAddedNomination(nominationId: string, reason: string): Promise<ActionResult> {
  const r = checkReason(reason);
  if (!r.ok) return { success: false, error: r.error };
  const loaded = await fixContext(nominationId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { ctx } = loaded;

  const now = new Date().toISOString();
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .update({
      added_reason: r.text,
      status: "submitted",
      submitted_at: now,
      submitted_by: ctx.personId,
      rc_checked_by: null,
      rc_checked_at: null,
      rm_checked_by: null,
      rm_checked_at: null,
      updated_at: now,
    })
    .eq("id", ctx.nomination.id)
    .eq("status", "returned")
    .select("id");
  if (error) return writeFailed("resubmit the nomination", error.message, error.code);
  if ((data ?? []).length === 0) {
    return { success: false, error: "Someone changed this nomination a moment ago. Reload the page to see where it stands." };
  }
  await audit({
    cycleId: ctx.cycleId,
    awardId: ctx.nomination.award_id,
    actorPersonId: ctx.personId,
    action: "nomination_nl_resubmitted",
    entity: "recognition_nominations",
    entityId: ctx.nomination.id,
    detail: {
      chapter_id: ctx.nomination.chapter_id,
      answered_note: ctx.nomination.return_note,
      reason_changed: ctx.nomination.added_reason !== r.text,
      before: ctx.nomination.added_reason,
      after: r.text,
      cleared_passes: true,
    },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: `Resubmitted. The Regional Chair and a Regional Mentor will check it again by ${formatWhen(ctx.reevaluationDeadline)}.`,
  };
}
