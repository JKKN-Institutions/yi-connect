/**
 * GET /api/recognitions/reports/ceremony?format=pdf|xlsx[&include=pending]
 *
 * Awards ceremony report (mail 1, Report 1): per award and category, the
 * winner, runner-up and second runner-up with key achievements, citation and
 * announcement text. Approved (finalised) awards only, unless
 * include=pending also adds awards awaiting National Leadership, clearly
 * marked "Not yet approved". Super admin only; denials are JSON.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { ceremonyReport } from "../_lib/report-data";
import { CeremonyPDF } from "../_lib/ceremony-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET(req: Request) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return json(gate.error.startsWith("You are not signed in") ? 401 : 403, gate.error);

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  const includePending = url.searchParams.get("include") === "pending";

  const report = await ceremonyReport(includePending);
  if (!report) return json(404, "No cycle is open yet, so there is nothing to report.");
  const base = `yi-recognitions-ceremony-${report.cycle.yi_year}`;

  if (format === "xlsx") {
    const rows: Array<Array<string | number>> = [
      ["Status", "Award", "Category", "Rank", "Place", "Chapter", "Region", "Key achievements", "Citation", "Announcement text"],
    ];
    for (const a of report.awards) {
      for (const p of a.places) {
        rows.push([
          a.approved ? "Approved" : "Not yet approved",
          a.title,
          p.categoryLabel,
          p.rank,
          p.rankLabel,
          p.chapterName,
          p.region,
          p.keyAchievements.map((k) => `• ${k}`).join("\n"),
          p.citation,
          p.announcement,
        ]);
      }
    }
    if (report.awards.length === 0) rows.push(["No award is ready for the ceremony yet."]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [16, 26, 14, 6, 18, 22, 9, 60, 60, 60].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Ceremony");

    const scripts = report.awards.filter((a) => a.ceremonyScript);
    if (scripts.length > 0) {
      const ss = XLSX.utils.aoa_to_sheet([["Award", "Ceremony script"], ...scripts.map((a) => [a.title, a.ceremonyScript ?? ""])]);
      ss["!cols"] = [{ wch: 26 }, { wch: 100 }];
      XLSX.utils.book_append_sheet(wb, ss, "Ceremony scripts");
    }
    if (report.notIncluded.length > 0) {
      const ns = XLSX.utils.aoa_to_sheet([["Award", "Not included because"], ...report.notIncluded.map((n) => [n.title, n.why])]);
      ns["!cols"] = [{ wch: 26 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ns, "Not included");
    }
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await renderToBuffer((<CeremonyPDF report={report} includePending={includePending} />) as never);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
