"use server";

import { revalidatePath } from "next/cache";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { audit, getAward, listChapters, listModerationVersions } from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, RANK_LABEL, WORDS, type Category } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";
import type { ActionResult } from "@/lib/recognitions/types";
import { headerOf, loadHealthCardFile, matchRows } from "../(desk)/admin/_lib/health-card";

/**
 * Control room: Layer 1 (Health Card) scores and the super admin's polish of
 * citations, announcement text and the ceremony script.
 */

function done() {
  revalidatePath("/recognitions", "layout");
}

// ---------------------------------------------------------------------------
// Health Card -> Layer 1
// ---------------------------------------------------------------------------

export async function healthCardColumns(
  fileId: string
): Promise<ActionResult<{ fileName: string; sheetName: string; columns: string[]; sample: string[][] }>> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const loaded = await loadHealthCardFile(fileId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const columns = headerOf(loaded.sheet);
  if (columns.length === 0 || loaded.sheet.rows.length < 2)
    return { success: false, error: "The first sheet of that file is empty. Check the file and upload it again." };
  const sample = loaded.sheet.rows.slice(1, 4).map((r) => columns.map((_, i) => String(r[i] ?? "")));
  return { success: true, data: { fileName: loaded.file.file_name, sheetName: loaded.sheet.sheetName, columns, sample } };
}

type Preview = {
  matched: Array<{ rowNo: number; chapterName: string; score: number }>;
  unmatched: Array<{ rowNo: number; cell: string }>;
  skipped: Array<{ rowNo: number; chapterName: string; why: string }>;
  problems: string[];
  missingChapters: string[];
};

async function buildPreview(fileId: string, chapterCol: number, scoreCol: number) {
  const loaded = await loadHealthCardFile(fileId);
  if (!loaded.ok) return { ok: false as const, error: loaded.error };
  const width = headerOf(loaded.sheet).length;
  if (!Number.isInteger(chapterCol) || !Number.isInteger(scoreCol) || chapterCol < 0 || scoreCol < 0 || chapterCol >= width || scoreCol >= width)
    return { ok: false as const, error: "Choose the chapter column and the score column." };
  if (chapterCol === scoreCol) return { ok: false as const, error: "The chapter column and the score column must be different." };
  const chapters = await listChapters();
  const match = matchRows(loaded.sheet, chapterCol, scoreCol, chapters);
  const inFile = new Set(match.matched.map((m) => m.chapterId));
  return { ok: true as const, file: loaded.file, match, missingChapters: chapters.filter((c) => !inFile.has(c.id)).map((c) => c.name) };
}

export async function previewHealthCard(input: { fileId: string; chapterCol: number; scoreCol: number }): Promise<ActionResult<Preview>> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const p = await buildPreview(input.fileId, Number(input.chapterCol), Number(input.scoreCol));
  if (!p.ok) return { success: false, error: p.error };
  return {
    success: true,
    data: {
      matched: p.match.matched.map((m) => ({ rowNo: m.rowNo, chapterName: m.chapterName, score: m.score })),
      unmatched: p.match.unmatched,
      skipped: p.match.skipped,
      problems: p.match.problems,
      missingChapters: p.missingChapters,
    },
  };
}

export async function applyHealthCard(input: { fileId: string; chapterCol: number; scoreCol: number }): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const p = await buildPreview(input.fileId, Number(input.chapterCol), Number(input.scoreCol));
  if (!p.ok) return { success: false, error: p.error };
  if (p.match.problems.length > 0)
    return { success: false, error: `Fix these rows in the file first, then upload it again: ${p.match.problems.slice(0, 5).join(" ")}${p.match.problems.length > 5 ? ` …and ${p.match.problems.length - 5} more.` : ""}` };
  if (p.match.matched.length === 0) return { success: false, error: "No row matched a chapter, so there is nothing to apply. Check the chapter column." };

  const award = await getAward(p.file.award_id);
  if (!award) return { success: false, error: "That file's award no longer exists." };
  const now = new Date().toISOString();
  const { error } = await rxService()
    .from("recognition_layer1")
    .upsert(
      p.match.matched.map((m) => ({
        award_id: award.id,
        chapter_id: m.chapterId,
        score: m.score,
        raw: m.raw,
        source: "excel",
        source_file_id: p.file.id,
        updated_by: gate.viewer.personId,
        updated_at: now,
      })),
      { onConflict: "award_id,chapter_id" }
    );
  if (error) return { success: false, error: "Couldn't save the Layer 1 scores. Try again." };

  await audit({
    cycleId: award.cycle_id,
    awardId: award.id,
    actorPersonId: gate.viewer.personId,
    action: "apply_layer1",
    entity: "health_card_file",
    entityId: p.file.id,
    detail: { file: p.file.file_name, chapter_column: input.chapterCol, score_column: input.scoreCol, applied: p.match.matched.length, unmatched: p.match.unmatched.length, skipped: p.match.skipped.length },
  });
  done();
  return { success: true, message: `Applied ${p.match.matched.length} Layer 1 score${p.match.matched.length === 1 ? "" : "s"} to ${award.title}.` };
}

