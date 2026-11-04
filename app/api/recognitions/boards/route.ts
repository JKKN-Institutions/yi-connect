/**
 * GET /api/recognitions/boards?kind=nominations|predictions
 *
 * Excel download of the Nominations board or the Recognitions predictor board
 * (Piyush, 3 Nov 2026: "download the matrix for nominations and predictions
 * later when we want to"). Same gate and same region filter as the pages:
 * requireRxBoard + loadBoard(kind, sight), so a Regional Mentor's file holds
 * only their region, exactly as their screen does. Denials are JSON.
 *
 * Two sheets: "Board" is the matrix as shown on screen (recognitions down,
 * categories across); "List" is one row per chapter entry, easy to filter.
 */

import * as XLSX from "xlsx";
import { loadBoard, requireRxBoard, sightLine, type BoardData } from "@/lib/recognitions/board";
import { CATEGORIES } from "@/lib/recognitions/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

function istNow(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function boardSheet(board: BoardData, kind: "nominations" | "predictions", title: string, sight: string): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [
    [title],
    [`${board.cycle.name} · downloaded ${istNow()} IST · ${sight}`],
    [],
    ["Recognition", ...board.columns.map((c) => `${c.label} (${c.chapterCount} chapter${c.chapterCount === 1 ? "" : "s"})`)],
  ];
  for (const r of board.rows) {
    aoa.push([
      r.award.title,
      ...CATEGORIES.map((cat) =>
        r.cells[cat]
          .map((e) => (kind === "predictions" ? `${e.chapterName} (${e.votes ?? 0})` : e.chapterName))
          .join("\n")
      ),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
  return ws;
}

function listSheet(board: BoardData, kind: "nominations" | "predictions"): XLSX.WorkSheet {
  const label = new Map(board.columns.map((c) => [c.category, c.label]));
  const head = kind === "predictions" ? ["Recognition", "Category", "Chapter", "Votes", "Place"] : ["Recognition", "Category", "Chapter", "Order filed"];
  const aoa: (string | number)[][] = [head];
  for (const r of board.rows) {
    for (const cat of CATEGORIES) {
      r.cells[cat].forEach((e, i) => {
        aoa.push(
          kind === "predictions"
            ? [r.award.title, label.get(cat) ?? cat, e.chapterName, e.votes ?? 0, i + 1]
            : [r.award.title, label.get(cat) ?? cat, e.chapterName, i + 1]
        );
      });
    }
  }
  if (aoa.length === 1) aoa.push([kind === "predictions" ? "No votes yet." : "No nominations filed yet."]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 8 }];
  return ws;
}

export async function GET(req: Request) {
  const gate = await requireRxBoard();
  if (!gate.ok) return json(gate.error.startsWith("You are not signed in") ? 401 : 403, gate.error);

  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "nominations" && kind !== "predictions") {
    return json(400, "Say which board to download: kind=nominations or kind=predictions.");
  }

  const board = await loadBoard(kind, gate.sight);
  if (!board) return json(404, "No cycle is open yet, so there is nothing to download.");

  const title = kind === "predictions" ? "Recognitions predictor" : "Nominations board";
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, boardSheet(board, kind, title, sightLine(gate.sight)), "Board");
  XLSX.utils.book_append_sheet(wb, listSheet(board, kind), "List");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="yi-recognitions-${kind}-${board.cycle.yi_year}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
