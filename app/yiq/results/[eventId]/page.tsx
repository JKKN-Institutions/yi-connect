import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yiq/supabase/server";

export const revalidate = 120;

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function ChapterResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const svc = await createServiceClient();

  const { data: event } = await svc
    .from("chapter_events")
    .select(
      "id, chapter_name, yi_zone, results_published_at, qualifying_team_count, best_quizzer_junior_student_id, best_quizzer_senior_student_id"
    )
    .eq("id", eventId)
    .maybeSingle();

  // Unpublished results are not public. 404 rather than leak that the
  // chapter exists but is mid-round.
  if (!event || !event.results_published_at) notFound();

  const { data: teams } = await svc
    .from("teams")
    .select("id, name, category, online_total_score, online_rank, status, schools(name)")
    .eq("chapter_event_id", eventId)
    .not("online_rank", "is", null)
    .order("online_rank");

  const bestIds = [
    event.best_quizzer_junior_student_id,
    event.best_quizzer_senior_student_id,
  ].filter(Boolean) as string[];

  const { data: bestStudents } = bestIds.length
    ? await svc.from("students").select("id, full_name").in("id", bestIds)
    : { data: [] as { id: string; full_name: string }[] };

  const bestById = new Map((bestStudents ?? []).map((s) => [s.id, s.full_name]));

  const groups: { key: "junior" | "senior"; label: string; bestId: string | null }[] = [
    { key: "junior", label: "Junior · Classes 9–10", bestId: event.best_quizzer_junior_student_id },
    { key: "senior", label: "Senior · Classes 11–12", bestId: event.best_quizzer_senior_student_id },
  ];

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/yiq/results" className="text-[0.875rem]" style={{ color: DIM }}>
            ← All chapters
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-9 sm:px-8">
        <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
          Final Online Round
        </p>
        <h1 className="yiq-display mt-2 text-[2.75rem]">{event.chapter_name}</h1>

        {groups.map((g) => {
          const rows = (teams ?? []).filter((t) => t.category === g.key);
          const best = g.bestId ? bestById.get(g.bestId) : null;
          return (
            <section key={g.key} className="mt-10">
              <h2 className="yiq-display text-[1.5rem]">{g.label}</h2>
              {rows.length === 0 ? (
                <p className="mt-3 text-[0.875rem]" style={{ color: DIM }}>
                  No results in this category.
                </p>
              ) : (
                <ol className="mt-4 grid gap-2">
                  {rows.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-4 rounded-xl px-4 py-3"
                      style={{
                        background:
                          t.status === "qualified" || t.status === "champion"
                            ? "rgba(232,163,61,0.12)"
                            : "rgba(247,244,237,0.04)",
                      }}
                    >
                      <span
                        className="yiq-data grid h-9 w-9 flex-none place-items-center rounded-lg text-[0.875rem] font-bold"
                        style={
                          (t.online_rank ?? 99) <= event.qualifying_team_count
                            ? { background: SAFFRON, color: INK }
                            : { background: "rgba(247,244,237,0.08)", color: DIM }
                        }
                      >
                        {t.online_rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[1rem] font-semibold">{t.name}</p>
                        <p className="truncate text-[0.8125rem]" style={{ color: DIM }}>
                          {(t.schools as { name: string } | null)?.name}
                        </p>
                      </div>
                      <span className="yiq-data text-[1.25rem] font-bold">
                        {t.online_total_score ?? 0}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {best ? (
                <p
                  className="mt-3 rounded-xl px-4 py-3 text-[0.875rem]"
                  style={{ background: "rgba(20,121,90,0.16)" }}
                >
                  <span className="yiq-eyebrow" style={{ color: GREEN }}>
                    Best individual quizzer
                  </span>
                  <br />
                  <strong>{best}</strong>
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}
