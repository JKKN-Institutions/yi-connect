import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteExpert,
  regenerateExpertAccessCode,
  assignExpertToPhaseEvent,
  unassignExpertFromPhaseEvent,
} from "@/app/yi-future/actions/experts";
import { PHASE_EVENT_LABELS } from "@/lib/yi-future/constants";
import { DeleteExpertButton } from "@/components/yi-future/experts/DeleteExpertButton";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

type Expert = {
  id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  expertise_areas: string[] | null;
  access_code: string | null;
};

type PhaseEvent = {
  id: string;
  title: string;
  type: string;
  scheduled_at: string | null;
  expert_id: string | null;
};

async function getExperts(editionId: string): Promise<Expert[]> {
  // access_code is a new column not in generated types → loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data } = await svc
    .schema("future")
    .from("experts")
    .select(
      "id, full_name, title, organization, email, phone, bio, expertise_areas, access_code"
    )
    .eq("edition_id", editionId)
    .order("full_name", { ascending: true });
  return (data as unknown as Expert[]) ?? [];
}

async function getPhaseEvents(
  chapterId: string,
  editionId: string
): Promise<PhaseEvent[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("id, title, type, scheduled_at, expert_id")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("scheduled_at", { ascending: true });
  return (data as unknown as PhaseEvent[]) ?? [];
}

function eventLabel(e: PhaseEvent): string {
  const typeLabel =
    (PHASE_EVENT_LABELS as Record<string, string>)[e.type] ?? e.title;
  const date = e.scheduled_at
    ? new Date(e.scheduled_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : null;
  return date ? `${typeLabel} · ${date}` : typeLabel;
}

export default async function ExpertsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [experts, events] = await Promise.all([
    getExperts(ctx.editionId),
    getPhaseEvents(ctx.chapterId, ctx.editionId),
  ]);

  const assignedByExpert = new Map<string, PhaseEvent[]>();
  for (const e of events) {
    if (e.expert_id) {
      const arr = assignedByExpert.get(e.expert_id) ?? [];
      arr.push(e);
      assignedByExpert.set(e.expert_id, arr);
    }
  }
  const unassignedEvents = events.filter((e) => !e.expert_id);

  async function removeExpert(formData: FormData) {
    "use server";
    await deleteExpert(String(formData.get("id") ?? ""));
  }
  async function regen(formData: FormData) {
    "use server";
    await regenerateExpertAccessCode(String(formData.get("id") ?? ""));
  }
  async function assign(formData: FormData) {
    "use server";
    await assignExpertToPhaseEvent(
      String(formData.get("expert_id") ?? ""),
      String(formData.get("event_id") ?? "")
    );
  }
  async function unassign(formData: FormData) {
    "use server";
    await unassignExpertFromPhaseEvent(String(formData.get("event_id") ?? ""));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
            Experts
          </h2>
          <p className="mt-1 text-sm" style={{ color: `${NAVY}99` }}>
            {experts.length} expert{experts.length === 1 ? "" : "s"} for{" "}
            {ctx.editionName}. Each has an access code to sign in at{" "}
            <span className="font-mono">/yi-future/login</span> and see the
            sessions you assign them.
          </p>
        </div>
        <Link
          href="/yi-future/chapter/experts/new"
          className="px-4 py-2 rounded-md text-sm font-semibold text-white"
          style={{ background: NAVY }}
        >
          + Add expert
        </Link>
      </div>

      {experts.length === 0 ? (
        <div
          className="rounded-lg border bg-white p-8 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          No experts yet.{" "}
          <Link
            href="/yi-future/chapter/experts/new"
            className="font-semibold"
            style={{ color: GOLD }}
          >
            Add one
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {experts.map((e) => {
            const assigned = assignedByExpert.get(e.id) ?? [];
            return (
              <div
                key={e.id}
                className="rounded-lg border bg-white p-5"
                style={{ borderColor: `${NAVY}1a` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold" style={{ color: NAVY }}>
                      {e.full_name}
                    </div>
                    {(e.title || e.organization) && (
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: `${NAVY}99` }}
                      >
                        {e.title}
                        {e.title && e.organization && " · "}
                        {e.organization}
                      </div>
                    )}
                    {(e.email || e.phone) && (
                      <div
                        className="text-xs mt-1"
                        style={{ color: `${NAVY}80` }}
                      >
                        {e.email}
                        {e.email && e.phone && " · "}
                        {e.phone}
                      </div>
                    )}
                    {e.expertise_areas && e.expertise_areas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.expertise_areas.map((area) => (
                          <span
                            key={area}
                            className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                            style={{ background: `${GOLD}1a`, color: "#9a6a00" }}
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <code
                    className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded"
                    style={{ background: `${GOLD}1a`, color: "#9a6a00" }}
                  >
                    {e.access_code ?? "—"}
                  </code>
                </div>

                {/* Assigned sessions */}
                <div
                  className="mt-4 pt-3 border-t"
                  style={{ borderColor: `${NAVY}14` }}
                >
                  <div
                    className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: `${NAVY}66` }}
                  >
                    Assigned sessions ({assigned.length})
                  </div>
                  {assigned.length > 0 && (
                    <ul className="space-y-1 mb-2">
                      {assigned.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex items-center justify-between text-xs"
                          style={{ color: NAVY }}
                        >
                          <span className="font-semibold">{eventLabel(ev)}</span>
                          <form action={unassign}>
                            <input type="hidden" name="event_id" value={ev.id} />
                            <button
                              type="submit"
                              className="text-red-600/60 hover:text-red-600"
                            >
                              remove
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                  {unassignedEvents.length > 0 ? (
                    <form action={assign} className="flex gap-2">
                      <input type="hidden" name="expert_id" value={e.id} />
                      <select
                        name="event_id"
                        required
                        defaultValue=""
                        className="flex-1 px-2 py-1 text-xs border rounded bg-white"
                        style={{ borderColor: `${NAVY}33`, color: NAVY }}
                      >
                        <option value="" disabled>
                          — assign to a session —
                        </option>
                        {unassignedEvents.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {eventLabel(ev)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-2 py-1 text-xs font-semibold text-white rounded"
                        style={{ background: NAVY }}
                      >
                        Assign
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs" style={{ color: `${NAVY}66` }}>
                      {events.length === 0
                        ? "Create journey sessions first to assign experts."
                        : "All sessions already have an expert."}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="mt-3 pt-3 border-t flex items-center justify-between"
                  style={{ borderColor: `${NAVY}14` }}
                >
                  <Link
                    href={`/yi-future/chapter/experts/${e.id}/edit`}
                    className="text-xs font-semibold"
                    style={{ color: NAVY }}
                  >
                    Edit
                  </Link>
                  <form action={regen}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="text-xs"
                      style={{ color: `${NAVY}99` }}
                    >
                      Regen code
                    </button>
                  </form>
                  <form action={removeExpert}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600/70 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
