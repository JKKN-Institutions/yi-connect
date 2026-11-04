import "server-only";

import { rxService } from "./supabase";
import type { AwardRow } from "./types";

/**
 * Layer 1 (Health Card) per measure — recognitions_06.
 *
 * Each award uses one table of the Evaluation Matrix: A "Activity Score –
 * Projects & Initiatives" or B "Activity Score – Stakeholders". Which one is
 * DATA (recognition_health_card_kind_tables, keyed by recognition_awards.kind).
 * kind is read tolerantly: the column may not exist yet (recognitions_04),
 * and a missing column, a null kind or an unmapped kind all mean table A.
 *
 * Layer 1 for a chapter = sum(weight * score) / sum(weight) over its table's
 * measures — a 0-100 number. Since the 30 Oct model this is REFERENCE only:
 * the matrix's weight_layer1 share comes from the RMs' and NMT's own Part A
 * marks on these same measures (scoring.ts partAFraction), not from here.
 *   - all measures scored            -> that weighted average  (source "measures")
 *   - some but not all measures      -> NO Layer 1 (missing), shown as incomplete
 *   - no measure scored at all       -> the old single score in
 *                                       recognition_layer1, if any ("excel"/"manual")
 *   - nothing anywhere               -> NO Layer 1 (missing): "No Health Card data"
 * A missing Layer 1 is absent from the map.
 */

export type HcTableKey = "A" | "B";
export const HC_TABLE_KEYS: readonly HcTableKey[] = ["A", "B"];
export const HC_TABLE_TITLE: Record<HcTableKey, string> = {
  A: "Activity Score – Projects & Initiatives",
  B: "Activity Score – Stakeholders",
};

export type HcMeasure = {
  tableKey: HcTableKey;
  key: string;
  label: string;
  definition: string;
  indicators: string;
  purpose: string;
  impact: string;
  sortOrder: number;
  weight: number;
};

export type HcSource = "measures" | "excel" | "manual";

export type ChapterHealthCard = {
  /** One entry per measure of the table, in sort order; score null = not given. */
  scores: Array<{ key: string; score: number | null }>;
  layer1: number | null;
  source: HcSource | null;
  /** Some measure scores exist but not all: Layer 1 is missing until the rest arrive. */
  incomplete: boolean;
};

export type AwardHealthCard = {
  tableKey: HcTableKey;
  measures: HcMeasure[];
  byChapter: Map<string, ChapterHealthCard>;
};

/** True for "this table/relation doesn't exist" (migration 06 not applied yet). */
function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`recognitions: ${context} failed: ${error?.message ?? "unknown error"}`);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** recognition_awards.kind, or null when the column is absent or empty. */
export function awardKind(award: AwardRow): string | null {
  const k = (award as AwardRow & { kind?: unknown }).kind;
  return typeof k === "string" && k.trim() !== "" ? k.trim().toLowerCase() : null;
}

/** Which table an award's Layer 1 uses. Defaults to A. */
export async function healthCardTableFor(award: AwardRow): Promise<HcTableKey> {
  const kind = awardKind(award);
  if (!kind) return "A";
  const { data, error } = await rxService()
    .from("recognition_health_card_kind_tables")
    .select("table_key")
    .eq("kind", kind)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return "A";
    fail("read health card kind mapping", error);
  }
  const t = (data as { table_key?: string } | null)?.table_key;
  return t === "B" ? "B" : "A";
}

type MeasureDbRow = {
  table_key: HcTableKey;
  measure_key: string;
  label: string;
  definition: string;
  indicators: string;
  purpose: string;
  impact: string;
  sort_order: number;
  weight: number | string;
};

function toMeasure(r: MeasureDbRow): HcMeasure {
  return {
    tableKey: r.table_key,
    key: r.measure_key,
    label: r.label,
    definition: r.definition,
    indicators: r.indicators,
    purpose: r.purpose,
    impact: r.impact,
    sortOrder: r.sort_order,
    weight: Number(r.weight),
  };
}

