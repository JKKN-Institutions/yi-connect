/**
 * GET /api/recognitions/reports/audit?format=xlsx|csv[&who=&chapter=&award=&action=&from=&to=]
 *
 * The whole activity log of the current cycle (super admins, 17 Nov: "from
 * the day we gave access"), for the same filters as the Audit trail page.
 * Every matching row, not only the page on screen: the read pages through
 * PostgREST's 1000-row cap. Super admin only; denials are JSON.
 */

import * as XLSX from "xlsx";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { chapterMap, getCurrentCycle, listAwards } from "@/lib/recognitions/data";
import { auditLookups, currentRoles, loadCycleAudit } from "@/lib/recognitions/audit-data";
import { auditExportRows, filterAuditRows, isFiltered, parseAuditFilter, toCsv } from "@/lib/recognitions/audit-log";
import { fileSlug } from "../_lib/report-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

/** Excel refuses cells longer than 32,767 characters. */
const XLSX_CELL_MAX = 32000;

export async function GET(req: Request) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return json(gate.error.startsWith("You are not signed in") ? 401 : 403, gate.error);

  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "xlsx";
  if (format !== "xlsx" && format !== "csv") return json(400, "The activity log downloads as Excel (format=xlsx) or CSV (format=csv).");

  const cycle = await getCurrentCycle();
  if (!cycle) return json(404, "No cycle is open yet, so there is no activity to download.");

  const filter = parseAuditFilter(sp);
  const all = await loadCycleAudit(cycle.id);
  const [look, awards, chapters] = await Promise.all([auditLookups(all), listAwards(cycle.id, true), chapterMap()]);
  const rows = filterAuditRows(all, filter, look);
  const roles = await currentRoles(rows.map((r) => r.actor_person_id ?? ""));

  const aoa = auditExportRows(rows, {
    ...look,
    roles,
    awardTitle: new Map(awards.map((a) => [a.id, a.title])),
    chapterName: new Map([...chapters].map(([id, c]) => [id.toLowerCase(), c.name])),
  });
  const name = `yi-recognitions-activity-${fileSlug(String(cycle.yi_year))}${isFiltered(filter) ? "-filtered" : ""}`;

  if (format === "csv") {
    return new Response(toCsv(aoa), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa.map((r) => r.map((c) => (c.length > XLSX_CELL_MAX ? `${c.slice(0, XLSX_CELL_MAX)}…` : c))));
  ws["!cols"] = [{ wch: 20 }, { wch: 24 }, { wch: 28 }, { wch: 36 }, { wch: 24 }, { wch: 32 }, { wch: 24 }, { wch: 80 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activity");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
