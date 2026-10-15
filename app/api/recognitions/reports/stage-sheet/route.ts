/**
 * GET /api/recognitions/reports/stage-sheet[?include=pending]
 *
 * The stage sheet as CSV (recognitions_05): every recognition x category,
 * 1st / 2nd / 3rd with the citation read out on stage and the NMT's
 * rationale. Approved recognitions only, unless include=pending adds those
 * awaiting National Leadership, marked "Not yet approved". Super admin and
 * National Leadership; denials are JSON.
 */

import { requireRxOversight } from "@/lib/recognitions/auth";
import { stageSheet, stageSheetCsv } from "../_lib/stage-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET(req: Request) {
  const gate = await requireRxOversight();
  if (!gate.ok) return json(gate.error.startsWith("You are not signed in") ? 401 : 403, gate.error);

  const includePending = new URL(req.url).searchParams.get("include") === "pending";
  const sheet = await stageSheet(includePending);
  if (!sheet) return json(404, "No cycle is open yet, so there is nothing to put on the stage sheet.");

  return new Response(stageSheetCsv(sheet), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yi-recognitions-stage-sheet-${sheet.cycle.yi_year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
