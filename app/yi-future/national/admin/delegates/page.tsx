import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { WhatsAppIconButton } from "@/components/whatsapp";
import { AutoRefresh } from "@/components/yi-future/AutoRefresh";
import { fetchAllRows } from "@/lib/pagination";
import {
  ListSearchForm,
  ListPager,
  LIST_PAGE_SIZE,
} from "@/components/yi-future/table/list-table";
// Filter logic is shared with /yi-future/api/delegates/export so an exported
// Excel/PDF file always matches the rows on screen.
import {
  DELEGATE_COLUMNS,
  applyDelegateFilters,
  resolveScopeChapterIds,
  type DelegateFilters,
  type DelegateRow,
} from "@/lib/yi-future/delegate-filters";

// Filtering, counting and paging all happen IN THE DATABASE (see getDelegatePage /
// countDelegates). The previous fetch-everything approach broke at scale — see the
// PAGE_SIZE note below. force-dynamic + <AutoRefresh> keep the installed PWA live.
export const dynamic = "force-dynamic";

// Normalize an Indian mobile number to a country-code-prefixed digit string.
function waPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.startsWith("91") ? digits : "91" + digits;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ChapterRow = {
  id: string;
  name: string;
  region: string | null;
};

const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;

// ─── Data fetchers ──────────────────────────────────────────────────────────

// Max rows rendered in one view.
//
// This page used to fetchAllRows() every active delegate, filter in JS, and
// render the lot. At 58,955 delegates that is ~59 sequential PostgREST
// round-trips, a 15 MB payload and 50,000 table rows — the page died with
// 504 MIDDLEWARE_INVOCATION_TIMEOUT (2026-08-07). Filtering now happens in the
// database, the table is capped, and the KPI tiles use exact head-counts so the
// numbers stay true for the WHOLE filtered set even though only one page of
// rows is listed (LIST_PAGE_SIZE).

// DELEGATE_COLUMNS, DelegateFilters and the filter builder now live in
// lib/yi-future/delegate-filters so the export routes reuse them verbatim.

async function getDelegatePage(
  f: DelegateFilters,
  page: number
): Promise<DelegateRow[]> {
  const svc = await createServiceClient();
  const from = Math.max(0, page) * LIST_PAGE_SIZE;
  const { data } = await applyDelegateFilters(
    svc.schema("future").from("delegates").select(DELEGATE_COLUMNS),
    f
  )
    .order("full_name", { ascending: true })
    .range(from, from + LIST_PAGE_SIZE - 1);
  return (data as unknown as DelegateRow[]) ?? [];
}

/** Exact count with head:true — no row payload crosses the wire. */
async function countDelegates(
  f: DelegateFilters,
  opts: { inTeamOnly?: boolean } = {}
): Promise<number> {
  const svc = await createServiceClient();
  const { count } = await applyDelegateFilters(
    svc
      .schema("future")
      .from("delegates")
      .select(opts.inTeamOnly ? "id, team_members!inner(team_id)" : "id", {
        count: "exact",
        head: true,
      }),
    f
  );
  return count ?? 0;
}

async function getCollegesForChapters(
  chapterIds: string[]
): Promise<{ id: string; name: string }[]> {
  if (chapterIds.length === 0) return [];
  const svc = await createServiceClient();
  // Row-cap fix: .limit(1000) sat exactly ON the PostgREST ceiling, so a chapter
  // scope with 1000+ colleges silently lost the tail from the filter dropdown.
  // A request limit can only LOWER the server cap, never raise it — page instead.
  // (name, id) keeps the alphabetical order stable across page boundaries.
  return await fetchAllRows<{ id: string; name: string }>((from, to) =>
    svc
      .schema("future")
      .from("colleges")
      .select("id, name")
      .in("chapter_id", chapterIds)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: { id: string; name: string }[] | null;
      error: unknown;
    }>
  );
}

