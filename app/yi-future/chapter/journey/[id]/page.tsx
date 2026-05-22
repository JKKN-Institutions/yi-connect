import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  setEventComplete,
  deletePhaseEvent,
} from "@/app/yi-future/actions/phase-events";
import { saveAttendance } from "@/app/yi-future/actions/attendance";
import {
  PHASE_LABELS,
  PHASE_EVENT_LABELS,
  type Phase,
} from "@/lib/yi-future/constants";

type EventRow = {
  id: string;
  chapter_id: string;
  edition_id: string;
  phase: Phase;
  type: keyof typeof PHASE_EVENT_LABELS;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  venue: string | null;
  mode: string | null;
  meeting_url: string | null;
  capacity: number | null;
  completed: boolean | null;
  completed_at: string | null;
};

type Delegate = {
  id: string;
  full_name: string;
  email: string | null;
};

type AttendanceRow = { delegate_id: string; attended: boolean | null };

async function getEvent(id: string): Promise<EventRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select(
      "id, chapter_id, edition_id, phase, type, title, description, scheduled_at, duration_minutes, venue, mode, meeting_url, capacity, completed, completed_at"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as EventRow) ?? null;
}

async function getDelegates(
  chapterId: string,
  editionId: string
): Promise<Delegate[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name, email")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data as unknown as Delegate[]) ?? [];
}

async function getAttendance(eventId: string): Promise<AttendanceRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_event_attendance")
    .select("delegate_id, attended")
    .eq("phase_event_id", eventId);
  return (data as unknown as AttendanceRow[]) ?? [];
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  if (event.chapter_id !== ctx.chapterId) redirect("/yi-future/chapter/journey");

  const [delegates, attendance] = await Promise.all([
    getDelegates(event.chapter_id, event.edition_id),
    getAttendance(event.id),
  ]);

  const attendedSet = new Set(
    attendance.filter((a) => a.attended).map((a) => a.delegate_id)
  );
  const attendedCount = attendedSet.size;

  async function saveAttAction(formData: FormData) {
    "use server";
    const map: Record<string, boolean> = {};
    for (const d of delegates) {
      map[d.id] = formData.get(`att_${d.id}`) === "on";
    }
    await saveAttendance(event!.id, map);
  }

  async function toggleCompleteAction() {
    "use server";
    await setEventComplete(event!.id, !event!.completed);
  }

  async function deleteAction() {
    "use server";
    await deletePhaseEvent(event!.id);
    redirect("/yi-future/chapter/journey");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/chapter/journey"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Journey
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
              {PHASE_LABELS[event.phase]} ·{" "}
              {PHASE_EVENT_LABELS[event.type]}
            </div>
            <h2 className="text-2xl font-bold text-navy mt-1">
              {event.title}
            </h2>
            <p className="mt-1 text-sm text-navy/60">
              {fmt(event.scheduled_at)}
              {event.duration_minutes && (
                <span> · {event.duration_minutes} min</span>
              )}
              {event.venue && <span> · {event.venue}</span>}
              {event.mode && <span> · {event.mode}</span>}
            </p>
          </div>
          <form action={toggleCompleteAction}>
            <button
              type="submit"
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                event.completed
                  ? "bg-yi-green/10 text-yi-green hover:bg-yi-green/20"
                  : "bg-navy text-ivory hover:bg-navy-dark"
              }`}
            >
              {event.completed ? "✓ Completed — undo" : "Mark complete"}
            </button>
          </form>
        </div>
      </div>

      {event.description && (
        <div className="bg-white border border-navy/10 rounded-lg p-5">
          <p className="text-sm text-navy/80 whitespace-pre-line">
            {event.description}
          </p>
        </div>
      )}

      {event.meeting_url && (
        <div className="bg-yi-gold/10 border border-yi-gold/30 rounded-md p-3">
          <a
            href={event.meeting_url}
            target="_blank"
            rel="noopener"
            className="text-sm font-semibold text-yi-gold hover:underline"
          >
            Join meeting →
          </a>
        </div>
      )}

      {/* Attendance */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-navy">Attendance</h3>
          <div className="text-xs font-semibold">
            {attendedCount}/{delegates.length} present
          </div>
        </div>
        {delegates.length === 0 ? (
          <p className="text-sm text-navy/50 italic">
            No active delegates in your chapter yet.
          </p>
        ) : (
          <form action={saveAttAction} className="space-y-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {delegates.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 p-2 border border-navy/10 rounded hover:bg-navy/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name={`att_${d.id}`}
                    defaultChecked={attendedSet.has(d.id)}
                    className="h-4 w-4 accent-yi-gold"
                  />
                  <span className="text-sm text-navy">{d.full_name}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end pt-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
              >
                Save attendance
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-white border border-red-200 rounded-lg p-5">
        <h3 className="text-sm font-bold text-red-600 mb-2">Danger zone</h3>
        <form action={deleteAction}>
          <button
            type="submit"
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Delete event
          </button>
        </form>
        <p className="mt-1 text-xs text-navy/50">
          Attendance records will also be deleted.
        </p>
      </section>
    </div>
  );
}
