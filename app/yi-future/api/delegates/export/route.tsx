/**
 * GET /yi-future/api/delegates/export?format=xlsx|pdf
 *
 * Exports the national delegates table with the SAME filters the screen is
 * showing: ?region=&chapter=&college=&q=. Filter logic is imported from
 * lib/yi-future/delegate-filters so the file can never disagree with the page.
 *
 * Auth mirrors app/yi-future/api/csv/[scope] (hardened 2026-06-01 against a
 * broken-object-level-authorization gap where any signed-in admin could export
 * national PII and access codes):
 *
 *   • Platform/super tier  → may export any scope, access codes included.
 *   • Chapter core-team    → forced to their OWN chapter; any region/chapter
 *                            param is discarded; access codes are stripped.
 *   • Anyone else          → 403.
 *
 * The delegates PAGE itself only checks "is signed in", so this route is
 * deliberately stricter than the screen it exports. Downloading a file is a
 * different risk from viewing one: it leaves the building.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  DELEGATE_COLUMNS,
  applyDelegateFilters,
  resolveScopeChapterIds,
  toExportRecord,
  type ChapterMini,
  type DelegateFilters,
  type DelegateRow,
} from "@/lib/yi-future/delegate-filters";
import { DelegateRosterPDF } from "@/lib/yi-future/delegate-roster-pdf";

export const runtime = "nodejs";

/** Rows per PostgREST request while paging the full result set. */
const FETCH_BATCH = 1000;

/** Excel comfortably holds the whole table (16.7k rows today). */
const MAX_XLSX_ROWS = 25_000;

/** A PDF of every delegate would be ~400 pages and slow to open, so the
 *  document is capped and says so on page 1. Excel is the complete export. */
const MAX_PDF_ROWS = 2_000;

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Filename-safe slug, e.g. "Erode (SRTN)" → "erode-srtn". */
function slug(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "all"
  );
}

async function getAllChapters(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<ChapterMini[]> {
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region")
    .eq("is_active", true)
    .order("name");
  return (data as ChapterMini[] | null) ?? [];
}

/** Page through every matching delegate, newest filter logic, name-ordered. */
async function fetchMatchingRows(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  filters: DelegateFilters,
  limit: number
): Promise<DelegateRow[]> {
  const out: DelegateRow[] = [];
  for (let from = 0; from < limit; from += FETCH_BATCH) {
    const to = Math.min(from + FETCH_BATCH, limit) - 1;
    const { data, error } = await applyDelegateFilters(
      svc.schema("future").from("delegates").select(DELEGATE_COLUMNS),
      filters
    )
      .order("full_name", { ascending: true })
      .range(from, to);
    if (error) break;
    const batch = (data as unknown as DelegateRow[]) ?? [];
    out.push(...batch);
    if (batch.length < to - from + 1) break; // last page
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "pdf") {
    return jsonError(400, "format must be xlsx or pdf");
  }

  let region = (url.searchParams.get("region") ?? "all").trim() || "all";
  let chapter = (url.searchParams.get("chapter") ?? "all").trim() || "all";
  const college = (url.searchParams.get("college") ?? "all").trim() || "all";
  const q = (url.searchParams.get("q") ?? "").trim();

  // ─── Authorization ──────────────────────────────────────────────────────
  const { isPlatform } = await isCurrentUserPlatformAdmin();
  let includeAccessCode = true;

  if (!isPlatform) {
    const ctx = await getChapterContext();
    if (!ctx) {
      return jsonError(
        403,
        "Forbidden: exporting delegates requires a platform admin, or chapter core-team membership for the active edition."
      );
    }
    // Force the caller's own chapter and discard whatever was requested.
    chapter = ctx.chapterId;
    region = "all";
    includeAccessCode = false;
  }

  const svc = await createServiceClient();
  const chapters = await getAllChapters(svc);
  const scopeChapterIds = resolveScopeChapterIds(chapters, region, chapter);
  const filters: DelegateFilters = { scopeChapterIds, college, search: q };

  // Exact total for the header — head:true, so no rows cross the wire.
  const { count } = await applyDelegateFilters(
    svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true }),
    filters
  );
  const totalMatching = count ?? 0;

  const cap = format === "pdf" ? MAX_PDF_ROWS : MAX_XLSX_ROWS;
  const rows = await fetchMatchingRows(svc, filters, cap);
  const records = rows.map((r) => toExportRecord(r, includeAccessCode));

  // ─── Human-readable provenance ──────────────────────────────────────────
  const chapterName =
    chapter !== "all"
      ? (chapters.find((c) => c.id === chapter)?.name ?? "Chapter")
      : null;
  const collegeName =
    college !== "all"
      ? ((
          await svc
            .schema("future")
            .from("colleges")
            .select("name")
            .eq("id", college)
            .maybeSingle()
        ).data as { name: string } | null)?.name ?? null
      : null;

  const parts: string[] = [];
  parts.push(region !== "all" ? `Region ${region}` : "All regions");
  if (chapterName) parts.push(`Chapter ${chapterName}`);
  if (collegeName) parts.push(`College ${collegeName}`);
  if (q) parts.push(`Search "${q}"`);
  const filterSummary = parts.join(" · ");

  const nameBits = ["yi-future-delegates"];
  if (region !== "all") nameBits.push(slug(region));
  if (chapterName) nameBits.push(slug(chapterName));
  if (collegeName) nameBits.push(slug(collegeName));
  const baseName = `${nameBits.join("-")}-${todayStamp()}`;

  // ─── Excel ──────────────────────────────────────────────────────────────
  if (format === "xlsx") {
    const header = [
      "Full Name",
      "Email",
      "Phone",
      "Chapter",
      "College",
      "Course",
      "Team",
      ...(includeAccessCode ? ["Access Code"] : []),
      "Status",
    ];
    const body = records.map((r) => [
      r.name,
      r.email,
      r.phone,
      r.chapter,
      r.college,
      r.course,
      r.team,
      ...(includeAccessCode ? [r.accessCode] : []),
      r.status,
    ]);

    // Provenance rows above the table so the file explains itself later.
    const meta = [
      ["Future 6.0 — Delegate Roster"],
      [filterSummary],
      [`${totalMatching} delegates matching filters`],
      ...(records.length < totalMatching
        ? [[`Capped at ${records.length} rows in this file`]]
        : []),
      [`Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...meta, header, ...body]);
    ws["!cols"] = [
      { wch: 26 },
      { wch: 32 },
      { wch: 14 },
      { wch: 16 },
      { wch: 34 },
      { wch: 16 },
      { wch: 22 },
      ...(includeAccessCode ? [{ wch: 12 }] : []),
      { wch: 10 },
    ];
    // Freeze everything above and including the header row.
    ws["!freeze"] = { xSplit: 0, ySplit: meta.length + 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delegates");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ─── PDF ────────────────────────────────────────────────────────────────
  const pdfElement = React.createElement(DelegateRosterPDF, {
    rows: records,
    filterSummary,
    totalMatching,
    cappedAt: records.length < totalMatching ? records.length : null,
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
    includeAccessCode,
  });

  // @react-pdf/renderer types its entry points against DocumentProps, which a
  // wrapper component never structurally matches. Same cast the existing
  // /api/finalists/[eventId]/pdf route uses.
  const pdf = await renderToBuffer(pdfElement as never);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
