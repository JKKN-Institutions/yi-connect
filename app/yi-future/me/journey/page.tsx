import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  PHASES,
  PHASE_LABELS,
  PHASE_EVENT_LABELS,
  type Phase,
} from "@/lib/yi-future/constants";
import {
  PhaseTracker,
  type PhaseEventStatus,
} from "@/components/yi-future/phase/PhaseTracker";

type PhaseEvent = {
  id: string;
  phase: Phase;
  type: keyof typeof PHASE_EVENT_LABELS;
  title: string;
  scheduled_at: string;
  venue: string | null;
  mode: string | null;
  meeting_url: string | null;
  completed: boolean | null;
};

type Delegate = {
  chapter_id: string;
  edition_id: string;
};

type Attendance = { phase_event_id: string; attended: boolean | null };

async function getDelegate(id: string): Promise<Delegate | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("chapter_id, edition_id")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Delegate) ?? null;
}

async function getEvents(
  chapterId: string,
  editionId: string
): Promise<PhaseEvent[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select(
      "id, phase, type, title, scheduled_at, venue, mode, meeting_url, completed"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as PhaseEvent[]) ?? [];
}

async function getAttendance(delegateId: string): Promise<Attendance[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_event_attendance")
    .select("phase_event_id, attended")
    .eq("delegate_id", delegateId);
  return (data as unknown as Attendance[]) ?? [];
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DelegateJourneyPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const me = await getDelegate(session.id);
  if (!me) redirect("/yi-future/me");

  /* ── Gate: team must have a problem statement ── */
  const svc = await createServiceClient();
  const { data: membership } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id, teams(problem_statement_id)")
    .eq("delegate_id", session.id)
    .limit(1)
    .maybeSingle();

  const team = (membership as unknown as { teams: { problem_statement_id: string | null } } | null)?.teams;
  const hasProblem = !!team?.problem_statement_id;

  if (!hasProblem) {
    return (
      <div className="space-y-5">
        <div>
          <Link
            href="/yi-future/me"
            className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
          >
            &larr; Dashboard
          </Link>
          <h2 className="mt-1 text-2xl font-bold text-navy">Your journey</h2>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h2 className="text-lg font-bold text-navy">
            Journey unlocks after problem selection
          </h2>
          <p className="mt-2 text-sm text-navy/60">
            Your team needs to pick a problem statement before the 90-day
            journey begins.
          </p>
          <Link
            href="/yi-future/me/team"
            className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
          >
            Go to team page &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const [events, attendance] = await Promise.all([
    getEvents(me.chapter_id, me.edition_id),
    getAttendance(session.id),
  ]);

  const attendedSet = new Set(
    attendance.filter((a) => a.attended).map((a) => a.phase_event_id)
  );

  const statuses: PhaseEventStatus[] = PHASES.map((p) => {
    const phaseEvents = events.filter((e) => e.phase === p);
    return {
      phase: p,
      completed: phaseEvents.filter((e) => e.completed).length,
      scheduled: phaseEvents.length,
    };
  });

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.scheduled_at) > now);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">Your journey</h2>
        <p className="mt-1 text-sm text-navy/60">
          All 9 phase events for your chapter.
        </p>
      </div>

      <PhaseTracker statuses={statuses} />

      {/* Next up */}
      {upcoming.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-2">
            Up next
          </h3>
          <div className="bg-white border-2 border-yi-gold/30 rounded-lg p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold">
              {PHASE_EVENT_LABELS[upcoming[0].type]}
            </div>
            <div className="mt-1 font-bold text-navy">
              {upcoming[0].title}
            </div>
            <div className="text-xs text-navy/60 mt-1">
              {fmt(upcoming[0].scheduled_at)}
              {upcoming[0].venue && <span> · {upcoming[0].venue}</span>}
            </div>
            {upcoming[0].meeting_url && (
              <a
                href={upcoming[0].meeting_url}
                target="_blank"
                rel="noopener"
                className="mt-2 inline-block text-xs font-semibold text-yi-gold hover:underline"
              >
                Join meeting →
              </a>
            )}
          </div>
        </section>
      )}

      {/* All phases */}
      {PHASES.map((p) => {
        const phaseEvents = events.filter((e) => e.phase === p);
        return (
          <section key={p}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-2">
              {PHASE_LABELS[p]}
            </h3>
            {phaseEvents.length === 0 ? (
              <div className="bg-white border border-navy/10 rounded-lg p-4 text-sm text-navy/50 italic">
                Nothing scheduled yet.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {phaseEvents.map((e) => {
                  const attended = attendedSet.has(e.id);
                  return (
                    <li
                      key={e.id}
                      className="bg-white border border-navy/10 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-navy text-sm truncate">
                            {e.title}
                          </div>
                          <div className="text-xs text-navy/60 mt-0.5">
                            {PHASE_EVENT_LABELS[e.type]} · {fmt(e.scheduled_at)}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {e.completed && attended ? (
                            <span className="text-[10px] font-semibold text-yi-green">
                              ✓ Attended
                            </span>
                          ) : e.completed ? (
                            <span className="text-[10px] font-semibold text-navy/40">
                              Missed
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-navy/60">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
