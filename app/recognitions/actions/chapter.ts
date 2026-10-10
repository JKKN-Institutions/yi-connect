"use server";

import { revalidatePath } from "next/cache";
import { requireRxChapter } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import {
  audit,
  getChapterCategories,
  getCurrentCycle,
  listAwards,
  listNominationsForChapter,
  listPredictionsByChapter,
} from "@/lib/recognitions/data";
import { isPast } from "@/lib/recognitions/phase";
import { canFix, isNlAdded } from "@/lib/recognitions/check-rules";
import { CATEGORIES, type Category } from "@/lib/recognitions/constants";
import type { ActionResult, AwardRow, ChapterRow, CycleRow, NominationRow } from "@/lib/recognitions/types";
import { cleanForm, validateNomination, type NominationForm } from "../(desk)/chapter/shared";
import { formatWhen } from "../_ui/primitives";

/**
 * Chapter desk actions. Every one: gate → validate → write → audit →
 * revalidate. The "a filed nomination is locked" rule lives here AND in the
 * database freeze trigger (recognitions_01/02): every write re-reads the row
 * and only ever touches status = 'draft' — except resubmitNomination, which
 * touches status = 'returned' until the cycle's fix deadline.
 */

type Ctx = {
  personId: string;
  chapter: ChapterRow;
  cycle: CycleRow;
  awards: AwardRow[];
  category: Category;
  region: string;
};

type CtxResult = { ok: true; ctx: Ctx } | { ok: false; error: string };

/** Shared preconditions for every nomination write. */
async function nominationContext(chapterId: string): Promise<CtxResult> {
  const gate = await requireRxChapter(typeof chapterId === "string" ? chapterId : "");
  if (!gate.ok) return { ok: false, error: gate.error };
  const cycle = await getCurrentCycle();
  if (!cycle) return { ok: false, error: "No recognitions cycle is open right now." };
  // No deadline set = the cycle is still being set up, so nominations are not open.
  if (!cycle.nomination_deadline) {
    return { ok: false, error: "Nominations haven't opened yet. The Recognitions super admin sets the deadline." };
  }
  if (isPast(cycle.nomination_deadline)) {
    return { ok: false, error: `Nominations closed on ${formatWhen(cycle.nomination_deadline)}.` };
  }
  const category = (await getChapterCategories(cycle.id)).get(gate.value.id);
  if (!category) {
    return {
      ok: false,
      error: "Your chapter hasn't been placed in a category yet. The Recognitions super admin does this.",
    };
  }
  const region = (gate.value.region ?? "").trim();
  if (region === "") return { ok: false, error: "Your chapter has no region on record." };
  const awards = await listAwards(cycle.id);
  return { ok: true, ctx: { personId: gate.viewer.personId, chapter: gate.value, cycle, awards, category, region } };
}

function plainDbError(message: string, code?: string): string {
  if (code === "23505") return "Someone from your chapter filed this at the same moment. Reload the page to see the latest.";
  console.error(JSON.stringify({ tag: "recognitions_chapter_write_failed", message, code }));
  return "The save didn't go through. Please try again; if it keeps failing, tell the Recognitions super admin.";
}

function rowValues(f: NominationForm) {
  return {
    reasons: f.reasons.map((r) => r.trim()),
    flagship_event: f.flagship.trim(),
    hosted_event: f.hosted,
    hosted_event_name: f.hosted ? f.hostedName.trim() || null : null,
    hosted_event_type: f.hosted ? f.hostedType || null : null,
    announcement_draft: f.announcement.trim(),
  };
}

