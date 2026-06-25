import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { TRACK_LABELS } from "@/lib/yi-future/constants";
import { AutoRefresh } from "@/components/yi-future/AutoRefresh";

// Keep the installed PWA showing live data instead of a stale cached snapshot.
export const dynamic = "force-dynamic";

// ─── Types ──────────────────────────────────────────────────────────────────

type EditionRow = { id: string; name: string; slug: string };

type DelegateRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  college_id: string | null;
  chapter_id: string;
  preferred_track_slug: string | null;
  registered_at: string | null;
  email_verified_at: string | null;
};

type ChapterRow = {
  id: string;
  name: string;
  region: string | null;
};

type ChairRow = {
  chapter_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Data fetchers ──────────────────────────────────────────────────────────

async function getActiveEdition(): Promise<EditionRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug")
    .eq("is_active", true)
    .maybeSingle();
  return (data as EditionRow | null) ?? null;
}

async function getUnteamedDelegates(editionId: string): Promise<DelegateRow[]> {
  const svc = await createServiceClient();

  // Get all delegates in this edition. PostgREST caps a single response at
  // ~1000 rows; this edition already has 1100+ delegates, so a bare select
  // silently drops some — and any dropped delegate would be mis-classified as
  // teamed/unteamed here. Page through in full batches.
  const delegates = await fetchAllRows<DelegateRow>((from, to) =>
    svc
      .schema("future")
      .from("delegates")
      .select(
        "id, full_name, email, phone, whatsapp, college_id, chapter_id, preferred_track_slug, registered_at, email_verified_at"
      )
      .eq("edition_id", editionId)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: DelegateRow[] | null;
      error: unknown;
    }>
  );

  if (delegates.length === 0) return [];

  // Which delegates are already on a team. team_members has no edition column
  // and is small (a few hundred rows), so page the whole table rather than
  // filtering by a 1000+ id list (which would overflow the request URL).
  const teamMembers = await fetchAllRows<{ delegate_id: string }>((from, to) =>
    svc
      .schema("future")
      .from("team_members")
      .select("delegate_id")
      .order("delegate_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: { delegate_id: string }[] | null;
      error: unknown;
    }>
  );

  const teamedIds = new Set(teamMembers.map((tm) => tm.delegate_id));

  return delegates.filter((d) => !teamedIds.has(d.id));
}

async function getAllChapters(): Promise<ChapterRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region")
    .order("name", { ascending: true });
  return (data as ChapterRow[]) ?? [];
}

async function getChairs(editionId: string): Promise<ChairRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("chapter_id, full_name, email, phone")
    .eq("edition_id", editionId)
    .eq("role" as never, "chapter_chair" as never)
    .eq("is_active", true);
  return (data as ChairRow[]) ?? [];
}

