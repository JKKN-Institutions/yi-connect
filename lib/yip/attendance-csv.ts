/**
 * Shared CSV helpers for the two attendance exports:
 *   - per-event  → app/yip/actions/school-export.ts (exportAllocationRoster)
 *   - national   → app/yip/actions/national-attendance-export.ts
 *
 * Lives in lib/ (not next to the actions) because a `"use server"` file may
 * export ONLY async functions — a non-async helper exported from an actions
 * file breaks the Vercel build.
 */

/** Quote a value for CSV, doubling any embedded quotes. */
export function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Excel-safe CSV: CRLF line endings, header row first. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ].join("\r\n");
}

/** Yes/No for a nullable check-in flag — blank is "not checked in", not unknown. */
export function checkInLabel(v: boolean | null | undefined): string {
  return v === true ? "Yes" : "No";
}

/**
 * Render a check-in timestamp for a spreadsheet: "05-08-2026 09:42" in IST.
 *
 * Events run in India and the file is read by chapter/national staff there, so
 * the wall-clock time the organiser saw at the desk is the only useful
 * rendering — a raw UTC ISO string reads 5h30m early and gets misreported as
 * attendance before the doors opened.
 */
export function formatCheckInTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
}
