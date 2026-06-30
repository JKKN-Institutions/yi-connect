import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getVapidPublicKey } from "@/lib/yi-future/vapid";
import PushSubscribeButton from "@/components/yi-future/push/PushSubscribeButton";
import { PHASE_EVENT_LABELS } from "@/lib/yi-future/constants";

export const dynamic = "force-dynamic";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

type SessionEvent = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  mode: string | null;
  venue: string | null;
  meeting_url: string | null;
  chapter_id: string;
};

export default async function ExpertHome() {
  const session = await readSession();
  if (!session || session.type !== "expert") redirect("/yi-future/join");

  // expert_id lives on phase_events; access_code etc. are untyped → loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  const { data: rawEvents } = await svc
    .schema("future")
    .from("phase_events")
    .select(
      "id, title, type, description, scheduled_at, duration_minutes, mode, venue, meeting_url, chapter_id"
    )
    .eq("expert_id", session.id)
    .order("scheduled_at", { ascending: true });
  const events = (rawEvents as SessionEvent[]) ?? [];

  // Resolve chapter names (future.chapters is a view).
  const chapterIds = [...new Set(events.map((e) => e.chapter_id))];
  const chapterName = new Map<string, string>();
  if (chapterIds.length > 0) {
    const { data: chapters } = await svc
      .schema("future")
      .from("chapters")
      .select("id, name, city")
      .in("id", chapterIds);
    for (const c of (chapters as { id: string; name: string; city: string | null }[]) ?? []) {
      chapterName.set(c.id, c.city ? `${c.name} · ${c.city}` : c.name);
    }
  }

  // Teams per chapter, so the expert can see who they'll work with.
  const teamsByChapter = new Map<string, { name: string; count: number }[]>();
  if (chapterIds.length > 0) {
    const { data: teamRows } = await svc
      .schema("future")
      .from("teams")
      .select("team_name, chapter_id, team_members(delegate_id)")
      .in("chapter_id", chapterIds)
      .eq("edition_id", session.edition_id)
      .order("team_name", { ascending: true });
    for (const t of (teamRows as {
      team_name: string;
      chapter_id: string;
      team_members: { delegate_id: string }[] | null;
    }[]) ?? []) {
      const arr = teamsByChapter.get(t.chapter_id) ?? [];
      arr.push({ name: t.team_name, count: t.team_members?.length ?? 0 });
      teamsByChapter.set(t.chapter_id, arr);
    }
  }

  const now = Date.now();
  const upcoming = events.filter(
    (e) => e.scheduled_at && new Date(e.scheduled_at).getTime() >= now
  );
  const undated = events.filter((e) => !e.scheduled_at);
  const past = events.filter(
    (e) => e.scheduled_at && new Date(e.scheduled_at).getTime() < now
  );

  function fmt(iso: string | null): string {
    if (!iso) return "Date to be confirmed";
    return new Date(iso).toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function Card({ e }: { e: SessionEvent }) {
    const typeLabel =
      (PHASE_EVENT_LABELS as Record<string, string>)[e.type] ?? e.title;
    return (
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: `${NAVY}1a` }}
      >
        <div
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: GOLD }}
        >
          {typeLabel}
        </div>
        <div className="mt-0.5 font-bold" style={{ color: NAVY }}>
          {e.title}
        </div>
        <div className="mt-1 text-sm" style={{ color: `${NAVY}b3` }}>
          {chapterName.get(e.chapter_id) ?? "Chapter"} · {fmt(e.scheduled_at)}
          {e.duration_minutes ? ` · ${e.duration_minutes} min` : ""}
        </div>
        {e.description && (
          <p className="mt-2 text-sm" style={{ color: `${NAVY}99` }}>
            {e.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {e.mode && (
            <span
              className="rounded-full px-2 py-0.5 font-semibold"
              style={{ background: `${NAVY}0d`, color: `${NAVY}99` }}
            >
              {e.mode}
            </span>
          )}
          {e.venue && <span style={{ color: `${NAVY}99` }}>{e.venue}</span>}
          {e.meeting_url && (
            <a
              href={e.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold"
              style={{ color: GOLD }}
            >
              Join link →
            </a>
          )}
        </div>
        {(teamsByChapter.get(e.chapter_id)?.length ?? 0) > 0 && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: `${NAVY}0f` }}>
            <div
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: `${NAVY}59` }}
            >
              Teams in this chapter ({teamsByChapter.get(e.chapter_id)!.length})
            </div>
            <ul className="space-y-0.5 text-sm" style={{ color: `${NAVY}cc` }}>
              {teamsByChapter.get(e.chapter_id)!.map((t) => (
                <li
                  key={t.name}
                  className="flex items-center justify-between"
                >
                  <span>{t.name}</span>
                  <span style={{ color: `${NAVY}66` }}>
                    {t.count} member{t.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
          Welcome{session.name ? `, ${session.name}` : ""}
        </h1>
        <p className="mt-1 text-sm" style={{ color: `${NAVY}99` }}>
          The Future 6.0 sessions chapters have invited you to lead.
        </p>
        <div className="mt-3">
          <PushSubscribeButton vapidPublicKey={getVapidPublicKey()} />
        </div>
      </div>

      {events.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-8 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          No sessions assigned to you yet. A chapter team will assign you to an
          Expert Talk or workshop — it will appear here.
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: `${NAVY}99` }}
              >
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.map((e) => (
                <Card key={e.id} e={e} />
              ))}
            </section>
          )}
          {undated.length > 0 && (
            <section className="space-y-3">
              <h2
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: `${NAVY}99` }}
              >
                To be scheduled ({undated.length})
              </h2>
              {undated.map((e) => (
                <Card key={e.id} e={e} />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: `${NAVY}66` }}
              >
                Past ({past.length})
              </h2>
              {past.map((e) => (
                <Card key={e.id} e={e} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
