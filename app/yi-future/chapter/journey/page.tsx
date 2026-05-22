import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  PHASES,
  PHASE_LABELS,
  PHASE_EVENT_LABELS,
  PHASE_EVENT_TYPES_BY_PHASE,
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
  completed: boolean | null;
};

async function getEvents(
  chapterId: string,
  editionId: string
): Promise<PhaseEvent[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("id, phase, type, title, scheduled_at, venue, mode, completed")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as PhaseEvent[]) ?? [];
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function JourneyPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const events = await getEvents(ctx.chapterId, ctx.editionId);

  const statuses: PhaseEventStatus[] = PHASES.map((p) => {
    const phaseEvents = events.filter((e) => e.phase === p);
    return {
      phase: p,
      completed: phaseEvents.filter((e) => e.completed).length,
      scheduled: phaseEvents.length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">90-Day Journey</h2>
          <p className="mt-1 text-sm text-navy/60">
            3 mandated events per phase × 3 phases = 9 events total.
          </p>
        </div>
        <Link
          href="/yi-future/chapter/journey/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + Schedule event
        </Link>
      </div>

      <PhaseTracker statuses={statuses} />

      {/* Phase-grouped event list */}
      <div className="space-y-4">
        {PHASES.map((p) => {
          const phaseEvents = events.filter((e) => e.phase === p);
          const allowedTypes = PHASE_EVENT_TYPES_BY_PHASE[p];
          const scheduledTypes = new Set(phaseEvents.map((e) => e.type));
          const missingTypes = allowedTypes.filter(
            (t) => !scheduledTypes.has(t)
          );

          return (
            <section
              key={p}
              className="bg-white border border-navy/10 rounded-lg overflow-hidden"
            >
              <div className="px-5 py-3 bg-navy/5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-navy">{PHASE_LABELS[p]}</h3>
                  <div className="text-xs text-navy/50 mt-0.5">
                    {phaseEvents.length}/3 events scheduled ·{" "}
                    {phaseEvents.filter((e) => e.completed).length}/3 completed
                  </div>
                </div>
              </div>

              {phaseEvents.length === 0 ? (
                <div className="p-6 text-center text-sm text-navy/50">
                  No events scheduled for this phase yet.
                </div>
              ) : (
                <ul className="divide-y divide-navy/5">
                  {phaseEvents.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/chapter/journey/${e.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-navy/5 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-navy">
                              {e.title}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                              {PHASE_EVENT_LABELS[e.type]}
                            </span>
                            {e.completed && (
                              <span className="text-[10px] font-semibold text-yi-green">
                                ✓ done
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-navy/60 mt-0.5">
                            {fmt(e.scheduled_at)}
                            {e.venue && <span> · {e.venue}</span>}
                            {e.mode && <span> · {e.mode}</span>}
                          </div>
                        </div>
                        <span className="text-navy/30 text-sm">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {missingTypes.length > 0 && (
                <div className="px-5 py-3 border-t border-navy/5 bg-yi-saffron/5 text-xs text-yi-saffron">
                  Still to schedule:{" "}
                  {missingTypes.map((t) => PHASE_EVENT_LABELS[t]).join(" · ")}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
