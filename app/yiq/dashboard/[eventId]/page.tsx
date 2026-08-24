import Link from "next/link";
import { getYiqEventAccess } from "@/lib/yiq/auth/event-access";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { computeChapterStandings } from "@/app/yiq/actions/admin";
import { STATUS_LABELS, type ChapterEventStatus } from "@/lib/yiq/constants";
import { Forbidden403 } from "../../_components/Forbidden403";
import { EventControls } from "./event-controls";
import { Standings } from "./standings";

export const dynamic = "force-dynamic";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function ChapterEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // Gate FIRST — every sub-surface on this page uses the same helper.
  const access = await getYiqEventAccess(eventId);
  if (!access.canView) {
    return <Forbidden403 what="this chapter's YIQ event" reason={access.reason} />;
  }

  const svc = await createServiceClient();
  const { data: event } = await svc
    .from("chapter_events")
    .select("id, chapter_name, status, yi_zone, qualifying_team_count, results_published_at, finals_date, finals_venue")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return <Forbidden403 what="this chapter's YIQ event" reason="event_not_found" />;
  }

  const [{ count: teamCount }, { count: studentCount }, { count: schoolCount }, { count: attemptCount }] =
    await Promise.all([
      svc.from("teams").select("id", { count: "exact", head: true }).eq("chapter_event_id", eventId),
      svc
        .from("attempts")
        .select("student_id", { count: "exact", head: true })
        .eq("chapter_event_id", eventId),
      svc
        .from("schools")
        .select("id", { count: "exact", head: true })
        .eq("chapter_name", event.chapter_name),
      svc
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("chapter_event_id", eventId)
        .eq("is_mock", false)
        .in("status", ["submitted", "auto_submitted"]),
    ]);

  // Standings are readable by the national tier only, before publication.
  const standings =
    access.canViewScores || event.results_published_at
      ? await computeChapterStandings(eventId, { persist: false })
      : null;

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/yiq/dashboard" className="text-[0.875rem]" style={{ color: DIM }}>
            ← All chapters
          </Link>
          <span className="yiq-eyebrow" style={{ color: DIM }}>
            {access.role.replace("_", " ")}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
        <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
          {event.yi_zone ?? "Chapter"}
        </p>
        <h1 className="yiq-display mt-2 text-[2.75rem]">{event.chapter_name}</h1>
        <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
          {STATUS_LABELS[event.status as ChapterEventStatus]}
          {event.results_published_at ? " · results published" : ""}
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Schools", v: schoolCount ?? 0 },
            { l: "Teams", v: teamCount ?? 0 },
            { l: "Papers started", v: studentCount ?? 0 },
            { l: "Papers submitted", v: attemptCount ?? 0 },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border p-4" style={{ borderColor: RULE }}>
              <dt className="yiq-eyebrow" style={{ color: DIM }}>
                {s.l}
              </dt>
              <dd className="yiq-data mt-1.5 text-[1.75rem] font-bold">{s.v}</dd>
            </div>
          ))}
        </dl>

        {access.canManage ? (
          <EventControls
            eventId={eventId}
            status={event.status as ChapterEventStatus}
            resultsPublished={Boolean(event.results_published_at)}
          />
        ) : (
          <p className="mt-8 text-[0.875rem]" style={{ color: DIM }}>
            You have view-only access to this chapter.
          </p>
        )}

        {standings && standings.success ? (
          <Standings
            junior={standings.junior}
            senior={standings.senior}
            bestJunior={standings.bestJunior}
            bestSenior={standings.bestSenior}
            qualifyingCount={event.qualifying_team_count}
          />
        ) : (
          <section className="mt-10 rounded-2xl border p-6" style={{ borderColor: RULE }}>
            <h2 className="yiq-display text-[1.5rem]">Standings</h2>
            <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
              Live standings are visible to YIQ national admins while the round
              is running. They become visible here once you publish results.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
