import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { computeChapterResults } from "@/app/yi-future/actions/shortlist";

type Advancement = {
  team_id: string;
  rank: number | null;
  total_score: number | null;
  advanced_at: string | null;
  to_event_id: string;
  from_event_id: string;
};

async function getDefaultThreshold(editionId: string): Promise<number | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("rubrics")
    .select("threshold_for_national")
    .eq("edition_id", editionId)
    .eq("scope", "chapter_final")
    .eq("is_default", true)
    .maybeSingle();
  return (data as { threshold_for_national: number | null } | null)
    ?.threshold_for_national ?? null;
}

async function getAdvancements(
  chapterId: string,
  editionId: string
): Promise<Advancement[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("advancements")
    .select(
      "team_id, rank, total_score, advanced_at, to_event_id, from_event_id, teams!inner(chapter_id, edition_id)"
    )
    .eq("teams.chapter_id", chapterId)
    .eq("teams.edition_id", editionId);
  return (data as unknown as Advancement[]) ?? [];
}

export default async function ChapterResultsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const threshold = await getDefaultThreshold(ctx.editionId);
  const [results, advancements] = await Promise.all([
    computeChapterResults(ctx.chapterId, ctx.editionId, threshold),
    getAdvancements(ctx.chapterId, ctx.editionId),
  ]);

  const advancedIds = new Set(advancements.map((a) => a.team_id));
  const sorted = [...results].sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Results</h2>
        <p className="mt-1 text-sm text-navy/60">
          Aggregated scores · threshold for nationals:{" "}
          <strong>{threshold ?? "—"}</strong>
        </p>
      </div>

      {advancements.length > 0 ? (
        <div className="bg-yi-green/5 border border-yi-green/30 rounded-lg p-4 text-sm">
          <div className="font-bold text-yi-green mb-1">
            ✓ {advancements.length} team(s) advanced to nationals
          </div>
          <p className="text-xs text-navy/60">
            Shortlist published. Consent collection required before travel.
          </p>
        </div>
      ) : (
        <div className="bg-navy/5 border border-navy/10 rounded-lg p-4 text-sm text-navy/60">
          No shortlist published yet. Go to your chapter final event to
          publish one.
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Rank</th>
              <th className="text-left px-4 py-3 font-semibold">Team</th>
              <th className="text-left px-4 py-3 font-semibold">Problem</th>
              <th className="text-right px-4 py-3 font-semibold">Jurors</th>
              <th className="text-right px-4 py-3 font-semibold">Average</th>
              <th className="text-right px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-navy/40"
                >
                  No evaluations yet.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.team_id} className="border-t border-navy/5">
                  <td className="px-4 py-3 font-mono font-bold">
                    {r.rank ? `#${r.rank}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.team_name}</td>
                  <td className="px-4 py-3 text-xs text-navy/60 truncate max-w-[200px]">
                    {r.problem_title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.jurors_count}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {r.jurors_count > 0 ? r.average_total : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {advancedIds.has(r.team_id) ? (
                      <span className="text-xs font-semibold text-yi-green">
                        → Advanced
                      </span>
                    ) : r.clears ? (
                      <span className="text-xs font-semibold text-yi-gold">
                        Clears
                      </span>
                    ) : r.jurors_count > 0 ? (
                      <span className="text-xs text-navy/40">Below</span>
                    ) : (
                      <span className="text-xs text-navy/30">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-navy/40">
        <Link href="/yi-future/chapter/scoring" className="underline hover:text-navy">
          Per-juror scoring breakdown →
        </Link>
      </p>
    </div>
  );
}
