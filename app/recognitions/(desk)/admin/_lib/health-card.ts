import "server-only";

import * as XLSX from "xlsx";
import { rxService } from "@/lib/recognitions/supabase";
import type { ChapterRow } from "@/lib/recognitions/types";

/**
 * Health Card parsing. No sample file has been received yet, so nothing
 * here assumes column names: the super admin picks which column holds the
 * chapter name and which holds the 0-100 Layer 1 score. The file is always
 * re-read from Storage on the server; the browser never supplies rows.
 */

export const HEALTH_CARD_BUCKET = "recognitions";

export type HealthCardFile = {
  id: string;
  award_id: string;
  storage_path: string;
  file_name: string;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type ParsedSheet = {
  sheetName: string;
  /** Excel row number of rows[0] (the header row). */
  firstRowNo: number;
  rows: unknown[][];
};

/** Read the first sheet of a workbook buffer. Throws on an unreadable file. */
export function parseWorkbook(buf: ArrayBuffer | Uint8Array): ParsedSheet {
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellNF: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("no sheets");
  const ws = wb.Sheets[sheetName];
  const ref = ws["!ref"];
  const range = ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  const start = range.s.r;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true, blankrows: true });
  // A cell formatted as a percentage holds 0.82 for "82%"; read it as 82.
  rows.forEach((row, i) =>
    row.forEach((_, j) => {
      const cell = ws[XLSX.utils.encode_cell({ r: range.s.r + i, c: range.s.c + j })] as XLSX.CellObject | undefined;
      if (cell && cell.t === "n" && typeof cell.z === "string" && cell.z.includes("%") && typeof cell.v === "number")
        row[j] = Math.round(cell.v * 100 * 10000) / 10000;
    })
  );
  // Drop leading blank rows so the header is the first row with content.
  let skip = 0;
  while (skip < rows.length && rows[skip].every((c) => String(c ?? "").trim() === "")) skip++;
  return { sheetName, firstRowNo: start + skip + 1, rows: rows.slice(skip) };
}

export async function loadHealthCardFile(
  fileId: string
): Promise<{ ok: true; file: HealthCardFile; sheet: ParsedSheet } | { ok: false; error: string }> {
  const svc = rxService();
  const { data: file } = await svc.from("recognition_health_card_files").select("*").eq("id", fileId).maybeSingle();
  if (!file) return { ok: false, error: "That Health Card file no longer exists. Upload it again." };
  const f = file as HealthCardFile;
  const { data: blob, error } = await svc.storage.from(HEALTH_CARD_BUCKET).download(f.storage_path);
  if (error || !blob) return { ok: false, error: "Couldn't open the stored file. Upload it again." };
  try {
    const sheet = parseWorkbook(new Uint8Array(await blob.arrayBuffer()));
    return { ok: true, file: f, sheet };
  } catch {
    return { ok: false, error: "We couldn't read that file as a spreadsheet. Save it as .xlsx and upload it again." };
  }
}

export function headerOf(sheet: ParsedSheet): string[] {
  const head = sheet.rows[0] ?? [];
  const width = Math.max(head.length, ...sheet.rows.slice(0, 50).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => {
    const v = String(head[i] ?? "").trim();
    return v === "" ? `Column ${i + 1}` : v;
  });
}

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export type MatchedRow = {
  rowNo: number;
  chapterId: string;
  chapterName: string;
  cell: string;
  score: number;
  raw: Record<string, unknown>;
};

export type MatchResult = {
  matched: MatchedRow[];
  unmatched: Array<{ rowNo: number; cell: string }>;
  skipped: Array<{ rowNo: number; chapterName: string; why: string }>;
  /** Rows that block "Apply scores" until the file is fixed. */
  problems: string[];
};

function readScore(v: unknown): number | null | "bad" {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : "bad";
  const s = String(v).trim().replace(/%$/, "").replace(/,/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : "bad";
}

function rawJson(header: string[], row: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  header.forEach((h, i) => {
    const v = row[i];
    out[h] = v instanceof Date ? v.toISOString() : v ?? "";
  });
  return out;
}

export function matchRows(
  sheet: ParsedSheet,
  chapterCol: number,
  scoreCol: number,
  chapters: ChapterRow[]
): MatchResult {
  const header = headerOf(sheet);
  const byName = new Map(chapters.map((c) => [normName(c.name), c]));
  const result: MatchResult = { matched: [], unmatched: [], skipped: [], problems: [] };
  const seen = new Map<string, number>();

  sheet.rows.slice(1).forEach((row, i) => {
    const rowNo = sheet.firstRowNo + 1 + i;
    if (row.every((c) => String(c ?? "").trim() === "")) return;
    const cell = String(row[chapterCol] ?? "").trim();
    if (cell === "") return;
    // Exact name first; then the same name without a leading "Yi ".
    const chapter = byName.get(normName(cell)) ?? byName.get(normName(cell.replace(/^yi\s+/i, "")));
    if (!chapter) {
      result.unmatched.push({ rowNo, cell });
      return;
    }
    const score = readScore(row[scoreCol]);
    if (score === null) {
      result.skipped.push({ rowNo, chapterName: chapter.name, why: "no score in that column" });
      return;
    }
    if (score === "bad") {
      result.problems.push(`Row ${rowNo} (${chapter.name}): "${String(row[scoreCol])}" is not a number.`);
      return;
    }
    if (score < 0 || score > 100) {
      result.problems.push(`Row ${rowNo} (${chapter.name}): score ${score} is outside 0-100.`);
      return;
    }
    const before = seen.get(chapter.id);
    if (before !== undefined) {
      result.problems.push(`Row ${rowNo} (${chapter.name}): this chapter is already on row ${before}.`);
      return;
    }
    seen.set(chapter.id, rowNo);
    result.matched.push({
      rowNo,
      chapterId: chapter.id,
      chapterName: chapter.name,
      cell,
      score: Math.round(score * 100) / 100,
      raw: rawJson(header, row),
    });
  });
  return result;
}
