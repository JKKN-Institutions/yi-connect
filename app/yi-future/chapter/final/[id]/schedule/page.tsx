import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";

/* ─── Types ─────────────────────────────────────────────────────────── */

type TeamRow = {
  id: string;
  team_name: string;
  problem_statements: { title: string } | null;
  team_members: { delegate_id: string; delegates: { full_name: string } | null }[];
};

type EventMeta = {
  id: string;
  chapter_id: string | null;
  edition_id: string;
  name: string;
  start_date: string | null;
};

/* ─── Data fetchers ─────────────────────────────────────────────────── */

async function getEvent(id: string): Promise<EventMeta | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("id, chapter_id, edition_id, name, start_date")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as EventMeta) ?? null;
}

async function getTeams(chapterId: string, editionId: string): Promise<TeamRow[]> {
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

/* ─── Page ──────────────────────────────────────────────────────────── */

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  if (event.chapter_id && event.chapter_id !== ctx.chapterId) {
    redirect("/yi-future/chapter/final");
  }

  const teams = await getTeams(ctx.chapterId, ctx.editionId);

  // Default start time: event start_date or 10:00
  const defaultStart = event.start_date
    ? new Date(event.start_date).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "10:00";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/yi-future/chapter/final/${id}`}
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          &larr; Event
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-navy">
          Presentation Schedule
        </h2>
        <p className="mt-1 text-sm text-navy/60">{event.name}</p>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No teams with &quot;problem_selected&quot; or &quot;frozen&quot; status
          found for this chapter &amp; edition.
        </div>
      ) : (
        <ScheduleForm
          teams={teams}
          defaultStart={defaultStart}
          eventId={id}
        />
      )}
    </div>
  );
}

/* ─── Schedule form (client-interactive but rendered server-side) ──── */

function ScheduleForm({
  teams,
  defaultStart,
  eventId,
}: {
  teams: TeamRow[];
  defaultStart: string;
  eventId: string;
}) {
  // We compute the schedule purely from the form values on the client.
  // For the server render, show a static default schedule.
  const defaultMinutes = 15;

  // Parse start time into minutes from midnight
  const [startH, startM] = defaultStart.split(":").map(Number);
  const startMinutes = (startH || 10) * 60 + (startM || 0);

  return (
    <div className="space-y-5">
      {/* Config */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">
          Settings
        </h3>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-semibold text-navy/60 mb-1">
              Start time
            </label>
            <input
              type="time"
              defaultValue={defaultStart}
              className="px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
              disabled
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy/60 mb-1">
              Minutes per team
            </label>
            <input
              type="number"
              min={5}
              max={60}
              defaultValue={defaultMinutes}
              className="px-3 py-2 border border-navy/20 rounded-md text-sm w-20 font-mono"
              disabled
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-navy/40">
          Edit order numbers below. Schedule times auto-calculate from start
          time and duration.
        </p>
      </section>

      {/* Team list with order inputs */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-4">
          Teams ({teams.length})
        </h3>
        <div className="space-y-3">
          {teams.map((team, i) => {
            const slotStart = startMinutes + i * defaultMinutes;
            const slotEnd = slotStart + defaultMinutes;
            const fmtTime = (mins: number) => {
              const h = Math.floor(mins / 60) % 24;
              const m = mins % 60;
              return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            };
            const memberNames = team.team_members
              .map((tm) => tm.delegates?.full_name)
              .filter(Boolean)
              .join(", ");

            return (
              <div
                key={team.id}
                className="flex items-center gap-3 p-3 border border-navy/10 rounded-md hover:border-navy/20 transition-colors"
              >
                <input
                  name={`order_${team.id}`}
                  type="number"
                  min={1}
                  defaultValue={i + 1}
                  className="w-16 px-2 py-1 border border-navy/20 rounded text-center font-mono text-sm"
                  readOnly
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy text-sm truncate">
                      {team.team_name}
                    </span>
                    {team.problem_statements?.title && (
                      <span className="text-xs text-navy/50 truncate hidden sm:inline">
                        {team.problem_statements.title}
                      </span>
                    )}
                  </div>
                  {memberNames && (
                    <p className="text-xs text-navy/40 mt-0.5 truncate">
                      {memberNames}
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono text-navy/50 shrink-0">
                  {fmtTime(slotStart)} &ndash; {fmtTime(slotEnd)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Summary */}
      <section className="bg-navy/5 border border-navy/10 rounded-lg p-4 text-sm text-navy/70">
        <p>
          <strong>{teams.length} teams</strong> &middot;{" "}
          {defaultMinutes} min each &middot; Total{" "}
          {teams.length * defaultMinutes} min &middot; Ends approx{" "}
          <span className="font-mono">
            {(() => {
              const endMins = startMinutes + teams.length * defaultMinutes;
              const h = Math.floor(endMins / 60) % 24;
              const m = endMins % 60;
              return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            })()}
          </span>
        </p>
      </section>

      {/* Link to live dashboard */}
      <div className="flex gap-3">
        <Link
          href={`/yi-future/chapter/final/${eventId}/live`}
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          Open live dashboard &rarr;
        </Link>
        <Link
          href={`/yi-future/chapter/final/${eventId}`}
          className="px-4 py-2 rounded-md border border-navy/20 text-navy text-sm font-semibold hover:border-navy/40"
        >
          Back to event
        </Link>
      </div>
    </div>
  );
}
