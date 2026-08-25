import Link from "next/link";
import { getYiqEventAccess } from "@/lib/yiq/auth/event-access";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { finalsTotal } from "@/lib/yiq/scoring";
import { Forbidden403 } from "@/app/yiq/_components/Forbidden403";
import { FinalsConsole } from "./finals-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter finals" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function FinalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { eventId } = await params;
  const { category: catParam } = await searchParams;
  const category = catParam === "senior" ? "senior" : "junior";

  const access = await getYiqEventAccess(eventId);
  if (!access.canView) {
    return <Forbidden403 what="this chapter's finals console" reason={access.reason} />;
  }

  const svc = await createServiceClient();

  const { data: event } = await svc
    .from("chapter_events")
    .select("id, chapter_name, champion_team_junior_id, champion_team_senior_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return <Forbidden403 what="this chapter's finals console" reason="event_not_found" />;
  }

  const { data: rounds } = await svc
    .from("finals_rounds")
    .select("id, name, round_number, round_type, status, points_correct, points_pass_bonus, time_limit_seconds")
    .eq("chapter_event_id", eventId)
    .eq("category", category)
    .order("display_order");

  // Only teams that actually qualified from the online round take the stage.
  const { data: teams } = await svc
    .from("teams")
    .select("id, name, online_rank, status, schools(name)")
    .eq("chapter_event_id", eventId)
    .eq("category", category)
    .in("status", ["qualified", "champion", "runner_up"])
    .order("online_rank");

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: scores } = roundIds.length
    ? await svc
        .from("finals_scores")
        .select("team_id, points, finals_round_id")
        .in("finals_round_id", roundIds)
    : { data: [] as { team_id: string; points: number; finals_round_id: string }[] };

  const totals = new Map<string, number[]>();
  for (const s of scores ?? []) {
    const list = totals.get(s.team_id) ?? [];
    list.push(Number(s.points));
    totals.set(s.team_id, list);
  }

  const board = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    school: (t.schools as { name: string } | null)?.name ?? "",
    onlineRank: t.online_rank,
    total: finalsTotal(totals.get(t.id) ?? []),
  }));

  const championId =
    category === "junior"
      ? event.champion_team_junior_id
      : event.champion_team_senior_id;

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href={`/yiq/dashboard/${eventId}`} className="text-[0.875rem]" style={{ color: DIM }}>
            ← {event.chapter_name}
          </Link>
          <div className="flex items-center gap-2">
            {(["junior", "senior"] as const).map((c) => (
              <Link
                key={c}
                href={`/yiq/dashboard/${eventId}/finals?category=${c}`}
                className="yiq-eyebrow rounded-full px-3 py-1.5"
                style={
                  c === category
                    ? { background: SAFFRON, color: INK }
                    : { background: "rgba(247,244,237,0.08)", color: DIM }
                }
              >
                {c === "junior" ? "Junior" : "Senior"}
              </Link>
            ))}
            <Link
              href={`/yiq/live/${eventId}?category=${category}`}
              target="_blank"
              className="yiq-eyebrow rounded-full border px-3 py-1.5"
              style={{ borderColor: RULE, color: PAPER }}
            >
              Open scoreboard ↗
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
          Chapter Finals · {category === "junior" ? "Classes 9–10" : "Classes 11–12"}
        </p>
        <h1 className="yiq-display mt-2 text-[2.5rem]">Finals console</h1>

        {!access.canManage ? (
          <p className="mt-6 text-[0.9375rem]" style={{ color: DIM }}>
            You have view-only access — scoring is limited to chapter organisers.
          </p>
        ) : null}

        <FinalsConsole
          eventId={eventId}
          category={category}
          rounds={rounds ?? []}
          teams={board}
          championId={championId}
          canManage={access.canManage}
        />
      </div>
    </main>
  );
}