/** The measures of a cycle (both tables, or one), in sort order. [] before migration 06. */
export async function listHealthCardMeasures(cycleId: string, tableKey?: HcTableKey): Promise<HcMeasure[]> {
  let q = rxService().from("recognition_health_card_measures").select("*").eq("cycle_id", cycleId);
  if (tableKey) q = q.eq("table_key", tableKey);
  const { data, error } = await q.order("table_key").order("sort_order").order("measure_key");
  if (error) {
    if (isMissingRelation(error)) return [];
    fail("list health card measures", error);
  }
  return ((data ?? []) as MeasureDbRow[]).map(toMeasure);
}

/** Weighted average of a full set of measure scores; null if any is missing or weights sum to 0. */
export function measureLayer1(measures: HcMeasure[], scores: Map<string, number>): number | null {
  if (measures.length === 0) return null;
  let sumW = 0;
  let sum = 0;
  for (const m of measures) {
    const s = scores.get(m.key);
    if (s === undefined) return null;
    sumW += m.weight;
    sum += m.weight * s;
  }
  return sumW > 0 ? round2(sum / sumW) : null;
}

/**
 * Every chapter's Health Card for one award: per-measure scores of the
 * award's table in its cycle, falling back to the award's single score.
 * Chapters with no data at all are absent from byChapter.
 */
export async function loadAwardHealthCard(award: AwardRow): Promise<AwardHealthCard> {
  const tableKey = await healthCardTableFor(award);
  const svc = rxService();
  const [measures, scoreRes, oldRes] = await Promise.all([
    listHealthCardMeasures(award.cycle_id, tableKey),
    svc
      .from("recognition_health_card_scores")
      .select("chapter_id, measure_key, score")
      .eq("cycle_id", award.cycle_id)
      .eq("table_key", tableKey),
    svc.from("recognition_layer1").select("chapter_id, score, source").eq("award_id", award.id),
  ]);
  if (scoreRes.error && !isMissingRelation(scoreRes.error)) fail("read health card measure scores", scoreRes.error);
  if (oldRes.error) fail("read layer 1", oldRes.error);

  const measureKeys = new Set(measures.map((m) => m.key));
  const perChapter = new Map<string, Map<string, number>>();
  for (const r of ((scoreRes.error ? [] : scoreRes.data) ?? []) as Array<{ chapter_id: string; measure_key: string; score: number | string }>) {
    if (!measureKeys.has(r.measure_key)) continue;
    if (!perChapter.has(r.chapter_id)) perChapter.set(r.chapter_id, new Map());
    perChapter.get(r.chapter_id)!.set(r.measure_key, Number(r.score));
  }

  const byChapter = new Map<string, ChapterHealthCard>();
  for (const [chapterId, scores] of perChapter) {
    const layer1 = measureLayer1(measures, scores);
    byChapter.set(chapterId, {
      scores: measures.map((m) => ({ key: m.key, score: scores.has(m.key) ? scores.get(m.key)! : null })),
      layer1,
      source: layer1 === null ? null : "measures",
      incomplete: layer1 === null,
    });
  }
  for (const r of (oldRes.data ?? []) as Array<{ chapter_id: string; score: number | string; source: "excel" | "manual" }>) {
    if (byChapter.has(r.chapter_id)) continue; // per-measure data wins
    byChapter.set(r.chapter_id, {
      scores: measures.map((m) => ({ key: m.key, score: null })),
      layer1: Number(r.score),
      source: r.source,
      incomplete: false,
    });
  }
  return { tableKey, measures, byChapter };
}

/**
 * The award's Part A questions (30 Oct model): the measures of its table, in
 * sort order. Every RM and NMT member marks each one 0-10 on their sheet.
 */
export async function partAMeasuresForAward(award: AwardRow): Promise<HcMeasure[]> {
  return listHealthCardMeasures(award.cycle_id, await healthCardTableFor(award));
}

/**
 * chapter_id -> Layer 1 (0-100) for every chapter that has one. Reference
 * only since the 30 Oct model: the matrix total uses Part A instead.
 */
export async function layer1ForAward(award: AwardRow): Promise<Map<string, number>> {
  const hc = await loadAwardHealthCard(award);
  const out = new Map<string, number>();
  for (const [chapterId, c] of hc.byChapter) if (c.layer1 !== null) out.set(chapterId, c.layer1);
  return out;
}

/** Split a one-per-line text field into its non-blank lines. */
export function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter((s) => s !== "");
}
