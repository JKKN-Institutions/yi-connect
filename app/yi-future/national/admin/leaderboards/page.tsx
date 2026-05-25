import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  getInstitutionLeaderboard,
  getChapterLeaderboard,
  getProblemStatementLeaderboard,
  getTrackLeaderboard,
  getCompositeLeaderboard,
  type LeaderboardRow,
} from "@/app/yi-future/actions/leaderboards";

type Edition = { id: string; name: string; is_active: boolean | null };

type Tab = "institutions" | "chapters" | "problems" | "tracks" | "composite";

const TABS: { key: Tab; label: string }[] = [
  { key: "institutions", label: "Institutions" },
  { key: "chapters", label: "Chapters" },
  { key: "problems", label: "Problem Statements" },
  { key: "tracks", label: "Tracks" },
  { key: "composite", label: "Composite" },
];

async function loadEditions(): Promise<Edition[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, is_active")
    .order("kickoff_date", { ascending: false });
  return (data as unknown as Edition[]) ?? [];
}

function csvHref(rows: LeaderboardRow[], filename: string): string {
  const header = "rank,label,score,meta";
  const body = rows
    .map(
      (r) =>
        `${r.rank},"${r.label.replace(/"/g, '""')}",${r.score},"${(r.meta ?? "").replace(/"/g, '""')}"`
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  return (
    "data:text/csv;charset=utf-8," + encodeURIComponent(csv) + `#${filename}`
  );
}

function rankColor(rank: number): string {
  if (rank === 1) return "bg-yi-gold/15 border-yi-gold/40";
  if (rank === 2) return "bg-yi-saffron/10 border-yi-saffron/40";
  if (rank === 3) return "bg-yi-green/10 border-yi-green/40";
  return "bg-white border-navy/10";
}

export default async function NationalLeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edition?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab =
    sp.tab === "chapters"
      ? "chapters"
      : sp.tab === "problems"
        ? "problems"
        : sp.tab === "tracks"
          ? "tracks"
          : sp.tab === "composite"
            ? "composite"
            : "institutions";

  const editions = await loadEditions();
  const selected =
    editions.find((e) => e.id === sp.edition) ??
    editions.find((e) => e.is_active) ??
    editions[0];

  if (!selected) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <h2 className="text-lg font-bold text-navy">No editions yet</h2>
        <p className="mt-2 text-sm text-navy/60">
          Create an edition before viewing leaderboards.
        </p>
      </div>
    );
  }

  let rows: LeaderboardRow[] = [];
  let csvName = "";
  switch (tab) {
    case "institutions":
      rows = await getInstitutionLeaderboard(selected.id);
      csvName = "institutions.csv";
      break;
    case "chapters":
      rows = await getChapterLeaderboard(selected.id);
      csvName = "chapters.csv";
      break;
    case "problems":
      rows = await getProblemStatementLeaderboard(selected.id);
      csvName = "problem-statements.csv";
      break;
    case "tracks":
      rows = await getTrackLeaderboard(selected.id);
      csvName = "tracks.csv";
      break;
    case "composite":
      rows = await getCompositeLeaderboard(selected.id);
      csvName = "composite.csv";
      break;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Leaderboards</h2>
        <p className="mt-1 text-sm text-navy/60">
          {selected.name} · 5 levels · CSV export
        </p>
      </div>

      {/* Edition switcher */}
      {editions.length > 1 && (
        <form className="flex items-center gap-2">
          <label
            htmlFor="edition"
            className="text-xs uppercase tracking-widest text-navy/60"
          >
            Edition
          </label>
          <select
            id="edition"
            name="edition"
            defaultValue={selected.id}
            className="px-3 py-1.5 border border-navy/20 rounded-md text-sm"
          >
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.is_active ? " (active)" : ""}
              </option>
            ))}
          </select>
          <input type="hidden" name="tab" value={tab} />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm font-semibold rounded-md border border-navy/20 hover:border-navy/40"
          >
            Switch
          </button>
        </form>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-navy/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/national/admin/leaderboards?tab=${t.key}&edition=${selected.id}`}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === t.key
                ? "border-navy text-navy"
                : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-navy/60">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </div>
        <a
          href={csvHref(rows, csvName)}
          download={csvName}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-navy/20 hover:border-navy/40 text-navy"
        >
          Download CSV
        </a>
      </div>

      {/* Table */}
      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold w-16">Rank</th>
              <th className="text-left px-4 py-3 font-semibold">
                {tab === "institutions"
                  ? "Institution"
                  : tab === "chapters"
                    ? "Chapter"
                    : tab === "problems"
                      ? "Problem · Team"
                      : tab === "composite"
                        ? "Team"
                        : "Track · Team"}
              </th>
              <th className="text-left px-4 py-3 font-semibold">Detail</th>
              <th className="text-right px-4 py-3 font-semibold w-24">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-navy/40"
                >
                  No data yet — scores will appear once jurors submit
                  evaluations.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr
                  key={`${idx}-${r.label}`}
                  className={`border-t border-navy/5 ${rankColor(r.rank)}`}
                >
                  <td className="px-4 py-3 font-mono font-bold text-navy">
                    #{r.rank}
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.label}</td>
                  <td className="px-4 py-3 text-xs text-navy/60">{r.meta}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {r.score}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-navy/40">
        Rankings recompute on every page load from submitted evaluations only.
        Tied scores share rank.
      </p>
    </div>
  );
}
