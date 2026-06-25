import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { WhatsAppIconButton } from "@/components/whatsapp";
import { fetchAllRows } from "@/lib/pagination";
import { AutoRefresh } from "@/components/yi-future/AutoRefresh";

// PostgREST caps a single response at ~1000 rows, so this list must page through
// in full (see getAllDelegates) or it freezes at ~1003 while registrations keep
// coming in. force-dynamic + <AutoRefresh> keep the installed PWA showing live data.
export const dynamic = "force-dynamic";

// Normalize an Indian mobile number to a country-code-prefixed digit string.
function waPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.startsWith("91") ? digits : "91" + digits;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type DelegateRow = {
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
  team_members: { teams: { team_name: string } | null }[];
};

type ChapterRow = {
  id: string;
  name: string;
  region: string | null;
};

const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;

// ─── Data fetchers ──────────────────────────────────────────────────────────

async function getAllDelegates(): Promise<DelegateRow[]> {
  const svc = await createServiceClient();
  // Page through in full — a bare select caps at ~1000 rows and silently drops
  // newer registrations (this is what froze the count at 1003). Order by id for
  // stable paging, then sort by name for display.
  const all = await fetchAllRows<DelegateRow>((from, to) =>
    svc
      .schema("future")
      .from("delegates")
      .select(
        "id, full_name, email, phone, access_code, is_active, course, chapter_id, college_id, chapters(name), colleges(name), team_members(teams(team_name))"
      )
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: DelegateRow[] | null;
      error: unknown;
    }>
  );
  all.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return all;
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
  current: { region: string; chapter: string; college: string },
  changes: Partial<{ region: string; chapter: string; college: string }>
): string {
  const merged = { ...current, ...changes };
  const parts: string[] = [];
  if (merged.region && merged.region !== "all")
    parts.push(`region=${encodeURIComponent(merged.region)}`);
  if (merged.chapter && merged.chapter !== "all")
    parts.push(`chapter=${encodeURIComponent(merged.chapter)}`);
  if (merged.college && merged.college !== "all")
    parts.push(`college=${encodeURIComponent(merged.college)}`);
  return parts.length
    ? `/yi-future/national/admin/delegates?${parts.join("&")}`
    : "/yi-future/national/admin/delegates";
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AllDelegatesPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; chapter?: string; college?: string }>;
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
  const current = { region, chapter, college };

  const [allDelegates, chapters] = await Promise.all([
    getAllDelegates(),
    getAllChapters(),
  ]);

  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  // Delegates scoped by region + chapter only — this drives the college
  // dropdown so it lists just the colleges relevant to the current view.
  const inRegionChapter = allDelegates.filter((d) => {
    const ch = chapterById.get(d.chapter_id);
    if (region !== "all" && (ch?.region ?? "") !== region) return false;
    if (chapter !== "all" && d.chapter_id !== chapter) return false;
    return true;
  });

  const collegeOptionsMap = new Map<string, string>();
  for (const d of inRegionChapter) {
    if (d.college_id && d.colleges?.name)
      collegeOptionsMap.set(d.college_id, d.colleges.name);
  }
  const collegeOptions = [...collegeOptionsMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Final list — region + chapter + college.
  const filtered = inRegionChapter.filter((d) => {
    if (college !== "all" && d.college_id !== college) return false;
    return true;
  });

  // Region counts (full set, not double-filtered)
  const countByRegion = new Map<string, number>();
  for (const d of allDelegates) {
    const r = chapterById.get(d.chapter_id)?.region ?? "—";
    countByRegion.set(r, (countByRegion.get(r) ?? 0) + 1);
  }

  const anyFiltered =
    region !== "all" || chapter !== "all" || college !== "all";

  // KPIs
  const totalDelegates = filtered.length;
  const withTeam = filtered.filter(
    (d) => d.team_members && d.team_members.length > 0
  ).length;
  const withoutTeam = totalDelegates - withTeam;
  const chaptersRepresented = new Set(filtered.map((d) => d.chapter_id)).size;

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
            All ({allDelegates.length})
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

      {/* Table */}
      {filtered.length === 0 ? (
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
                {filtered.map((d) => {
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
        </div>
      )}
    </div>
  );
}
