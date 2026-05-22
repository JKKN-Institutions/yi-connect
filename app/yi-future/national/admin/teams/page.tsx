import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { TEAM_SIZE_MIN, TEAM_SIZE_MAX, TRACK_LABELS } from "@/lib/yi-future/constants";

type EditionRow = {
  id: string;
  name: string;
  slug: string;
};

type ChapterRow = {
  id: string;
  name: string;
  region: string | null;
};

type TeamRow = {
  id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  problem_statement_id: string | null;
  chapter_id: string;
  created_at: string | null;
  problem_statements:
    | {
        title: string;
        tracks: { slug: string; name: string; color_hex: string | null } | null;
      }
    | null;
  captain: { full_name: string } | null;
  team_members: { delegate_id: string }[];
};

const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;
const REGION_LABELS: Record<string, string> = {
  ER: "East",
  NER: "North-East",
  NR: "North",
  SRTKKA: "South (TN/KKA)",
  SRTN: "South (TN)",
  WR: "West",
};

const TRACK_CHIPS: { slug: string; name: string; color_hex: string }[] = [
  { slug: "climate_change", name: TRACK_LABELS.climate_change, color_hex: "#138808" },
  { slug: "road_safety", name: TRACK_LABELS.road_safety, color_hex: "#FF9933" },
  { slug: "accessibility", name: TRACK_LABELS.accessibility, color_hex: "#1a1a3e" },
  { slug: "public_health", name: TRACK_LABELS.public_health, color_hex: "#F5A623" },
];

const STATUS_OPTIONS = [
  "registered",
  "problem_selected",
  "phase_a_done",
  "phase_b_done",
  "phase_c_done",
  "shortlisted",
  "eliminated",
] as const;

const STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  problem_selected: "Problem Selected",
  phase_a_done: "Phase A Done",
  phase_b_done: "Phase B Done",
  phase_c_done: "Phase C Done",
  shortlisted: "Shortlisted",
  eliminated: "Eliminated",
};

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

async function getAllTeams(editionId: string): Promise<TeamRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, status, captain_id, problem_statement_id, chapter_id, created_at, problem_statements(title, tracks(slug, name, color_hex)), captain:delegates!teams_captain_id_fkey(full_name), team_members(delegate_id)"
    )
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as TeamRow[]) ?? [];
}

