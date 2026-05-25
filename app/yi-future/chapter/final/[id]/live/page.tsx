import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  activateSection,
  endAllSections,
} from "@/app/yi-future/actions/events";
import {
  CHAPTER_FINAL_SECTIONS,
  CHAPTER_FINAL_SECTION_LABELS,
} from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";
import { LiveTeamDashboard } from "./live-team-dashboard";

type CFSection = Database["future"]["Enums"]["chapter_final_section"];

type Section = {
  section: CFSection;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
};

type TeamRow = {
  id: string;
  team_name: string;
  problem_statements: { title: string } | null;
  team_members: {
    delegate_id: string;
    delegates: { full_name: string } | null;
  }[];
};

type EvaluationRow = {
  team_id: string;
  jury_id: string;
  total_score: number;
  status: string | null;
};

/* ─── Data fetchers ─────────────────────────────────────────────────── */

async function getEventMeta(
  id: string
): Promise<{
  id: string;
  chapter_id: string | null;
  edition_id: string;
  name: string;
  start_date: string | null;
} | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("id, chapter_id, edition_id, name, start_date")
    .eq("id", id)
    .maybeSingle();
  return (
    (data as unknown as {
      id: string;
      chapter_id: string | null;
      edition_id: string;
      name: string;
      start_date: string | null;
    }) ?? null
  );
}

async function getSections(eventId: string): Promise<Section[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_final_sections")
    .select("section, title, starts_at, ends_at, is_active")
    .eq("event_id", eventId);
  return (data as unknown as Section[]) ?? [];
}

async function getTeams(
  chapterId: string,
  editionId: string
): Promise<TeamRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, problem_statement_id, problem_statements(title), team_members(delegate_id, delegates(full_name))"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .in("status", ["problem_selected", "frozen"])
    .order("team_name");
  return (data as unknown as TeamRow[]) ?? [];
}

async function getEvaluations(eventId: string): Promise<EvaluationRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select("team_id, jury_id, total_score, status")
    .eq("event_id", eventId);
  return (data as unknown as EvaluationRow[]) ?? [];
}

async function getJuryCount(editionId: string): Promise<number> {
  const svc = await createServiceClient();
  const { count } = await svc
    .schema("future")
    .from("jury_assignments")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", editionId)
    .eq("is_active", true);
  return count ?? 0;
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default async function LiveControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const event = await getEventMeta(id);
  if (!event) notFound();
  if (event.chapter_id && event.chapter_id !== ctx.chapterId) {
    redirect("/yi-future/chapter/final");
  }

  const [sections, teams, evaluations, juryCount] = await Promise.all([
    getSections(id),
    getTeams(ctx.chapterId, ctx.editionId),
    getEvaluations(id),
    getJuryCount(ctx.editionId),
  ]);

  const secByKey = new Map<CFSection, Section>();
  for (const s of sections) secByKey.set(s.section, s);
  const active = sections.find((s) => s.is_active);

  // Build evaluation lookup: teamId -> { scored, submitted, scores[] }
  const evalByTeam = new Map<
    string,
    { scoredCount: number; submittedCount: number; scores: number[] }
  >();
  for (const ev of evaluations) {
    const entry = evalByTeam.get(ev.team_id) ?? {
      scoredCount: 0,
      submittedCount: 0,
      scores: [],
    };
    entry.scoredCount++;
    if (ev.status === "submitted" || ev.status === "locked") {
      entry.submittedCount++;
    }
    entry.scores.push(ev.total_score);
    evalByTeam.set(ev.team_id, entry);
  }

  async function activate(formData: FormData) {
    "use server";
    const section = String(formData.get("section") ?? "") as CFSection;
    await activateSection(id, section);
  }

  async function endAll() {
    "use server";
    await endAllSections(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/yi-future/chapter/final/${id}`}
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          &larr; Event
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-navy">Live dashboard</h2>
            <p className="mt-1 text-sm text-navy/60">{event.name}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href={`/event/${id}/display`}
              target="_blank"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Open projector view &uarr;
            </Link>
            <Link
              href={`/yi-future/chapter/final/${id}/schedule`}
              className="text-xs font-semibold text-yi-gold hover:underline"
            >
              Presentation schedule &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Active section banner */}
      {active ? (
        <section className="bg-gradient-to-br from-yi-gold to-yi-saffron text-white rounded-lg p-6 text-center">
          <div className="text-[10px] font-semibold tracking-widest uppercase opacity-80">
            Now live
          </div>
          <div className="mt-2 text-3xl font-bold">
            {CHAPTER_FINAL_SECTION_LABELS[active.section]}
          </div>
          {active.starts_at && (
            <div className="mt-2 text-xs opacity-80 font-mono">
              Started at{" "}
              {new Date(active.starts_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
          <form action={endAll} className="mt-4">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-semibold"
            >
              End section / pause
            </button>
          </form>
        </section>
      ) : (
        <section className="bg-navy/5 border border-navy/20 rounded-lg p-6 text-center text-sm text-navy/60">
          No section live. Pick one below.
        </section>
      )}

      {/* Section sequence */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
          Sequence
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CHAPTER_FINAL_SECTIONS.map((k, i) => {
            const s = secByKey.get(k);
            const done = !!s?.ends_at && !s?.is_active;
            return (
              <form
                action={activate}
                key={k}
                className={`relative rounded-lg p-4 border-2 transition-all ${
                  s?.is_active
                    ? "border-yi-gold bg-yi-gold/5"
                    : done
                      ? "border-navy/10 bg-navy/[0.02] opacity-60"
                      : "border-navy/20 bg-white hover:border-yi-gold/50"
                }`}
              >
                <input type="hidden" name="section" value={k} />
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl font-black text-navy/20">
                    {i + 1}
                  </span>
                  <span className="font-bold text-navy text-sm">
                    {CHAPTER_FINAL_SECTION_LABELS[k]}
                  </span>
                </div>
                {s?.is_active ? (
                  <span className="text-[10px] font-semibold text-yi-gold">
                    &#9679; LIVE
                  </span>
                ) : done ? (
                  <span className="text-[10px] font-semibold text-navy/40">
                    &#10003; done
                  </span>
                ) : (
                  <button
                    type="submit"
                    className="text-xs font-semibold text-navy hover:text-yi-gold"
                  >
                    Go live &rarr;
                  </button>
                )}
              </form>
            );
          })}
        </div>
      </section>

      {/* Team presentations & scoring — client component for timer */}
      {teams.length > 0 && (
        <LiveTeamDashboard
          teams={teams.map((t) => ({
            id: t.id,
            team_name: t.team_name,
            problem_title: t.problem_statements?.title ?? null,
            member_names: t.team_members
              .map((m) => m.delegates?.full_name)
              .filter(Boolean) as string[],
          }))}
          evalByTeam={Object.fromEntries(
            Array.from(evalByTeam.entries()).map(([k, v]) => [k, v])
          )}
          juryCount={juryCount}
          eventId={id}
        />
      )}
    </div>
  );
}