/** Parse + check the payload against the cycle's active awards. */
function parseForms(
  ctx: Ctx,
  raw: unknown,
  forSubmit: boolean
): { ok: true; forms: NominationForm[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Nothing was sent. Choose at least one award." };
  const byId = new Map(ctx.awards.map((a) => [a.id, a]));
  const forms: NominationForm[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const f = cleanForm(item);
    if (!f) return { ok: false, error: "One of the nominations was malformed. Reload the page and try again." };
    const award = byId.get(f.awardId);
    if (!award) return { ok: false, error: "One of the awards is not open this year. Reload the page and try again." };
    if (seen.has(f.awardId)) continue;
    seen.add(f.awardId);
    const problems = validateNomination(f, { forSubmit });
    if (problems.length > 0) return { ok: false, error: `${award.title}: ${problems.join(" ")}` };
    forms.push(f);
  }
  if (forms.length === 0) return { ok: false, error: "Choose at least one award." };
  return { ok: true, forms };
}

/** Insert a new row, or update the existing draft. Never touches a submitted row. */
async function writeNomination(
  ctx: Ctx,
  f: NominationForm,
  existing: NominationRow | undefined,
  submit: boolean
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const svc = rxService();
  const now = new Date().toISOString();
  const values = {
    ...rowValues(f),
    // Snapshot refreshed on every write while it is a draft; frozen once submitted.
    category: ctx.category,
    region: ctx.region,
    updated_at: now,
    ...(submit ? { status: "submitted", submitted_at: now, submitted_by: ctx.personId } : {}),
  };
  if (existing) {
    const { data, error } = await svc
      .from("recognition_nominations")
      .update(values)
      .eq("id", existing.id)
      .eq("status", "draft")
      .select("id");
    if (error) return { ok: false, error: plainDbError(error.message, error.code) };
    if (!data || data.length === 0) {
      return { ok: false, error: "This nomination has already been submitted and can't be changed." };
    }
    return { ok: true, id: existing.id };
  }
  const { data, error } = await svc
    .from("recognition_nominations")
    .insert({
      ...values,
      award_id: f.awardId,
      chapter_id: ctx.chapter.id,
      status: submit ? "submitted" : "draft",
      created_by: ctx.personId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: plainDbError(error?.message ?? "no row", error?.code) };
  return { ok: true, id: (data as { id: string }).id };
}

async function writeAll(
  ctx: Ctx,
  forms: NominationForm[],
  submit: boolean
): Promise<ActionResult> {
  const existing = new Map(
    // includeNlAdded: a row National Leadership added also blocks a new filing (one per award).
    (await listNominationsForChapter(ctx.chapter.id, forms.map((f) => f.awardId), { includeNlAdded: true })).map((n) => [
      n.award_id,
      n,
    ])
  );
  const titles = new Map(ctx.awards.map((a) => [a.id, a.title]));
  // Anything past 'draft' is filed. A sent-back one is fixed through resubmitNomination, not here.
  const locked = forms.filter((f) => {
    const s = existing.get(f.awardId)?.status;
    return s !== undefined && s !== "draft";
  });
  if (locked.length > 0) {
    return {
      success: false,
      error: `${locked.map((f) => titles.get(f.awardId)).join(", ")} ${locked.length === 1 ? "is" : "are"} already submitted and can't be changed here. Reload the page.`,
    };
  }

  const done: string[] = [];
  for (const f of forms) {
    const res = await writeNomination(ctx, f, existing.get(f.awardId), submit);
    const title = titles.get(f.awardId) ?? "Award";
    if (!res.ok) {
      if (done.length > 0) revalidatePath("/recognitions", "layout");
      const savedNote = done.length > 0 ? ` ${done.join(", ")} went through.` : "";
      return { success: false, error: `${title}: ${res.error}${savedNote}` };
    }
    done.push(title);
    await audit({
      cycleId: ctx.cycle.id,
      awardId: f.awardId,
      actorPersonId: ctx.personId,
      action: submit ? "nomination_submitted" : "nomination_draft_saved",
      entity: "recognition_nominations",
      entityId: res.id,
      detail: { chapter_id: ctx.chapter.id, category: ctx.category, region: ctx.region },
    });
  }
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: submit
      ? `Submitted: ${done.join(", ")}. These nominations are now locked.`
      : `Draft saved for ${done.length === 1 ? done[0] : `${done.length} awards`}.`,
  };
}

/** Save every selected, unsubmitted award as a draft. Partial is fine; over-limit is not. */
export async function saveNominationDrafts(chapterId: string, forms: unknown): Promise<ActionResult> {
  const c = await nominationContext(chapterId);
  if (!c.ok) return { success: false, error: c.error };
  const parsed = parseForms(c.ctx, forms, false);
  if (!parsed.ok) return { success: false, error: parsed.error };
  return writeAll(c.ctx, parsed.forms, false);
}

/** Submit every selected award. All are checked first; if any is incomplete, none is written. */
export async function submitNominations(chapterId: string, forms: unknown): Promise<ActionResult> {
  const c = await nominationContext(chapterId);
  if (!c.ok) return { success: false, error: c.error };
  const parsed = parseForms(c.ctx, forms, true);
  if (!parsed.ok) return { success: false, error: parsed.error };
  return writeAll(c.ctx, parsed.forms, true);
}

/** Remove a draft when the award is deselected. A submitted nomination can't be removed. */
export async function deleteNominationDraft(chapterId: string, awardId: string): Promise<ActionResult> {
  const c = await nominationContext(chapterId);
  if (!c.ok) return { success: false, error: c.error };
  const ctx = c.ctx;
  const award = ctx.awards.find((a) => a.id === awardId);
  if (!award) return { success: false, error: "That award is not open this year." };
  const [existing] = await listNominationsForChapter(ctx.chapter.id, [awardId]);
  if (!existing) return { success: true, message: `${award.title} had no saved draft.` };
  if (existing.status !== "draft") {
    return { success: false, error: `${award.title} is already submitted and can't be removed.` };
  }
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .delete()
    .eq("id", existing.id)
    .eq("status", "draft")
    .select("id");
  if (error) return { success: false, error: plainDbError(error.message, error.code) };
  if (!data || data.length === 0) {
    return { success: false, error: `${award.title} was submitted a moment ago and can't be removed. Reload the page.` };
  }
  await audit({
    cycleId: ctx.cycle.id,
    awardId,
    actorPersonId: ctx.personId,
    action: "nomination_draft_deleted",
    entity: "recognition_nominations",
    entityId: existing.id,
    detail: { chapter_id: ctx.chapter.id },
  });
  revalidatePath("/recognitions", "layout");
  return { success: true, message: `Draft for ${award.title} removed.` };
}

/**
 * Fix and resubmit a nomination a checker sent back (recognitions_02).
 * Allowed while status = 'returned' and the cycle's fix deadline has not
 * passed — even after the nomination deadline, which is the point.
 */
export async function resubmitNomination(chapterId: string, form: unknown): Promise<ActionResult> {
  const gate = await requireRxChapter(typeof chapterId === "string" ? chapterId : "");
  if (!gate.ok) return { success: false, error: gate.error };
  const cycle = await getCurrentCycle();
  if (!cycle) return { success: false, error: "No recognitions cycle is open right now." };

  const f = cleanForm(form);
  if (!f) return { success: false, error: "The form arrived malformed. Reload the page and try again." };
  const award = (await listAwards(cycle.id)).find((a) => a.id === f.awardId);
  if (!award) return { success: false, error: "That award is not open this year. Reload the page." };

  const [existing] = await listNominationsForChapter(gate.value.id, [award.id], { includeNlAdded: true });
  // A nomination National Leadership added is fixed by National Leadership,
  // never by the chapter (recognitions_03). Same answer as "none", so the
  // chapter learns nothing about the review.
  if (!existing || isNlAdded(existing)) return { success: false, error: `Your chapter has no nomination for ${award.title}.` };
  if (existing.status !== "returned") {
    return { success: false, error: `${award.title} is not waiting for a fix. Reload the page to see where it stands.` };
  }
  if (!canFix(existing, cycle)) {
    return {
      success: false,
      error: `The fix deadline passed on ${formatWhen(cycle.fix_deadline)}, so ${award.title} can no longer be resubmitted. It is out of the race.`,
    };
  }
  const problems = validateNomination(f, { forSubmit: true });
  if (problems.length > 0) return { success: false, error: `${award.title}: ${problems.join(" ")}` };

  const now = new Date().toISOString();
  // Resubmitting CLEARS BOTH PASSES: the Regional Chair and the Regional
  // Mentor must both pass the FINAL version, never an earlier one (Director,
  // 2026-10-10). The database trigger refuses a resubmission that keeps one.
  // The last return note stays on the row as history.
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .update({
      ...rowValues(f),
      status: "submitted",
      submitted_at: now,
      submitted_by: gate.viewer.personId,
      rc_checked_by: null,
      rc_checked_at: null,
      rm_checked_by: null,
      rm_checked_at: null,
      updated_at: now,
    })
    .eq("id", existing.id)
    .eq("status", "returned")
    .select("id");
  if (error) return { success: false, error: plainDbError(error.message, error.code) };
  if (!data || data.length === 0) {
    return { success: false, error: `${award.title} changed a moment ago. Reload the page to see where it stands.` };
  }

  await audit({
    cycleId: cycle.id,
    awardId: award.id,
    actorPersonId: gate.viewer.personId,
    action: "nomination_resubmitted",
    entity: "recognition_nominations",
    entityId: existing.id,
    detail: { chapter_id: gate.value.id, answered_note: existing.return_note, cleared_passes: true },
  });
  revalidatePath("/recognitions", "layout");
  return {
    success: true,
    message: `${award.title} resubmitted. The Regional Chair and a Regional Mentor will check it again.`,
  };
}

/** Phase 1B: one row per filled cell. Locks for ever once any row exists. Not used in scoring. */
export async function submitPredictions(chapterId: string, picks: unknown): Promise<ActionResult> {
  const gate = await requireRxChapter(typeof chapterId === "string" ? chapterId : "");
  if (!gate.ok) return { success: false, error: gate.error };
  const cycle = await getCurrentCycle();
  if (!cycle) return { success: false, error: "No recognitions cycle is open right now." };
  if (!cycle.quiz_open) return { success: false, error: "The prediction quiz is closed." };
  if (!cycle.nomination_deadline) return { success: false, error: "The prediction quiz hasn't opened yet." };
  if (isPast(cycle.nomination_deadline)) {
    return { success: false, error: `The prediction quiz closed with nominations on ${formatWhen(cycle.nomination_deadline)}.` };
  }

  const awards = await listAwards(cycle.id);
  const awardIds = new Set(awards.map((a) => a.id));
  const already = await listPredictionsByChapter(gate.value.id, [...awardIds]);
  if (already.length > 0) return { success: false, error: "Your chapter's predictions are already locked in." };

  if (!Array.isArray(picks)) return { success: false, error: "Pick at least one chapter before submitting." };
  const categories = await getChapterCategories(cycle.id);
  const rows: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  for (const p of picks) {
    if (!p || typeof p !== "object") continue;
    const { awardId, category, predictedChapterId } = p as Record<string, unknown>;
    if (typeof predictedChapterId !== "string" || predictedChapterId === "") continue; // empty cell
    if (typeof awardId !== "string" || !awardIds.has(awardId)) {
      return { success: false, error: "One of the awards is not open this year. Reload the page and try again." };
    }
    if (typeof category !== "string" || !(CATEGORIES as readonly string[]).includes(category)) {
      return { success: false, error: "One of the picks has an unknown category. Reload the page and try again." };
    }
    if (categories.get(predictedChapterId) !== category) {
      return {
        success: false,
        error: "One of the chapters you picked is not in that category this year. Reload the page and pick again.",
      };
    }
    const key = `${awardId}:${category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      award_id: awardId,
      category,
      predictor_chapter_id: gate.value.id,
      predicted_chapter_id: predictedChapterId,
      submitted_by: gate.viewer.personId,
    });
  }
  if (rows.length === 0) return { success: false, error: "Pick at least one chapter before submitting." };

  // One statement: either every pick lands or none does.
  const { error } = await rxService().from("recognition_predictions").insert(rows);
  if (error) {
    if (error.code === "23505") return { success: false, error: "Your chapter's predictions are already locked in." };
    return { success: false, error: plainDbError(error.message, error.code) };
  }
  await audit({
    cycleId: cycle.id,
    actorPersonId: gate.viewer.personId,
    action: "predictions_submitted",
    entity: "recognition_predictions",
    detail: { chapter_id: gate.value.id, picks: rows.length },
  });
  revalidatePath("/recognitions", "layout");
  return { success: true, message: `${rows.length} prediction${rows.length === 1 ? "" : "s"} locked in.` };
}