async function getColleges(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name")
    .in("id", ids);
  const map = new Map<string, string>();
  for (const c of (data as { id: string; name: string }[] | null) ?? []) {
    map.set(c.id, c.name);
  }
  return map;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function UnteamedDelegatesPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; chapter?: string }>;
}) {
  const sp = await searchParams;
  const region = (sp.region ?? "all").trim() || "all";
  const chapter = (sp.chapter ?? "all").trim() || "all";

  const edition = await getActiveEdition();
  if (!edition) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy">Unteamed Delegates</h2>
          <p className="mt-1 text-sm text-navy/60">No active edition.</p>
        </div>
      </div>
    );
  }

  const [allUnteamed, chapters, chairs] = await Promise.all([
    getUnteamedDelegates(edition.id),
    getAllChapters(),
    getChairs(edition.id),
  ]);

  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const chairByChapter = new Map(chairs.map((c) => [c.chapter_id, c]));

  // Filter
  const filtered = allUnteamed.filter((d) => {
    const ch = chapterById.get(d.chapter_id);
    if (region !== "all" && (ch?.region ?? "") !== region) return false;
    if (chapter !== "all" && d.chapter_id !== chapter) return false;
    return true;
  });

  // College names
  const collegeIds = filtered.map((d) => d.college_id).filter(Boolean) as string[];
  const collegeNames = await getColleges(collegeIds);

  // Group by chapter
  const byChapter = new Map<string, DelegateRow[]>();
  for (const d of filtered) {
    const list = byChapter.get(d.chapter_id) ?? [];
    list.push(d);
    byChapter.set(d.chapter_id, list);
  }
  const groups = Array.from(byChapter.entries())
    .map(([chapId, dels]) => ({
      chapter: chapterById.get(chapId),
      delegates: dels,
    }))
    .filter((g) => g.chapter)
    .sort((a, b) =>
      (a.chapter!.name ?? "").localeCompare(b.chapter!.name ?? "")
    );

  // KPIs over filtered set
  const totalUnteamed = filtered.length;
  const chaptersWithUnteamed = byChapter.size;
  const unverifiedEmails = filtered.filter((d) => !d.email_verified_at).length;

  // Region counts (full set, not double-filtered)
  const countByRegion = new Map<string, number>();
  for (const d of allUnteamed) {
    const r = chapterById.get(d.chapter_id)?.region ?? "—";
    countByRegion.set(r, (countByRegion.get(r) ?? 0) + 1);
  }

  function buildQuery(changes: Partial<{ region: string; chapter: string }>): string {
    const merged = { region, chapter, ...changes };
    const parts: string[] = [];
    if (merged.region && merged.region !== "all") parts.push(`region=${encodeURIComponent(merged.region)}`);
    if (merged.chapter && merged.chapter !== "all") parts.push(`chapter=${encodeURIComponent(merged.chapter)}`);
    return parts.length
      ? `/yi-future/national/admin/delegates/unteamed?${parts.join("&")}`
      : "/yi-future/national/admin/delegates/unteamed";
  }
  const anyFiltered = region !== "all" || chapter !== "all";

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={30000} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Unteamed Delegates</h2>
          <p className="mt-1 text-sm text-navy/60">
            Registered but not yet in a team · {edition.name}
          </p>
        </div>
        <Link
          href="/yi-future/national/admin"
          className="text-xs font-semibold text-navy hover:text-yi-gold"
        >
          ← Dashboard
        </Link>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Unteamed delegates
          </div>
          <div className="mt-1 text-3xl font-bold text-navy">{totalUnteamed}</div>
          <div className="mt-0.5 text-[11px] text-navy/50">
            {anyFiltered ? "matching filters" : "across all chapters"}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Chapters affected
          </div>
          <div className="mt-1 text-3xl font-bold text-navy">{chaptersWithUnteamed}</div>
          <div className="mt-0.5 text-[11px] text-navy/50">with at least 1 unteamed</div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Email unverified
          </div>
          <div className="mt-1 text-3xl font-bold text-navy">{unverifiedEmails}</div>
          <div className="mt-0.5 text-[11px] text-navy/50">may not have completed signup</div>
        </div>
      </div>

      {/* Region filter chips */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
            Region
          </span>
          <Link
            href={buildQuery({ region: "all" })}
            className={`min-h-[32px] inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
              region === "all"
                ? "border-navy bg-navy text-ivory"
                : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
            }`}
          >
            All ({allUnteamed.length})
          </Link>
          {REGIONS.map((r) => {
            const count = countByRegion.get(r) ?? 0;
            const active = region === r;
            return (
              <Link
                key={r}
                href={buildQuery({ region: r })}
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
          {anyFiltered && (
            <Link
              href="/yi-future/national/admin/delegates/unteamed"
              className="text-xs font-semibold text-navy/50 hover:text-navy underline ml-auto"
            >
              Clear filters
            </Link>
          )}
        </div>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-10 text-center">
          <div className="text-3xl mb-3">🎉</div>
          <div className="text-lg font-bold text-navy mb-2">
            No unteamed delegates
          </div>
          <div className="text-sm text-navy/60 max-w-md mx-auto">
            Every registered delegate {anyFiltered ? "matching these filters " : ""}is in a team.
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const ch = g.chapter!;
            const chair = chairByChapter.get(ch.id);
            return (
              <div
                key={ch.id}
                className="bg-white border border-navy/10 rounded-lg overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-navy/10 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-navy">
                      {ch.name}{" "}
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-navy/50">
                        {ch.region ?? "—"}
                      </span>
                    </div>
                    <div className="text-xs text-navy/60 mt-0.5">
                      {g.delegates.length} delegate{g.delegates.length === 1 ? "" : "s"} without a team
                    </div>
                  </div>
                  {chair && (
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-navy/40">
                        Chair (to nudge)
                      </div>
                      <div className="text-xs font-semibold text-navy">
                        {chair.full_name}
                      </div>
                      <div className="text-[11px] text-navy/60">
                        {chair.email ?? "—"} · {chair.phone ?? "—"}
                      </div>
                    </div>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-navy/5 text-navy/70">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Name</th>
                      <th className="text-left px-3 py-2 font-semibold">Email / Phone</th>
                      <th className="text-left px-3 py-2 font-semibold">College</th>
                      <th className="text-left px-3 py-2 font-semibold">Preferred Track</th>
                      <th className="text-left px-3 py-2 font-semibold">Registered</th>
                      <th className="text-left px-3 py-2 font-semibold">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.delegates.map((d) => {
                      const tlabel = d.preferred_track_slug
                        ? TRACK_LABELS[d.preferred_track_slug as keyof typeof TRACK_LABELS] ?? d.preferred_track_slug
                        : null;
                      return (
                        <tr key={d.id} className="border-t border-navy/5">
                          <td className="px-3 py-2 font-semibold text-navy">
                            {d.full_name}
                          </td>
                          <td className="px-3 py-2 text-xs text-navy/70">
                            <div>{d.email ?? "—"}</div>
                            <div className="text-navy/50">{d.phone ?? d.whatsapp ?? "—"}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-navy/70">
                            {d.college_id ? collegeNames.get(d.college_id) ?? "—" : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-navy/70">
                            {tlabel ?? <span className="text-navy/30">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-navy/60">
                            {fmtDate(d.registered_at)}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {d.email_verified_at ? (
                              <span className="text-yi-green font-semibold">✓ verified</span>
                            ) : (
                              <span className="text-red-600/70 font-semibold">unverified</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
