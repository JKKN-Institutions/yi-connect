"use server";

import { revalidatePath } from "next/cache";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { audit, getAward, getCurrentCycle, listChapters, listModerationVersions } from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, RANK_LABEL, WORDS, type Category } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";
import type { ActionResult } from "@/lib/recognitions/types";
import { headerOf, loadHealthCardFile, matchMeasureRows, matchRows } from "../(desk)/admin/_lib/health-card";
import { HC_TABLE_KEYS, listHealthCardMeasures, measureLayer1, type HcTableKey } from "@/lib/recognitions/health-card";

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
  if (!award) return { success: false, error: "That file's recognition no longer exists." };
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
  if (!award) return { success: false, error: "That recognition no longer exists." };
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
// Health Card per measure (recognitions_06). Scores are kept per cycle,
// chapter and table (A or B), so one upload serves every award of the cycle
// that uses that table. The single-score path above stays as the fallback.
// ---------------------------------------------------------------------------

type MeasurePreview = {
  tableKey: HcTableKey;
  measures: Array<{ key: string; label: string }>;
  matched: Array<{ rowNo: number; chapterName: string; scores: Record<string, number>; layer1: number }>;
  unmatched: Array<{ rowNo: number; cell: string }>;
  skipped: Array<{ rowNo: number; chapterName: string; why: string }>;
  problems: string[];
  missingChapters: string[];
};

type MeasureInput = { fileId: string; tableKey: string; chapterCol: number; measureCols: Record<string, number> };

async function buildMeasurePreview(input: MeasureInput) {
  const tableKey = input.tableKey as HcTableKey;
  if (!HC_TABLE_KEYS.includes(tableKey)) return { ok: false as const, error: "Choose table A or table B." };
  const loaded = await loadHealthCardFile(input.fileId);
  if (!loaded.ok) return { ok: false as const, error: loaded.error };
  const award = await getAward(loaded.file.award_id);
  if (!award) return { ok: false as const, error: "That file's recognition no longer exists." };
  const measures = await listHealthCardMeasures(award.cycle_id, tableKey);
  if (measures.length === 0)
    return { ok: false as const, error: `Table ${tableKey} has no measures set up for this cycle. Ask for the Health Card measures to be seeded.` };

  const width = headerOf(loaded.sheet).length;
  const inRange = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < width;
  const chapterCol = Number(input.chapterCol);
  if (!inRange(chapterCol)) return { ok: false as const, error: "Choose the column with the chapter name." };
  const cols = measures.map((m) => ({ key: m.key, label: m.label, col: Number(input.measureCols?.[m.key]) }));
  const unset = cols.filter((c) => !inRange(c.col));
  if (unset.length > 0) return { ok: false as const, error: `Choose a column for ${unset.map((c) => c.label).join(", ")}.` };
  const used = [chapterCol, ...cols.map((c) => c.col)];
  if (new Set(used).size !== used.length)
    return { ok: false as const, error: "Each measure needs its own column, different from the chapter column." };

  const chapters = await listChapters();
  const match = matchMeasureRows(loaded.sheet, chapterCol, cols, chapters);
  const inFile = new Set(match.matched.map((m) => m.chapterId));
  return {
    ok: true as const,
    file: loaded.file,
    award,
    tableKey,
    measures,
    cols,
    match,
    missingChapters: chapters.filter((c) => !inFile.has(c.id)).map((c) => c.name),
  };
}

export async function previewHealthCardMeasures(input: MeasureInput): Promise<ActionResult<MeasurePreview>> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const p = await buildMeasurePreview(input);
  if (!p.ok) return { success: false, error: p.error };
  return {
    success: true,
    data: {
      tableKey: p.tableKey,
      measures: p.measures.map((m) => ({ key: m.key, label: m.label })),
      matched: p.match.matched.map((m) => ({
        rowNo: m.rowNo,
        chapterName: m.chapterName,
        scores: m.scores,
        layer1: measureLayer1(p.measures, new Map(Object.entries(m.scores))) ?? 0,
      })),
      unmatched: p.match.unmatched,
      skipped: p.match.skipped,
      problems: p.match.problems,
      missingChapters: p.missingChapters,
    },
  };
}