export async function setManualLayer1(input: { awardId: string; chapterId: string; score: string }): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const award = await getAward(input.awardId);
  if (!award) return { success: false, error: "That award no longer exists." };
  const chapter = (await listChapters()).find((c) => c.id === input.chapterId);
  if (!chapter) return { success: false, error: "Choose a chapter." };
  const text = String(input.score ?? "").trim();
  const n = Number(text);
  if (text === "" || !Number.isFinite(n)) return { success: false, error: "Type a score from 0 to 100." };
  if (n < 0 || n > 100) return { success: false, error: `${n} is outside 0-100. Type a score from 0 to 100.` };
  const score = Math.round(n * 100) / 100;

  const svc = rxService();
  const { data: before } = await svc.from("recognition_layer1").select("score, source").eq("award_id", award.id).eq("chapter_id", chapter.id).maybeSingle();
  const { error } = await svc.from("recognition_layer1").upsert(
    {
      award_id: award.id,
      chapter_id: chapter.id,
      score,
      raw: { entered_by_hand: true },
      source: "manual",
      source_file_id: null,
      updated_by: gate.viewer.personId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "award_id,chapter_id" }
  );
  if (error) return { success: false, error: "Couldn't save the score. Try again." };
  await audit({
    cycleId: award.cycle_id,
    awardId: award.id,
    actorPersonId: gate.viewer.personId,
    action: "set_layer1_manual",
    entity: "layer1",
    entityId: chapter.id,
    detail: { chapter: chapter.name, from: before ?? null, to: score },
  });
  done();
  return { success: true, message: `${chapter.name}: Layer 1 score set to ${score}.` };
}

// ---------------------------------------------------------------------------
// Citation polish (append-only; rankings are never touched here)
// ---------------------------------------------------------------------------

/** Ceremony script has no limit in the spec; this cap only stops a runaway paste. */
const CEREMONY_SCRIPT_MAX_WORDS = 5000;

export async function saveCitationEdit(input: {
  awardId: string;
  field: "citation" | "announcement" | "ceremony_script";
  category: Category | null;
  rank: number | null;
  body: string;
}): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const award = await getAward(input.awardId);
  if (!award) return { success: false, error: "That award no longer exists." };

  const body = (input.body ?? "").trim();
  if (body === "") return { success: false, error: "The text is empty. Write the text, or leave it as it is." };

  const versions = await listModerationVersions(award.id);
  const version = versions.find((v) => v.status === "submitted") ?? null;
  if (!version) return { success: false, error: "The NMT leader hasn't submitted a moderation for this award yet, so there is nothing to polish." };

  let category: Category | null = null;
  let rank: number | null = null;
  if (input.field === "ceremony_script") {
    if (countWords(body) > CEREMONY_SCRIPT_MAX_WORDS) return { success: false, error: `The script is over ${CEREMONY_SCRIPT_MAX_WORDS} words. Shorten it.` };
  } else if (input.field === "citation" || input.field === "announcement") {
    if (!input.category || !CATEGORIES.includes(input.category) || ![1, 2, 3].includes(Number(input.rank)))
      return { success: false, error: "Choose the podium place to polish." };
    category = input.category;
    rank = Number(input.rank);
    if (!version.top3.some((t) => t.category === category && t.rank === rank))
      return { success: false, error: `There is no ${RANK_LABEL[rank as 1 | 2 | 3].toLowerCase()} in ${CATEGORY_LABEL[category]} in the latest moderation.` };
    // The same word limits the spec sets for these texts apply to the polished version.
    const limit = input.field === "citation" ? WORDS.top3Citation : WORDS.announcementDraft;
    const words = countWords(body);
    if (words > limit) return { success: false, error: `That is ${words} words. The limit is ${limit}; shorten it.` };
  } else {
    return { success: false, error: "Choose what to polish." };
  }

  const { data, error } = await rxService()
    .from("recognition_citation_edits")
    .insert({
      award_id: award.id,
      // Bound to the latest submitted moderation, so a re-evaluation that changes the
      // podium never carries polished text onto a different chapter.
      moderation_version_id: version.id,
      category,
      rank,
      field: input.field,
      body,
      edited_by: gate.viewer.personId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: "Couldn't save the text. Try again." };

  await audit({
    cycleId: award.cycle_id,
    awardId: award.id,
    actorPersonId: gate.viewer.personId,
    action: "edit",
    entity: "citation_edit",
    entityId: (data as { id: string }).id,
    detail: { field: input.field, category, rank, moderation_version: version.version, words: countWords(body) },
  });
  done();
  const what = input.field === "ceremony_script" ? "Ceremony script" : input.field === "citation" ? "Citation" : "Announcement text";
  return { success: true, message: `${what} saved. Earlier versions stay in the history.` };
}
