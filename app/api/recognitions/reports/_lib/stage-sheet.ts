import "server-only";

import { ceremonyReport, type CeremonyReport } from "./report-data";

/**
 * The stage sheet (recognitions_05, Piyush 15 Oct 2026): for every
 * recognition and every category (Pioneers, Trailblazers, Sparks), the final
 * 1st, 2nd and 3rd chapters with the NMT's citation, to be read out on stage.
 * Built from the ceremony report data (the approved moderation's top 3, with
 * the super admin's polish) — no new citation fields. Callers pass
 * requireRxOversight first.
 */

export type StageSheet = CeremonyReport;

export async function stageSheet(includePending: boolean): Promise<StageSheet | null> {
  return ceremonyReport(includePending);
}

const CSV_HEAD = [
  "Status",
  "Recognition",
  "Category",
  "Place",
  "Rank",
  "Chapter",
  "Region",
  "Home chapter of",
  "Citation (read out on stage)",
  "NMT rationale",
];

function cell(v: string | number): string {
  let s = String(v ?? "");
  // Neutralise spreadsheet formulas (CSV injection).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per podium place; UTF-8 with a BOM so Excel keeps non-Latin names. */
export function stageSheetCsv(sheet: StageSheet): string {
  const rows: Array<Array<string | number>> = [CSV_HEAD];
  for (const a of sheet.awards) {
    for (const p of a.places) {
      rows.push([
        a.approved ? "Approved" : "Not yet approved",
        a.title,
        p.categoryLabel,
        p.rankLabel,
        p.rank,
        p.chapterName,
        p.region,
        p.homeOf,
        p.citation,
        p.rationale,
      ]);
    }
  }
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
