/**
 * GET /api/recognitions/reports/verticals?format=xlsx
 *
 * Vertical-wise report (mail 2: "download a final vertical wise report"):
 * one sheet per award with the full combined matrix — Layer 1, every RM and
 * NMT total with the evaluator's name, the counted layers, the combined
 * total, and the final score / rank from the latest submitted moderation —
 * plus the award's phase. Super admin only; denials are JSON.
 */

import * as XLSX from "xlsx";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { verticalReport } from "../_lib/report-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

/** Excel sheet names: max 31 chars, no []:*?/\ , unique. */
function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Award";
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 26)} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

export async function GET(req: Request) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return json(gate.error.startsWith("You are not signed in") ? 401 : 403, gate.error);

  const format = new URL(req.url).searchParams.get("format") ?? "xlsx";
  if (format !== "xlsx") return json(400, "The vertical-wise report is only available as Excel (format=xlsx).");

  const report = await verticalReport();
  if (!report) return json(404, "No cycle is open yet, so there is nothing to report.");

  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sheet of report.sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.aoa);
    ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 24 }, { wch: 9 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName(sheet.title, used));
  }
  if (report.sheets.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["This cycle has no active awards yet."]]), "Awards");
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="yi-recognitions-verticals-${report.cycle.yi_year}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
