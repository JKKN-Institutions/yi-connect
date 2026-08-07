// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — shared filter logic for the national delegates table.
//
// Extracted from app/yi-future/national/admin/delegates/page.tsx so the page
// and the Excel/PDF export at /yi-future/api/delegates/export apply IDENTICAL
// filters. If these ever diverged, an admin would export a file that silently
// disagrees with the rows on screen — the worst possible failure for an export
// feature, because it looks like it worked.
//
// Deliberately NOT a "use server" module: it exports types and sync helpers,
// which a "use server" file may not do (that breaks the Vercel build).
// ═══════════════════════════════════════════════════════════════════════

/** Columns the table and both exports read. Keep in one place so a column
 *  added to the screen is a one-line change for the exports too. */
export const DELEGATE_COLUMNS =
  "id, full_name, email, phone, access_code, is_active, course, chapter_id, college_id, chapters(name), colleges(name), team_members(teams(team_name))";

export type DelegateFilters = {
  /** null == no chapter scoping (all chapters). */
  scopeChapterIds: string[] | null;
  college?: string;
  search?: string;
};

export type DelegateRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  access_code: string | null;
  is_active: boolean | null;
  course: string | null;
  chapter_id: string;
  college_id: string | null;
  chapters: { name: string } | null;
  colleges: { name: string } | null;
  team_members: { teams: { team_name: string } | null }[] | null;
};

export type ChapterMini = { id: string; name: string; region: string | null };

/** PostgREST or() is comma/paren-delimited, so those characters in user input
 *  would corrupt the filter — strip them rather than fail the query. */
export function safeSearch(raw: string | undefined): string {
  return (raw ?? "").replace(/[,()*%]/g, " ").trim();
}

/** Apply the table's filters to a PostgREST query builder. Used for the list,
 *  the KPI head-counts, and both export formats.
 *
 *  `query` is loosely typed: PostgREST builders are generic over the selected
 *  column string, so a shared helper cannot name one concrete type. */
export function applyDelegateFilters(query: any, f: DelegateFilters) {
  let q = query.eq("is_active", true);
  if (f.scopeChapterIds) q = q.in("chapter_id", f.scopeChapterIds);
  if (f.college && f.college !== "all") q = q.eq("college_id", f.college);
  const s = safeSearch(f.search);
  if (s) {
    // Searches the delegate's own columns. Chapter and college are already
    // first-class dropdown filters, so they are not duplicated here.
    q = q.or(
      [
        `full_name.ilike.%${s}%`,
        `email.ilike.%${s}%`,
        `phone.ilike.%${s}%`,
        `course.ilike.%${s}%`,
        `access_code.ilike.%${s}%`,
      ].join(",")
    );
  }
  return q;
}

/**
 * Resolve the region/chapter dropdowns into the set of chapter ids every query
 * is scoped by. An explicit chapter wins over a region; "all" on both means no
 * scoping at all (null).
 */
export function resolveScopeChapterIds(
  chapters: ChapterMini[],
  region: string,
  chapter: string
): string[] | null {
  if (chapter !== "all") return [chapter];
  if (region !== "all") {
    return chapters.filter((c) => (c.region ?? "") === region).map((c) => c.id);
  }
  return null;
}

/** One flat, human-readable record — the shape both Excel and PDF render. */
export type DelegateExportRecord = {
  name: string;
  email: string;
  phone: string;
  chapter: string;
  college: string;
  course: string;
  team: string;
  accessCode: string;
  status: string;
};

/**
 * Flatten a joined delegate row for export.
 *
 * @param includeAccessCode false for chapter-scoped admins — access codes are
 *   login credentials and a national/platform concern only. The column is kept
 *   in the record (blank) so the two variants share one header layout.
 */
export function toExportRecord(
  r: DelegateRow,
  includeAccessCode: boolean
): DelegateExportRecord {
  const team = r.team_members?.[0]?.teams?.team_name ?? "";
  return {
    name: r.full_name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    chapter: r.chapters?.name ?? "",
    college: r.colleges?.name ?? "",
    course: r.course ?? "",
    team: team || "no team",
    accessCode: includeAccessCode ? (r.access_code ?? "") : "",
    status: r.is_active ? "Active" : "Inactive",
  };
}
