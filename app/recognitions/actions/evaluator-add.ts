"use server";

import { revalidatePath } from "next/cache";
import { requireRxDuty, type RxDuty } from "@/lib/recognitions/auth";
import { audit, getAwardState, getPeople, type AwardState } from "@/lib/recognitions/data";
import {
  ADD_REASON_CHARS,
  ADD_REASON_WORDS,
  chapterAddVerdict,
  evaluatorAddWindow,
  pendingApprovalsFor,
} from "@/lib/recognitions/evaluator-add";
import { rxService } from "@/lib/recognitions/supabase";
import { countWords } from "@/lib/recognitions/words";
import type { ActionResult } from "@/lib/recognitions/types";
import { formatWhen } from "../_ui/primitives";

/**
 * Regional Mentors and the NMT put forward a chapter that did not apply
 * (recognitions_05, Piyush 15 Oct 2026). A Mentor's addition waits for an
 * NMT member's approval; an NMT member's goes straight into the race. An
 * NMT member may decline a Mentor's addition with a reason; the row and its
 * history stay. Every write is audited; every denial is { success:false }.
 */

function cleanText(raw: unknown, what: string): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return { ok: false, error: `Write ${what}.` };
  const words = countWords(text);
  if (words > ADD_REASON_WORDS) {
    return { ok: false, error: `That is ${words} words; the limit is ${ADD_REASON_WORDS}. Shorten it and try again.` };
  }
  if (text.length > ADD_REASON_CHARS) {
    return { ok: false, error: `That is over ${ADD_REASON_CHARS} characters. Shorten it and try again.` };
  }
  return { ok: true, text };
}

function writeFailed(what: string, message: string | undefined, code?: string): ActionResult {
  console.error(JSON.stringify({ tag: "recognitions_evaluator_add_write_failed", what, error: message, code }));
  return { success: false, error: `Couldn't ${what} just now. Try again; if it keeps failing, tell the Recognitions super admin.` };
}

async function load(evaluatorId: string): Promise<
  { ok: true; duty: RxDuty; personId: string; state: AwardState } | { ok: false; error: string }
> {
  const gate = await requireRxDuty(typeof evaluatorId === "string" ? evaluatorId : "");
  if (!gate.ok) return { ok: false, error: gate.error };
  const state = await getAwardState(gate.value.award_id);
  if (!state) return { ok: false, error: "This recognition no longer exists. Reload the page." };
  const win = evaluatorAddWindow(state, formatWhen);
  if (!win.open) return { ok: false, error: win.reason };
  return { ok: true, duty: gate.value, personId: gate.viewer.personId, state };
}