async function getAllChapters(): Promise<ChapterRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data as unknown as ChapterRow[]) ?? [];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildQuery(
  current: { region: string; chapter: string; college: string; q: string },
  changes: Partial<{
    region: string;
    chapter: string;
    college: string;
    q: string;
    page: string;
  }>
): string {
  // page defaults to dropped (resets to 0) unless explicitly changed.
  const merged = { page: "", ...current, ...changes };
  const parts: string[] = [];
  if (merged.region && merged.region !== "all")
    parts.push(`region=${encodeURIComponent(merged.region)}`);
  if (merged.chapter && merged.chapter !== "all")
    parts.push(`chapter=${encodeURIComponent(merged.chapter)}`);
  if (merged.college && merged.college !== "all")
    parts.push(`college=${encodeURIComponent(merged.college)}`);
  if (merged.q) parts.push(`q=${encodeURIComponent(merged.q)}`);
  if (merged.page && merged.page !== "0")
    parts.push(`page=${encodeURIComponent(merged.page)}`);
  return parts.length
    ? `/yi-future/national/admin/delegates?${parts.join("&")}`
    : "/yi-future/national/admin/delegates";
}

/** Export URL carrying the exact filters currently on screen. */
function buildExportHref(
  current: { region: string; chapter: string; college: string; q: string },
  format: "xlsx" | "pdf"
): string {
  const parts = [`format=${format}`];
  if (current.region !== "all")
    parts.push(`region=${encodeURIComponent(current.region)}`);
  if (current.chapter !== "all")
    parts.push(`chapter=${encodeURIComponent(current.chapter)}`);
  if (current.college !== "all")
    parts.push(`college=${encodeURIComponent(current.college)}`);
  if (current.q) parts.push(`q=${encodeURIComponent(current.q)}`);
  return `/yi-future/api/delegates/export?${parts.join("&")}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AllDelegatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    region?: string;
    chapter?: string;
    college?: string;
    q?: string;
    page?: string;
  }>;
}) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  const sp = await searchParams;
  const region = (sp.region ?? "all").trim() || "all";
  const chapter = (sp.chapter ?? "all").trim() || "all";
  const college = (sp.college ?? "all").trim() || "all";
  const q = (sp.q ?? "").trim();
  const pageParam = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const current = { region, chapter, college, q };

  const chapters = await getAllChapters();
  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  // Resolve region/chapter into the set of chapter ids to scope every query by.
  // null == no chapter scoping (all chapters). Shared with the export routes.
  const scopeChapterIds = resolveScopeChapterIds(chapters, region, chapter);

  const filters: DelegateFilters = { scopeChapterIds, college, search: q };

  // College dropdown is only meaningful once the view is narrowed — unscoped it
  // would be 47k+ options. Sourced from future.colleges (indexed on chapter_id)
  // rather than from delegate rows, so it costs one small query.
  const [
    collegeOptions,
    totalDelegates,
    withTeam,
    pageRows,
    regionCounts,
    grandTotal,
  ] = await Promise.all([
    scopeChapterIds ? getCollegesForChapters(scopeChapterIds) : Promise.resolve([]),
    countDelegates(filters),
    countDelegates(filters, { inTeamOnly: true }),
    getDelegatePage(filters, pageParam),
    Promise.all(
      REGIONS.map(async (r) => {
        const ids = chapters
          .filter((c) => (c.region ?? "") === r)
          .map((c) => c.id);
        return [r, await countDelegates({ scopeChapterIds: ids })] as const;
      })
    ),
    countDelegates({ scopeChapterIds: null }),
  ]);

  // Same shape pageSlice() produced, computed from the exact total instead of a
  // fully-materialised array.
  const pageCount = Math.max(1, Math.ceil(totalDelegates / LIST_PAGE_SIZE));
  const page = Math.min(Math.max(0, pageParam), pageCount - 1);
  const rangeStart = totalDelegates === 0 ? 0 : page * LIST_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * LIST_PAGE_SIZE + LIST_PAGE_SIZE, totalDelegates);

  // Hidden inputs to carry the active filters through a search submit.
  const searchHidden = [
    ...(region !== "all" ? [{ name: "region", value: region }] : []),
    ...(chapter !== "all" ? [{ name: "chapter", value: chapter }] : []),
    ...(college !== "all" ? [{ name: "college", value: college }] : []),
  ];

  const countByRegion = new Map<string, number>(regionCounts);

  const anyFiltered =
    region !== "all" || chapter !== "all" || college !== "all" || q !== "";

  const withoutTeam = totalDelegates - withTeam;
  // Chapters covered by the current filter (not "chapters with ≥1 delegate" —
  // that needs a DISTINCT the REST API can't express without loading every row).
  const chaptersRepresented = scopeChapterIds
    ? scopeChapterIds.length
    : chapters.length;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30000} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">All Delegates</h2>
          <p className="mt-1 text-sm text-navy/60">
            {totalDelegates} delegate{totalDelegates === 1 ? "" : "s"}
            {anyFiltered ? " matching filters" : " across all chapters"}
          </p>
        </div>
        <Link
          href="/yi-future/national/admin"
          className="text-xs font-semibold text-navy hover:text-yi-gold"
        >
          &larr; Dashboard
        </Link>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Total delegates
          </div>
          <div className="mt-1 text-3xl font-bold text-navy">
            {totalDelegates}
          </div>
          <div className="mt-0.5 text-[11px] text-navy/50">
            {anyFiltered ? "matching filters" : "active"}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            In a team
          </div>
          <div className="mt-1 text-3xl font-bold text-navy">{withTeam}</div>
          <div className="mt-0.5 text-[11px] text-navy/50">
            {totalDelegates
              ? `${Math.round((withTeam / totalDelegates) * 100)}%`
              : "—"}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Without team
          </div>
          <div className="mt-1 text-3xl font-bold text-navy">
            {withoutTeam}
          </div>
          <div className="mt-0.5 text-[11px] text-navy/50">
            {totalDelegates
              ? `${Math.round((withoutTeam / totalDelegates) * 100)}%`
              : "—"}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Chapters
          </div>
          <div className="mt-1 text-3xl font-bold text-navy">
            {chaptersRepresented}
          </div>
          <div className="mt-0.5 text-[11px] text-navy/50">represented</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        {/* Region chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
            Region
          </span>
          <Link
            href={buildQuery(current, {
              region: "all",
              chapter: "all",
              college: "all",
            })}
            className={`min-h-[32px] inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
              region === "all"
                ? "border-navy bg-navy text-ivory"
                : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
            }`}
          >
            All ({grandTotal})
          </Link>
          {REGIONS.map((r) => {
            const count = countByRegion.get(r) ?? 0;
            const active = region === r;
            return (
              <Link
                key={r}
                href={buildQuery(current, {
                  region: r,
                  chapter: "all",
                  college: "all",
                })}
                className={`min-h-[32px] inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
                  active
                    ? "border-navy bg-navy text-ivory"
                    : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
                }`}
              >
                {r} ({count})
              </Link>
            );
          })}
        </div>

        {/* Chapter dropdown */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
              Chapter
            </span>
            <form
              method="get"
              action="/yi-future/national/admin/delegates"
              className="inline-flex items-center gap-2"
            >
              {region !== "all" && (
                <input type="hidden" name="region" value={region} />
              )}
              <select
                name="chapter"
                defaultValue={chapter}
                className="text-xs font-semibold px-2 py-1 rounded border border-navy/15 bg-white text-navy/70 min-w-[180px]"
              >
                <option value="all">All chapters</option>
                {chapters
                  .filter((c) => region === "all" || c.region === region)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.region ? `(${c.region})` : ""}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className="text-xs font-semibold px-2.5 py-1 rounded border border-navy/30 bg-white text-navy hover:bg-navy/5"
              >
                Apply
              </button>
            </form>
          </div>

          {/* College dropdown — options scoped to the current region/chapter */}
          {collegeOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
                College
              </span>
              <form
                method="get"
                action="/yi-future/national/admin/delegates"
                className="inline-flex items-center gap-2"
              >
                {region !== "all" && (
                  <input type="hidden" name="region" value={region} />
                )}
                {chapter !== "all" && (
                  <input type="hidden" name="chapter" value={chapter} />
                )}
                <select
                  name="college"
                  defaultValue={college}
                  className="text-xs font-semibold px-2 py-1 rounded border border-navy/15 bg-white text-navy/70 min-w-[220px] max-w-[320px]"
                >
                  <option value="all">
                    All colleges ({collegeOptions.length})
                  </option>
                  {collegeOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="text-xs font-semibold px-2.5 py-1 rounded border border-navy/30 bg-white text-navy hover:bg-navy/5"
                >
                  Apply
                </button>
              </form>
            </div>
          )}

          {anyFiltered && (
            <Link
              href="/yi-future/national/admin/delegates"
              className="text-xs font-semibold text-navy/50 hover:text-navy underline ml-auto"
            >
              Clear filters
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <ListSearchForm
        action="/yi-future/national/admin/delegates"
        q={q}
        placeholder="Search name, email, phone, chapter, college, access code…"
        hidden={searchHidden}
      />

      {/* Export — always reflects the filters currently applied above. */}
      {totalDelegates > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-navy/50">
            Export {totalDelegates.toLocaleString("en-IN")}{" "}
            {totalDelegates === 1 ? "delegate" : "delegates"} matching these
            filters:
          </span>
          <a
            href={buildExportHref(current, "xlsx")}
            className="text-xs font-semibold px-3 py-1.5 rounded border border-navy/30 bg-white text-navy hover:bg-navy/5"
          >
            ⬇ Excel
          </a>
          <a
            href={buildExportHref(current, "pdf")}
            className="text-xs font-semibold px-3 py-1.5 rounded border border-navy/30 bg-white text-navy hover:bg-navy/5"
          >
            ⬇ PDF
          </a>
          {totalDelegates > 2000 && (
            <span className="text-[11px] text-navy/40">
              PDF covers the first 2,000 by name — Excel has all{" "}
              {totalDelegates.toLocaleString("en-IN")}.
            </span>
          )}
        </div>
      )}

      {/* Table */}
      {totalDelegates === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-10 text-center">
          <div className="text-lg font-bold text-navy mb-2">
            No delegates found
          </div>
          <div className="text-sm text-navy/60 max-w-md mx-auto">
            {anyFiltered
              ? "No delegates match these filters."
              : "No active delegates have registered yet."}
          </div>
          {anyFiltered && (
            <Link
              href="/yi-future/national/admin/delegates"
              className="inline-block mt-4 text-xs font-semibold text-yi-gold hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">
                    Full Name
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold">
                    Email
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold">
                    Phone
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold">
                    Chapter
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold">
                    College / Course
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold">
                    Access Code
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold">Team</th>
                  <th className="text-left px-3 py-2.5 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((d) => {
                  const ch = d.chapters ?? chapterById.get(d.chapter_id);
                  const chapterName =
                    ch && "name" in ch ? ch.name : "—";
                  const teamName =
                    d.team_members &&
                    d.team_members.length > 0 &&
                    d.team_members[0]?.teams?.team_name
                      ? d.team_members[0].teams.team_name
                      : null;

                  return (
                    <tr
                      key={d.id}
                      className="border-t border-navy/5 hover:bg-navy/[0.015]"
                    >
                      <td className="px-3 py-2.5 font-semibold text-navy">
                        {d.full_name}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-navy/70">
                        {d.email ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-navy/70">
                        {d.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span>{d.phone}</span>
                            <WhatsAppIconButton
                              contact={{
                                phone: waPhone(d.phone),
                                name: d.full_name,
                              }}
                              defaultMessage={`Hi ${d.full_name.split(" ")[0]},\n\nThis is from Yi YUVA Future 6.0.\n\n`}
                            />
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-navy/80">
                        {chapterName}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-navy/70">
                        {d.colleges?.name ? (
                          <div className="leading-tight">
                            <div className="text-navy/80">
                              {d.colleges.name}
                            </div>
                            {d.course ? (
                              <div className="text-[11px] text-navy/45">
                                {d.course}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          d.course ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {d.access_code ? (
                          <code className="px-1.5 py-0.5 bg-navy/5 rounded font-mono text-xs">
                            {d.access_code}
                          </code>
                        ) : (
                          <span className="text-navy/30 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {teamName ? (
                          <span className="font-semibold text-navy">
                            {teamName}
                          </span>
                        ) : (
                          <span className="text-red-600/70 font-semibold">
                            no team
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            d.is_active
                              ? "bg-yi-green/10 text-yi-green"
                              : "bg-navy/5 text-navy/50"
                          }`}
                        >
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPager
            hrefForPage={(p) => buildQuery(current, { page: String(p) })}
            page={page}
            pageCount={pageCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            filteredCount={totalDelegates}
            total={grandTotal}
            noun="delegates"
          />
        </div>
      )}
    </div>
  );
}
