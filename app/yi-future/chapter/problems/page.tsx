import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { TrackIcon } from "@/components/yi-future/TrackIcon";

type Problem = {
  id: string;
  title: string;
  short_description: string;
  full_description: string | null;
  display_order: number | null;
  sdg_alignment: string[] | null;
  tracks: { name: string; icon: string | null; color_hex: string | null } | null;
};

type TeamCount = {
  problem_statement_id: string;
  count: number;
};

async function getProblems(
  chapterId: string,
  editionId: string
): Promise<{ problems: Problem[]; teamCounts: Map<string, number> }> {
  const svc = await createServiceClient();

  const { data: assign } = await svc
    .schema("future")
    .from("chapter_track_assignments")
    .select("track_id")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .maybeSingle();
  const trackId = (assign as { track_id: string } | null)?.track_id ?? null;

  let q = svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, title, short_description, full_description, display_order, sdg_alignment, tracks!inner(edition_id, name, icon, color_hex)"
    )
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId);
  if (trackId) q = q.eq("tracks.id", trackId);
  const { data } = await q.order("display_order", { ascending: true });
  const problems = (data as unknown as Problem[]) ?? [];

  const { data: teams } = await svc
    .schema("future")
    .from("teams")
    .select("problem_statement_id")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .not("problem_statement_id", "is", null);

  const counts = new Map<string, number>();
  for (const t of (teams ?? []) as { problem_statement_id: string }[]) {
    counts.set(t.problem_statement_id, (counts.get(t.problem_statement_id) ?? 0) + 1);
  }

  return { problems, teamCounts: counts };
}

export default async function ChapterProblemsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { problems, teamCounts } = await getProblems(ctx.chapterId, ctx.editionId);
  const totalTeams = Array.from(teamCounts.values()).reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Problem Statements</h2>
        <p className="mt-1 text-sm text-navy/60">
          {problems.length} problems available · {totalTeams} team{totalTeams !== 1 ? "s" : ""} have picked
        </p>
      </div>

      <div className="space-y-4">
        {problems.map((p) => {
          const count = teamCounts.get(p.id) ?? 0;
          return (
            <div
              key={p.id}
              className="bg-white border border-navy/10 rounded-lg overflow-hidden"
            >
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {p.tracks && (
                      <TrackIcon
                        icon={p.tracks.icon}
                        name={p.tracks.name}
                        size={32}
                        className="shrink-0 mt-0.5"
                      />
                    )}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: p.tracks?.color_hex ?? "#1a1a3e" }}>
                        {p.tracks?.name ?? "—"}
                      </div>
                      <h3 className="font-bold text-navy text-lg mt-0.5">
                        {p.title}
                      </h3>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-extrabold text-navy">
                      {count}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
                      team{count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm text-navy/70">
                  {p.short_description}
                </p>

                {p.full_description && (
                  <details className="mt-3">
                    <summary className="text-xs font-semibold text-[#F5A623] cursor-pointer hover:text-[#F5A623]/80">
                      Read full description
                    </summary>
                    <div className="mt-2 p-4 rounded-lg bg-navy/5 text-sm text-navy/80 whitespace-pre-wrap leading-relaxed">
                      {p.full_description}
                    </div>
                  </details>
                )}

                {p.sdg_alignment && p.sdg_alignment.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.sdg_alignment.map((sdg) => (
                      <span
                        key={sdg}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yi-green/10 text-yi-green"
                      >
                        {sdg}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {count > 0 && (
                <div className="px-5 py-2 border-t border-navy/5 bg-navy/5">
                  <div className="text-xs text-navy/50">
                    {count} team{count !== 1 ? "s" : ""} working on this problem in your chapter
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {problems.length === 0 && (
          <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50 italic">
            No problem statements available yet. Check back after track assignments are configured.
          </div>
        )}
      </div>
    </div>
  );
}
