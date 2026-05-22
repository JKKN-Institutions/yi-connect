import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";

type Finalist = {
  team_id: string;
  from_event_id: string;
  total_score: number | null;
  rank: number | null;
  advanced_at: string | null;
  teams: {
    team_name: string;
    chapter_id: string | null;
    chapters: { name: string; city: string; finale_region: string | null } | null;
    problem_statements: { title: string } | null;
  } | null;
};

async function getFinalists(
  toEventId: string,
  hostFinaleRegion: string
): Promise<Finalist[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("advancements")
    .select(
      "team_id, from_event_id, total_score, rank, advanced_at, teams(team_name, chapter_id, chapters(name, city, finale_region), problem_statements(title))"
    )
    .eq("to_event_id", toEventId)
    .order("rank", { ascending: true });

  const all = (data as unknown as Finalist[]) ?? [];

  // Filter to only teams whose originating chapter shares this host's region.
  // This guards against cross-region advancements pointing at the wrong event.
  return all.filter(
    (f) => f.teams?.chapters?.finale_region === hostFinaleRegion
  );
}

async function getHostFinaleRegion(chapterId: string): Promise<string | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("finale_region")
    .eq("id", chapterId)
    .single();
  return (data as unknown as { finale_region: string | null } | null)
    ?.finale_region ?? null;
}

export default async function FinalistsPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost) redirect("/yi-future/host");
  if (!ctx.nationalEvent) redirect("/yi-future/host");

  const hostFinaleRegion = await getHostFinaleRegion(ctx.chapterId);
  if (!hostFinaleRegion) redirect("/yi-future/host");

  const finalists = await getFinalists(ctx.nationalEvent.id, hostFinaleRegion);

  // Group by chapter
  const byChapter = new Map<string, Finalist[]>();
  for (const f of finalists) {
    const c = f.teams?.chapters?.name ?? "Unknown";
    if (!byChapter.has(c)) byChapter.set(c, []);
    byChapter.get(c)!.push(f);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Finalists</h2>
        <p className="mt-1 text-sm text-navy/60">
          {finalists.length} team(s) advanced from chapters to{" "}
          <span className="inline-flex items-center gap-1">
            {ctx.trackIcon ?? "•"} {ctx.trackName}
          </span>{" "}
          National Track Final
        </p>
      </div>

      {finalists.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No finalists yet. Chapter admins publish their shortlists from{" "}
          <code className="px-1 py-0.5 rounded bg-navy/5 font-mono text-xs">
            /chapter/final/[id]
          </code>
          .
        </div>
      ) : (
        <div className="space-y-5">
          {[...byChapter.entries()].map(([chapterName, teams]) => (
            <section
              key={chapterName}
              className="bg-white border border-navy/10 rounded-lg overflow-hidden"
            >
              <div className="px-5 py-3 bg-navy/5">
                <h3 className="text-sm font-bold text-navy">
                  {chapterName}{" "}
                  <span className="text-xs font-normal text-navy/60">
                    · {teams.length} team(s)
                  </span>
                </h3>
              </div>
              <ul className="divide-y divide-navy/5">
                {teams.map((f) => (
                  <li
                    key={f.team_id}
                    className="px-5 py-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-navy">
                        {f.teams?.team_name ?? "(unnamed)"}
                        {f.rank && (
                          <span className="ml-2 text-[10px] font-mono text-navy/40">
                            chapter rank #{f.rank}
                          </span>
                        )}
                      </div>
                      {f.teams?.problem_statements?.title && (
                        <div className="text-xs text-navy/60 mt-0.5">
                          {f.teams.problem_statements.title}
                        </div>
                      )}
                      {f.teams?.chapters?.city && (
                        <div className="text-[10px] text-navy/40 mt-0.5">
                          {f.teams.chapters.city}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-navy">
                        {f.total_score ?? "—"}
                      </div>
                      <Link
                        href={`/chapter/teams/${f.team_id}`}
                        className="text-[10px] text-navy/50 hover:text-yi-gold"
                      >
                        view team →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
