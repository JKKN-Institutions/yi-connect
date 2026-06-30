import Link from "next/link";
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
  tracks: {
    id: string;
    name: string;
    icon: string | null;
    color_hex: string | null;
    display_order: number | null;
  } | null;
};

type TrackBucket = {
  id: string;
  name: string;
  icon: string | null;
  colorHex: string;
  displayOrder: number;
  items: Problem[];
};

// Future 6.0 runs all 4 tracks at every chapter, so this read-only admin list
// shows the full edition catalog (12 problems) — NOT a single-track subset.
async function getProblems(
  chapterId: string,
  editionId: string
): Promise<{ problems: Problem[]; teamCounts: Map<string, number> }> {
  const svc = await createServiceClient();

  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, title, short_description, full_description, display_order, sdg_alignment, tracks!inner(id, name, icon, color_hex, display_order, edition_id)"
    )
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId)
    .order("display_order", { ascending: true });
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

// Group the flat problem list into track buckets ordered by track display_order,
// with problems inside each bucket ordered by their own display_order.
function bucketByTrack(problems: Problem[]): TrackBucket[] {
  const tracksMap = new Map<string, TrackBucket>();
  for (const p of problems) {
    if (!p.tracks) continue;
    const key = p.tracks.id;
    if (!tracksMap.has(key)) {
      tracksMap.set(key, {
        id: p.tracks.id,
        name: p.tracks.name,
        icon: p.tracks.icon,
        colorHex: p.tracks.color_hex ?? "#1a1a3e",
        displayOrder: p.tracks.display_order ?? 0,
        items: [],
      });
    }
    tracksMap.get(key)!.items.push(p);
  }
  const buckets = Array.from(tracksMap.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  for (const tr of buckets) {
    tr.items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }
  return buckets;
}

export default async function ChapterProblemsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { problems, teamCounts } = await getProblems(ctx.chapterId, ctx.editionId);
  const trackBuckets = bucketByTrack(problems);
  const totalTeams = Array.from(teamCounts.values()).reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Problem Statements</h2>
        <p className="mt-1 text-sm text-navy/60">
          {problems.length} problems available · {totalTeams} team{totalTeams !== 1 ? "s" : ""} have picked
        </p>
      </div>

      <div className="space-y-8">
        {trackBuckets.map((tr) => (
          <section key={tr.id} className="space-y-3">
            <div
              className="flex items-center gap-2 border-l-4 pl-3 py-1"
              style={{ borderLeftColor: tr.colorHex }}
            >
              <TrackIcon
                icon={tr.icon}
                name={tr.name}
                size={28}
                className="shrink-0"
              />
              <h3
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: tr.colorHex }}
              >
                {tr.name}
              </h3>
            </div>

            {tr.items.map((p) => {
              const count = teamCounts.get(p.id) ?? 0;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-navy/10 rounded-lg overflow-hidden"
                >
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-navy text-lg">
                        {p.title}
                      </h3>
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

                  <Link
                    href={`/yi-future/chapter/problems/${p.id}`}
                    className="flex items-center justify-between px-5 py-2.5 border-t border-navy/5 bg-navy/5 hover:bg-navy/10 transition-colors"
                  >
                    <span className="text-xs text-navy/60">
                      {count > 0
                        ? `${count} team${count !== 1 ? "s" : ""} in your chapter`
                        : "No teams yet"}
                    </span>
                    <span className="text-xs font-semibold text-[#F5A623]">
                      View teams &amp; delegates →
                    </span>
                  </Link>
                </div>
              );
            })}
          </section>
        ))}

        {problems.length === 0 && (
          <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50 italic">
            No problem statements available yet. Check back after track assignments are configured.
          </div>
        )}
      </div>
    </div>
  );
}
