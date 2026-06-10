/**
 * Minimal CSV helper for Yi Youth Academy exports.
 * Clone of donor lib/yi-future/csv.ts (Phase 15 task list) — keeps the
 * formula-injection guard; csvResponse is omitted because the quarterly
 * export returns the CSV string from a server action (client-side download),
 * not from a route handler.
 *
 * Intentionally simple: no external library, no streaming — export volumes
 * are small (one row per academy).
 */

/**
 * Converts an array of objects to a CSV string.
 *
 * @param rows     - Array of uniform record objects.
 * @param columns  - Ordered column definitions: key to read from each row,
 *                   label to use as the header.
 */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: string; label: string }[]
): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    let str = String(value);
    // CSV/spreadsheet formula-injection guard: a value starting with = + - @
    // tab or CR is auto-evaluated by Excel / Sheets / LibreOffice. Prefix a
    // single quote (the standard mitigation) so it renders as literal text.
    if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
    // Wrap in quotes if the value contains a comma, newline, or double-quote.
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(","))
    .join("\n");

  return header + "\n" + body;
}