export async function applyHealthCardMeasures(input: MeasureInput): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const p = await buildMeasurePreview(input);
  if (!p.ok) return { success: false, error: p.error };
  if (p.match.problems.length > 0)
    return { success: false, error: `Fix these rows in the file first, then upload it again: ${p.match.problems.slice(0, 5).join(" ")}${p.match.problems.length > 5 ? ` …and ${p.match.problems.length - 5} more.` : ""}` };
  if (p.match.matched.length === 0) return { success: false, error: "No row matched a chapter, so there is nothing to apply. Check the chapter column." };

  const now = new Date().toISOString();
  const rows = p.match.matched.flatMap((m) =>
    p.measures.map((ms) => ({
      cycle_id: p.award.cycle_id,
      chapter_id: m.chapterId,
      table_key: p.tableKey,
      measure_key: ms.key,
      score: m.scores[ms.key],
      source_file_id: p.file.id,
      updated_by: gate.viewer.personId,
      updated_at: now,
    }))
  );
  const { error } = await rxService()
    .from("recognition_health_card_scores")
    .upsert(rows, { onConflict: "cycle_id,chapter_id,table_key,measure_key" });
  if (error) return { success: false, error: "Couldn't save the Health Card scores. Try again." };

  await audit({
    cycleId: p.award.cycle_id,
    awardId: p.award.id,
    actorPersonId: gate.viewer.personId,
    action: "apply_health_card_measures",
    entity: "health_card_file",
    entityId: p.file.id,
    detail: {
      file: p.file.file_name,
      table: p.tableKey,
      chapter_column: input.chapterCol,
      measure_columns: Object.fromEntries(p.cols.map((c) => [c.key, c.col])),
      applied: p.match.matched.length,
      unmatched: p.match.unmatched.length,
      skipped: p.match.skipped.length,
    },
  });
  done();
  return {
    success: true,
    message: `Applied table ${p.tableKey} measure scores for ${p.match.matched.length} chapter${p.match.matched.length === 1 ? "" : "s"}. Every recognition of this cycle that uses table ${p.tableKey} now reads them.`,
  };
}

const MEASURE_TEXT_MAX = 2000;

export async function saveHealthCardMeasure(input: {
  tableKey: string;
  measureKey: string;
  label: string;
  definition: string;
  indicators: string;
  purpose: string;
  impact: string;
}): Promise<ActionResult> {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const tableKey = input.tableKey as HcTableKey;
  if (!HC_TABLE_KEYS.includes(tableKey)) return { success: false, error: "Choose table A or table B." };
  const cycle = await getCurrentCycle();
  if (!cycle) return { success: false, error: "There is no current cycle." };
  const measures = await listHealthCardMeasures(cycle.id, tableKey);
  const measure = measures.find((m) => m.key === input.measureKey);
  if (!measure) return { success: false, error: "That measure no longer exists. Reload the page." };

  const label = String(input.label ?? "").trim();
  if (label === "" || label.length > 80) return { success: false, error: "The measure name must be 1 to 80 characters." };
  const text = {
    definition: String(input.definition ?? "").trim(),
    indicators: String(input.indicators ?? "").trim(),
    purpose: String(input.purpose ?? "").trim(),
    impact: String(input.impact ?? "").trim(),
  };
  for (const [k, v] of Object.entries(text))
    if (v.length > MEASURE_TEXT_MAX) return { success: false, error: `The ${k} is over ${MEASURE_TEXT_MAX} characters. Shorten it.` };

  const changed: Record<string, { from: string; to: string }> = {};
  const before: Record<string, string> = {
    label: measure.label,
    definition: measure.definition,
    indicators: measure.indicators,
    purpose: measure.purpose,
    impact: measure.impact,
  };
  const after: Record<string, string> = { label, ...text };
  for (const k of Object.keys(after)) if (before[k] !== after[k]) changed[k] = { from: before[k], to: after[k] };
  if (Object.keys(changed).length === 0) return { success: true, message: "Nothing changed." };

  const { error } = await rxService()
    .from("recognition_health_card_measures")
    .update({ label, ...text, updated_by: gate.viewer.personId, updated_at: new Date().toISOString() })
    .eq("cycle_id", cycle.id)
    .eq("table_key", tableKey)
    .eq("measure_key", measure.key);
  if (error) return { success: false, error: "Couldn't save the measure. Try again." };
  await audit({
    cycleId: cycle.id,
    actorPersonId: gate.viewer.personId,
    action: "edit_health_card_measure",
    entity: "health_card_measure",
    detail: { table: tableKey, measure: measure.key, changed },
  });
  done();
  return { success: true, message: `Table ${tableKey} · ${label} saved.` };
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
  if (!award) return { success: false, error: "That recognition no longer exists." };

  const body = (input.body ?? "").trim();
  if (body === "") return { success: false, error: "The text is empty. Write the text, or leave it as it is." };

  const versions = await listModerationVersions(award.id);
  const version = versions.find((v) => v.status === "submitted") ?? null;
  if (!version) return { success: false, error: "The NMT leader hasn't submitted a moderation for this recognition yet, so there is nothing to polish." };

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
      return { success: false, error: `There is no ${RANK_LABEL[rank as 1 | 2 | 3]} in ${CATEGORY_LABEL[category]} in the latest moderation.` };
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
