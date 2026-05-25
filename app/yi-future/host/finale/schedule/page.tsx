import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";

/* ── types ─────────────────────────────────────────────────── */

type FinalistTeam = {
  team_id: string;
  rank: number | null;
  total_score: number | null;
  teams: {
    team_name: string;
    chapters: { name: string } | null;
    problem_statements: { title: string } | null;
  } | null;
};

/* ── data fetching ─────────────────────────────────────────── */

async function getFinalistTeams(
  toEventId: string,
  hostFinaleRegion: string
): Promise<FinalistTeam[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("advancements")
    .select(
      "team_id, rank, total_score, teams(team_name, chapters(name), problem_statements(title))"
    )
    .eq("to_event_id", toEventId)
    .order("rank", { ascending: true });

  return (data as unknown as FinalistTeam[]) ?? [];
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

/* ── helpers ───────────────────────────────────────────────── */

const PRESENTATION_MINUTES = 15;
const BUFFER_MINUTES = 5;
const SLOT_MINUTES = PRESENTATION_MINUTES + BUFFER_MINUTES;

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function buildSchedule(
  teams: FinalistTeam[],
  startDate: string | null
) {
  // Default start time: 10:00 AM on the event date (or today)
  const base = startDate ? new Date(startDate) : new Date();
  base.setHours(10, 0, 0, 0);

  return teams.map((t, idx) => {
    const slotStart = new Date(base.getTime() + idx * SLOT_MINUTES * 60_000);
    const slotEnd = new Date(
      slotStart.getTime() + PRESENTATION_MINUTES * 60_000
    );

    return {
      slot: idx + 1,
      startTime: formatTime(slotStart),
      endTime: formatTime(slotEnd),
      team_id: t.team_id,
      team_name: t.teams?.team_name ?? "(unnamed)",
      chapter: t.teams?.chapters?.name ?? "—",
      problem: t.teams?.problem_statements?.title ?? "—",
      chapterRank: t.rank,
      chapterScore: t.total_score,
    };
  });
}

/* ── page ──────────────────────────────────────────────────── */

export default async function FinaleSchedulePage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/login");
  if (!ctx.isHost) redirect("/yi-future/host");
  if (!ctx.nationalEvent) redirect("/yi-future/host");

  const hostFinaleRegion = await getHostFinaleRegion(ctx.chapterId);
  if (!hostFinaleRegion) redirect("/yi-future/host");

  const finalists = await getFinalistTeams(
    ctx.nationalEvent.id,
    hostFinaleRegion
  );
  const schedule = buildSchedule(finalists, ctx.nationalEvent.start_date);

  const totalDuration =
    finalists.length > 0 ? finalists.length * SLOT_MINUTES : 0;
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase mb-1">
          Regional Finale
        </div>
        <h2 className="text-2xl font-bold text-navy">Finale Schedule</h2>
        <p className="mt-1 text-sm text-navy/60">
          {ctx.chapterName} &middot;{" "}
          <span className="inline-flex items-center gap-1">
            {ctx.trackIcon ?? "•"} {ctx.trackName}
          </span>
        </p>
        {ctx.nationalEvent.start_date && (
          <p className="mt-0.5 text-xs text-navy/40">
            {new Date(ctx.nationalEvent.start_date).toLocaleDateString(
              "en-IN",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }
            )}
            {ctx.nationalEvent.venue && (
              <span> &middot; {ctx.nationalEvent.venue}</span>
            )}
          </p>
        )}
      </div>

      {/* Schedule info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Presentations
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">
            {finalists.length}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Per Slot
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">
            {PRESENTATION_MINUTES}
            <span className="text-sm font-normal text-navy/40"> min</span>
            {BUFFER_MINUTES > 0 && (
              <span className="text-xs font-normal text-navy/40">
                {" "}
                + {BUFFER_MINUTES} buffer
              </span>
            )}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Total Duration
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">
            {hours > 0 && (
              <>
                {hours}
                <span className="text-sm font-normal text-navy/40">h </span>
              </>
            )}
            {mins}
            <span className="text-sm font-normal text-navy/40">m</span>
          </div>
        </div>
      </div>

      {/* Schedule list */}
      {finalists.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No finalist teams yet. The schedule will populate once chapters
          publish their shortlists.
        </div>
      ) : (
        <div className="space-y-2">
          {schedule.map((slot) => (
            <div
              key={slot.team_id}
              className="bg-white border border-navy/10 rounded-lg p-4 flex items-center gap-4"
            >
              {/* Slot number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-navy/5 flex items-center justify-center">
                <span className="text-xs font-bold text-navy">
                  {slot.slot}
                </span>
              </div>

              {/* Time */}
              <div className="flex-shrink-0 w-28">
                <div className="font-mono text-sm font-semibold text-navy">
                  {slot.startTime}
                </div>
                <div className="font-mono text-[10px] text-navy/40">
                  to {slot.endTime}
                </div>
              </div>

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-navy truncate">
                  {slot.team_name}
                </div>
                <div className="text-xs text-navy/60">{slot.chapter}</div>
              </div>

              {/* Problem statement */}
              <div className="hidden md:block flex-1 min-w-0">
                <div className="text-xs text-navy/50 truncate">
                  {slot.problem}
                </div>
              </div>

              {/* Chapter score */}
              {slot.chapterScore != null && (
                <div className="flex-shrink-0 text-right">
                  <div className="font-mono text-sm font-bold text-navy/60">
                    {slot.chapterScore}
                  </div>
                  <div className="text-[10px] text-navy/40">ch. score</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-navy/40">
        Schedule is auto-generated based on advancement order. Presentation
        order: {PRESENTATION_MINUTES} min per team + {BUFFER_MINUTES} min
        buffer, starting at 10:00 AM.
      </p>
    </div>
  );
}