/** A Regional Mentor or NMT member adds a chapter that did not apply, with a reason. */
export async function addChapterAsEvaluator(evaluatorId: string, chapterId: string, reason: string): Promise<ActionResult> {
  const r = cleanText(reason, "why this chapter deserves to be considered");
  if (!r.ok) return { success: false, error: r.error };
  if (typeof chapterId !== "string" || chapterId === "") return { success: false, error: "Pick a chapter first." };
  const loaded = await load(evaluatorId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { duty, personId, state } = loaded;

  const verdict = await chapterAddVerdict(state, duty, chapterId);
  if (!verdict.ok) return { success: false, error: verdict.error };
  const chapter = verdict.chapter;
  const byMentor = duty.layer === "rm";

  const now = new Date().toISOString();
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .insert({
      award_id: state.award.id,
      chapter_id: chapter.id,
      // Snapshots at add time, exactly like a chapter submission.
      category: chapter.category,
      region: chapter.region,
      // A Mentor's addition waits for an NMT approval; an NMT member's is in the race at once.
      status: byMentor ? "submitted" : "checked",
      submitted_at: now,
      submitted_by: personId,
      origin: byMentor ? "rm_added" : "nmt_added",
      added_by: personId,
      added_at: now,
      added_reason: r.text,
      created_by: personId,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { success: false, error: `${chapter.name} already has a nomination for this recognition (it was added a moment ago).` };
    }
    return writeFailed(`add ${chapter.name}`, error?.message, error?.code);
  }

  await audit({
    cycleId: state.cycle.id,
    awardId: state.award.id,
    actorPersonId: personId,
    action: byMentor ? "nomination_rm_added" : "nomination_nmt_added",
    entity: "recognition_nominations",
    entityId: (data as { id: string }).id,
    detail: { chapter_id: chapter.id, category: chapter.category, region: chapter.region, reason: r.text, evaluator_id: duty.id },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: byMentor
      ? `${chapter.name} added. An NMT member of ${state.award.title} must approve it before it is scored.`
      : `${chapter.name} added to ${state.award.title}. It is on the scoring sheets now.`,
  };
}

/** Shared checks for an NMT member deciding on a Mentor's added chapter. */
async function decisionContext(evaluatorId: string, nominationId: string) {
  const loaded = await load(evaluatorId);
  if (!loaded.ok) return loaded;
  const { duty, state } = loaded;
  if (duty.layer !== "nmt") {
    return { ok: false as const, error: "Only an NMT member of this recognition can approve or decline a Mentor's added chapter." };
  }
  const pending = pendingApprovalsFor(state, duty).find((p) => p.nomination.id === nominationId);
  if (!pending) {
    return { ok: false as const, error: "This chapter is not waiting for an approval any more. Reload the page to see where it stands." };
  }
  if (pending.blocked) return { ok: false as const, error: pending.blocked };
  return { ...loaded, nomination: pending.nomination };
}

/** NMT: approve a Regional Mentor's added chapter. It is then in the race and scored. */
export async function approveAddedChapter(evaluatorId: string, nominationId: string): Promise<ActionResult> {
  const ctx = await decisionContext(evaluatorId, typeof nominationId === "string" ? nominationId : "");
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { personId, state, nomination, duty } = ctx;

  const now = new Date().toISOString();
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .update({ status: "checked", approved_by: personId, approved_at: now, updated_at: now })
    .eq("id", nomination.id)
    .eq("status", "submitted")
    .is("approved_by", null)
    .select("id");
  if (error) return writeFailed("approve it", error.message, error.code);
  if ((data ?? []).length === 0) {
    return { success: false, error: "Another NMT member decided on this chapter a moment ago. Reload the page." };
  }
  await audit({
    cycleId: state.cycle.id,
    awardId: state.award.id,
    actorPersonId: personId,
    action: "nomination_rm_added_approved",
    entity: "recognition_nominations",
    entityId: nomination.id,
    detail: { chapter_id: nomination.chapter_id, added_by: nomination.added_by, evaluator_id: duty.id },
  });
  revalidatePath("/recognitions", "layout");
  return { success: true, message: "Approved. The chapter is now on the scoring sheets." };
}

/** NMT: decline a Regional Mentor's added chapter, with a reason. The row stays as history. */
export async function declineAddedChapter(evaluatorId: string, nominationId: string, reason: string): Promise<ActionResult> {
  const r = cleanText(reason, "why you are declining it");
  if (!r.ok) return { success: false, error: r.error };
  const ctx = await decisionContext(evaluatorId, typeof nominationId === "string" ? nominationId : "");
  if (!ctx.ok) return { success: false, error: ctx.error };
  const { personId, state, nomination, duty } = ctx;

  const now = new Date().toISOString();
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .update({ status: "excluded", declined_by: personId, declined_at: now, decline_reason: r.text, updated_at: now })
    .eq("id", nomination.id)
    .eq("status", "submitted")
    .is("approved_by", null)
    .select("id");
  if (error) return writeFailed("decline it", error.message, error.code);
  if ((data ?? []).length === 0) {
    return { success: false, error: "Another NMT member decided on this chapter a moment ago. Reload the page." };
  }
  await audit({
    cycleId: state.cycle.id,
    awardId: state.award.id,
    actorPersonId: personId,
    action: "nomination_rm_added_declined",
    entity: "recognition_nominations",
    entityId: nomination.id,
    detail: { chapter_id: nomination.chapter_id, added_by: nomination.added_by, reason: r.text, evaluator_id: duty.id },
  });
  revalidatePath("/recognitions", "layout");
  const adder = nomination.added_by ? (await getPeople([nomination.added_by])).get(nomination.added_by)?.full_name : null;
  return { success: true, message: `Declined. ${adder ?? "The Regional Mentor"} sees your reason; the chapter is not scored.` };
}
