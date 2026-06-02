/**
 * Minimal CSV helpers for Future 6.0 export routes.
 *
 * Intentionally simple: no external library, no streaming — export volumes
 * are small (hundreds of rows at most).
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

/**
 * Wraps a CSV string in a Response suitable for file download.
 *
 * @param filename - Value for Content-Disposition (without path, e.g. "finalists.csv").
 * @param csv      - The CSV string produced by toCSV().
 */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