function buildQuery(
  current: { region: string; track: string; status: string; chapter: string },
  changes: Partial<{ region: string; track: string; status: string; chapter: string }>
): string {
  const merged = { ...current, ...changes };
  const parts: string[] = [];
  if (merged.region && merged.region !== "all") parts.push(`region=${encodeURIComponent(merged.region)}`);
  if (merged.track && merged.track !== "all") parts.push(`track=${encodeURIComponent(merged.track)}`);
  if (merged.status && merged.status !== "all") parts.push(`status=${encodeURIComponent(merged.status)}`);
  if (merged.chapter && merged.chapter !== "all") parts.push(`chapter=${encodeURIComponent(merged.chapter)}`);
  return parts.length ? `/national/admin/teams?${parts.join("&")}` : "/national/admin/teams";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

export default async function NationalTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{
    region?: string;
    track?: string;
    status?: string;
    chapter?: string;
  }>;
}) {
  const sp = await searchParams;
  const region = (sp.region ?? "all").trim() || "all";
  const track = (sp.track ?? "all").trim() || "all";
  const status = (sp.status ?? "all").trim() || "all";
  const chapter = (sp.chapter ?? "all").trim() || "all";
  const current = { region, track, status, chapter };

  const edition = await getActiveEdition();
  const chapters = await getAllChapters();

  if (!edition) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy">All Teams</h2>
          <p className="mt-1 text-sm text-navy/60">No active edition.</p>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No active edition is configured.{" "}
          <Link href="/yi-future/national/admin/editions" className="text-yi-gold font-semibold">
            Configure one
          </Link>
          .
        </div>
      </div>
    );
  }

  const allTeams = await getAllTeams(edition.id);
  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  // Apply filters
  const filtered = allTeams.filter((t) => {
    const ch = chapterById.get(t.chapter_id);
    if (region !== "all" && (ch?.region ?? "") !== region) return false;
    if (track !== "all" && t.problem_statements?.tracks?.slug !== track) return false;
    if (status !== "all" && (t.status ?? "registered") !== status) return false;
    if (chapter !== "all" && t.chapter_id !== chapter) return false;
    return true;
  });

  // KPI tiles — based on filtered set
  const totalTeams = filtered.length;
  const teamsWithCaptain = filtered.filter((t) => t.captain_id).length;
  const teamsWithProblem = filtered.filter((t) => t.problem_statement_id).length;
  const chaptersCovered = new Set(filtered.map((t) => t.chapter_id)).size;
  const tracksCovered = new Set(
    filtered.map((t) => t.problem_statements?.tracks?.slug).filter(Boolean)
  ).size;

  // Counts for chips (always based on full active-edition set, not double-filtered,
  // so users see how many teams exist per track/region globally)
  const teamCountByRegion = new Map<string, number>();
  const teamCountByTrack = new Map<string, number>();
  for (const t of allTeams) {
    const r = chapterById.get(t.chapter_id)?.region ?? "—";
    teamCountByRegion.set(r, (teamCountByRegion.get(r) ?? 0) + 1);
    const trSlug = t.problem_statements?.tracks?.slug;
    if (trSlug) teamCountByTrack.set(trSlug, (teamCountByTrack.get(trSlug) ?? 0) + 1);
  }

  const anyFiltered = region !== "all" || track !== "all" || status !== "all" || chapter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">All Teams</h2>
          <p className="mt-1 text-sm text-navy/60">
            National view across all chapters · {edition.name}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Teams" value={totalTeams} sub={anyFiltered ? "matching filters" : "across all chapters"} />
        <KPI
          label="With captain"
          value={teamsWithCaptain}
          sub={totalTeams ? `${Math.round((teamsWithCaptain / totalTeams) * 100)}%` : "—"}
        />
        <KPI
          label="Problem picked"
          value={teamsWithProblem}
          sub={totalTeams ? `${Math.round((teamsWithProblem / totalTeams) * 100)}%` : "—"}
        />
        <KPI label="Chapters" value={chaptersCovered} sub="with at least 1 team" />
        <KPI label="Tracks" value={tracksCovered} sub="covered" />
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        {/* Region chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
            Region
          </span>
          <Link
            href={buildQuery(current, { region: "all" })}
            className={`min-h-[32px] inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
              region === "all"
                ? "border-navy bg-navy text-ivory"
                : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
            }`}
          >
            All ({allTeams.length})
          </Link>
          {REGIONS.map((r) => {
            const count = teamCountByRegion.get(r) ?? 0;
            const active = region === r;
            return (
              <Link
                key={r}
                href={buildQuery(current, { region: r })}
                className={`min-h-[32px] inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
                  active
                    ? "border-navy bg-navy text-ivory"
                    : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
                }`}
                title={REGION_LABELS[r]}
              >
                {r} ({count})
              </Link>
            );
          })}
        </div>

        {/* Track chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
            Track
          </span>
          <Link
            href={buildQuery(current, { track: "all" })}
            className={`min-h-[32px] inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
              track === "all"
                ? "border-navy bg-navy text-ivory"
                : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
            }`}
          >
            All
          </Link>
          {TRACK_CHIPS.map((tr) => {
            const count = teamCountByTrack.get(tr.slug) ?? 0;
            const active = track === tr.slug;
            const color = tr.color_hex;
            return (
              <Link
                key={tr.slug}
                href={buildQuery(current, { track: tr.slug })}
                className="min-h-[32px] inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all"
                style={
                  active
                    ? { borderColor: color, backgroundColor: color, color: "#FEFCF6" }
                    : { borderColor: color + "33", backgroundColor: "#FFFFFF", color }
                }
              >
                {tr.name} ({count})
              </Link>
            );
          })}
        </div>

        {/* Status + Chapter dropdowns */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
              Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={buildQuery(current, { status: "all" })}
                className={`text-xs font-semibold px-2.5 py-1 rounded border ${
                  status === "all"
                    ? "border-navy bg-navy text-ivory"
                    : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
                }`}
              >
                All
              </Link>
              {STATUS_OPTIONS.map((s) => (
                <Link
                  key={s}
                  href={buildQuery(current, { status: s })}
                  className={`text-xs font-semibold px-2.5 py-1 rounded border ${
                    status === s
                      ? "border-navy bg-navy text-ivory"
                      : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-navy/40 w-16">
              Chapter
            </span>
            <form method="get" action="/national/admin/teams" className="inline-flex items-center gap-2">
              {region !== "all" && <input type="hidden" name="region" value={region} />}
              {track !== "all" && <input type="hidden" name="track" value={track} />}
              {status !== "all" && <input type="hidden" name="status" value={status} />}
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

          {anyFiltered && (
            <Link
              href="/yi-future/national/admin/teams"
              className="text-xs font-semibold text-navy/50 hover:text-navy underline ml-auto"
            >
              Clear all filters
            </Link>
          )}
        </div>
      </div>

      {/* Table or empty state */}
      {allTeams.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-10 text-center">
          <div className="text-3xl mb-3">⏳</div>
          <div className="text-lg font-bold text-navy mb-2">
            No teams formed yet
          </div>
          <div className="text-sm text-navy/60 max-w-md mx-auto">
            Chapters are still in registration. Teams appear here as soon as
            chapter admins begin forming them after delegates have registered.
          </div>
          <Link
            href="/yi-future/national/admin"
            className="inline-block mt-5 text-xs font-semibold text-yi-gold hover:underline"
          >
            ← Back to dashboard
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No teams match these filters.{" "}
          <Link href="/yi-future/national/admin/teams" className="text-yi-gold font-semibold">
            Clear filters
          </Link>
          .
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">Team</th>
                <th className="text-left px-3 py-2.5 font-semibold">Chapter</th>
                <th className="text-left px-3 py-2.5 font-semibold">Region</th>
                <th className="text-left px-3 py-2.5 font-semibold">Track</th>
                <th className="text-left px-3 py-2.5 font-semibold">Problem</th>
                <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                <th className="text-center px-3 py-2.5 font-semibold">Members</th>
                <th className="text-left px-3 py-2.5 font-semibold">Captain</th>
                <th className="text-left px-3 py-2.5 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const ch = chapterById.get(t.chapter_id);
                const trk = t.problem_statements?.tracks;
                const color = trk?.color_hex ?? "#1a1a3e";
                const size = t.team_members.length;
                const sizeOk = size >= TEAM_SIZE_MIN;
                const st = t.status ?? "registered";
                return (
                  <tr
                    key={t.id}
                    className="border-t border-navy/5 hover:bg-navy/[0.015]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-navy">
                        {t.team_name}
                      </div>
                      <div
                        className="text-[10px] text-navy/40 mt-0.5"
                        title="Chapter-side view requires chapter admin sign-in"
                      >
                        /chapter/teams/{t.id.slice(0, 8)}… ·{" "}
                        <span className="italic">chapter admin only</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-navy/80">
                      {ch?.name ?? (
                        <span className="text-navy/30">unknown</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-navy/50">
                        {ch?.region ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {trk ? (
                        <span
                          className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: color + "1a",
                            color,
                            border: `1px solid ${color}33`,
                          }}
                        >
                          {trk.name}
                        </span>
                      ) : (
                        <span className="text-navy/30 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-navy/70 max-w-[220px] truncate">
                      {t.problem_statements?.title ?? (
                        <span className="text-red-600/70 text-xs">not picked</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-navy/5 text-navy/70">
                        {STATUS_LABELS[st] ?? st}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          sizeOk
                            ? "bg-yi-green/10 text-yi-green"
                            : "bg-red-600/10 text-red-600/80"
                        }`}
                      >
                        {size}/{TEAM_SIZE_MAX}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-navy/80 text-xs">
                      {t.captain?.full_name ?? (
                        <span className="text-red-600/70">no captain</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-navy/60">
                      {fmtDate(t.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-navy">{value}</div>
      <div className="mt-0.5 text-[11px] text-navy/50">{sub}</div>
    </div>
  );
}
