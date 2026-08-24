import { createServiceClient } from "@/lib/yiq/supabase/server";
import { finalsTotal } from "@/lib/yiq/scoring";

/**
 * The projector scoreboard. Public by design — it goes on the LED wall behind
 * the stage (deck slide 13), so it must render with no login and no chrome.
 * force-dynamic because it is a live surface: a cached scoreboard is a wrong
 * scoreboard.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";

export default async function LiveScoreboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { eventId } = await params;
  const { category: catParam } = await searchParams;
  const category = catParam === "senior" ? "senior" : "junior";

  const svc = await createServiceClient();

  const { data: event } = await svc
    .from("chapter_events")
    .select("id, chapter_name")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return (
      <main
        id="yiq-main"
        className="grid min-h-screen place-items-center"
        style={{ background: INK, color: PAPER }}
      >
        <p className="yiq-display text-[2rem]">No such event</p>
      </main>
    );
  }

  const { data: rounds } = await svc
    .from("finals_rounds")
    .select("id, name, round_number, status")
    .eq("chapter_event_id", eventId)
    .eq("category", category)
    .order("display_order");

  const roundIds = (rounds ?? []).map((r) => r.id);

  const { data: allScores } = roundIds.length
    ? await svc
        .from("finals_scores")
        .select("team_id, points")
        .in("finals_round_id", roundIds)
    : { data: [] as { team_id: string; points: number }[] };

  const { data: teams } = await svc
    .from("teams")
    .select("id, name, schools(name)")
    .eq("chapter_event_id", eventId)
    .eq("category", category)
    .in("status", ["qualified", "champion", "runner_up", "eliminated"]);

  const pointsByTeam = new Map<string, number[]>();
  for (const s of allScores ?? []) {
    const list = pointsByTeam.get(s.team_id) ?? [];
    list.push(Number(s.points));
    pointsByTeam.set(s.team_id, list);
  }

  const board = (teams ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      school: (t.schools as { name: string } | null)?.name ?? "",
      total: finalsTotal(pointsByTeam.get(t.id) ?? []),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const liveRound = (rounds ?? []).find((r) => r.status === "live");
  const leader = board[0]?.total ?? 0;

  return (
    <main id="yiq-main" className="min-h-screen px-6 py-8" style={{ background: INK, color: PAPER }}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
            YIQ Chapter Finals · {event.chapter_name}
          </p>
          <h1 className="yiq-display mt-1 text-[3rem] sm:text-[4rem]">
            {category === "junior" ? "Junior" : "Senior"}
          </h1>
        </div>
        {liveRound ? (
          <div className="text-right">
            <p className="yiq-eyebrow" style={{ color: DIM }}>
              Now playing
            </p>
            <p className="yiq-display text-[1.75rem]" style={{ color: SAFFRON }}>
              R{liveRound.round_number} · {liveRound.name}
            </p>
          </div>
        ) : null}
      </header>

      {board.length === 0 ? (
        <p className="mt-16 text-center text-[1.25rem]" style={{ color: DIM }}>
          Waiting for the qualifying teams.
        </p>
      ) : (
        <ol className="mt-10 grid gap-2.5">
          {board.map((t, i) => {
            const pct = leader > 0 ? (t.total / leader) * 100 : 0;
            return (
              <li
                key={t.id}
                className="relative overflow-hidden rounded-2xl px-5 py-4"
                style={{ background: i === 0 ? "rgba(232,163,61,0.16)" : "rgba(247,244,237,0.05)" }}
              >
                <div
                  aria-hidden
                  className="absolute inset-y-0 left-0 transition-[width] duration-500"
                  style={{
                    width: `${pct}%`,
                    background: i === 0 ? "rgba(232,163,61,0.18)" : "rgba(247,244,237,0.05)",
                  }}
                />
                <div className="relative flex items-center gap-5">
                  <span
                    className="yiq-data grid h-11 w-11 flex-none place-items-center rounded-xl text-[1.125rem] font-bold"
                    style={
                      i === 0
                        ? { background: SAFFRON, color: INK }
                        : { background: "rgba(247,244,237,0.1)", color: PAPER }
                    }
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.375rem] font-bold">{t.name}</p>
                    {t.school ? (
                      <p className="truncate text-[0.875rem]" style={{ color: DIM }}>
                        {t.school}
                      </p>
                    ) : null}
                  </div>
                  <span className="yiq-data text-[2.25rem] font-bold tabular-nums">
                    {t.total}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
