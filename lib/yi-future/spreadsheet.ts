// ═══════════════════════════════════════════════════════════════════════
// Domain-free helpers for reading organiser spreadsheets.
//
// Lifted from components/yip/csv-import.tsx, which has been parsing real
// chapter rosters for months. Kept generic here so Yi-Future does not become
// the third copy-paste of the same three functions (YIP already has two, with
// return types that have quietly drifted apart).
// ═══════════════════════════════════════════════════════════════════════

/**
 * Collapse a spreadsheet header into a comparable key.
 *
 * Lowercase, then every run of non-alphanumerics becomes a single space, so
 * "Full Name", "full_name", "FULL  NAME" and "Full-Name" all match.
 */
export function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Index of the first header matching any alias, or -1.
 *
 * Index-based rather than key-based because the parser reads the sheet with
 * `{ header: 1 }` (literal rows). Reading headers from `Object.keys(rows[0])`
 * instead — as the YIP importer does — silently loses a column whenever the
 * first data row happens to have that cell blank.
 */
export function findColumnIndex(headers: string[], aliases: string[]): number {
  const wanted = new Set(aliases.map(normHeader));
  return headers.findIndex((h) => wanted.has(normHeader(h)));
}

/**
 * Normalise a phone cell to bare digits.
 *
 * Excel is the reason this is not a one-liner: a 10-digit Indian mobile typed
 * into a General-format cell is stored as a number and comes back as
 * "9.894e9". Without the scientific-notation branch you persist that string
 * verbatim and the number is silently destroyed.
 */
export function normalizePhone(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const str = String(raw);
  if (/e/i.test(str)) {
    const n = Number(str);
    if (!Number.isNaN(n)) return Math.round(n).toString();
  }
  // Drop a leading country code so 91XXXXXXXXXX and XXXXXXXXXX dedupe alike.
  return str.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

/** Trim a cell to a string, treating null/undefined as empty. */
export function cellText(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  return String(raw).trim();
}

/** Parse a cell to a positive integer, or undefined when absent/unparseable. */
export function cellInt(raw: unknown): number | undefined {
  const t = cellText(raw);
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}
