import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  listThreadsForMentor,
  listMessages,
  type Message,
  type ThreadListItem,
} from "@/app/yi-future/actions/messages";
import { Thread } from "@/components/yi-future/messaging/Thread";

type SearchParams = Promise<{ thread?: string }>;

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function MentorMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await readSession();
  if (!session || session.type !== "mentor") redirect("/yi-future/join");

  const sp = await searchParams;
  const selectedThreadId = sp.thread ?? null;

  // Auto-create threads for any team this mentor is currently assigned to
  // (so the UI surfaces something even before either side sends a message)
  await ensureThreadsForAssignedTeams(session.id);

  const threadsRes = await listThreadsForMentor(session.id);
  const threads: ThreadListItem[] = threadsRes.ok ? (threadsRes.data ?? []) : [];

  // Resolve selected thread (validate ownership by re-checking it's in the list)
  const active = selectedThreadId
    ? threads.find((t) => t.id === selectedThreadId) ?? null
    : null;

  let initialMessages: Message[] = [];
  if (active) {
    const r = await listMessages(active.id, 200);
    if (r.ok) initialMessages = r.data ?? [];
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/yi-future/mentor"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Messages</h1>
        <p className="mt-1 text-sm text-navy/60">
          One thread per team. New replies show up live.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* THREAD LIST — hidden on mobile when a thread is open */}
        <aside
          className={`md:block bg-white border border-navy/10 rounded-lg overflow-hidden ${
            active ? "hidden" : "block"
          }`}
        >
          <div className="px-3 py-2 border-b border-navy/10 text-xs font-semibold uppercase tracking-wider text-navy/60">
            Teams ({threads.length})
          </div>
          {threads.length === 0 ? (
            <div className="p-4 text-sm text-navy/50">
              No teams assigned to you yet. Once your chapter assigns teams,
              they will appear here.
            </div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {threads.map((t) => {
                const isActive = active?.id === t.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/mentor/messages?thread=${t.id}`}
                      className={`block px-3 py-3 hover:bg-ivory/60 ${
                        isActive ? "bg-yi-gold/10" : ""
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-semibold text-navy text-sm truncate">
                          {t.team_name}
                        </div>
                        <div className="text-[10px] text-navy/40 shrink-0">
                          {relTime(t.last_message_at)}
                        </div>
                      </div>
                      <div className="text-xs text-navy/60 truncate mt-0.5">
                        {t.last_message_preview ?? (
                          <span className="italic text-navy/40">
                            No messages yet
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* THREAD PANEL */}
        <section className={`${active ? "block" : "hidden md:block"}`}>
          {active ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href="/yi-future/mentor/messages"
                    className="md:hidden text-xs font-semibold uppercase tracking-widest text-navy/50 hover:text-navy"
                  >
                    ← All threads
                  </Link>
                  <h2 className="text-lg font-bold text-navy">
                    {active.team_name}
                  </h2>
                </div>
              </div>
              <Thread
                threadId={active.id}
                currentSender={{
                  type: "mentor",
                  id: session.id,
                  name: session.name ?? "Mentor",
                }}
                initialMessages={initialMessages}
              />
            </div>
          ) : (
            <div className="hidden md:flex h-[60vh] items-center justify-center bg-white border border-navy/10 rounded-lg">
              <p className="text-sm text-navy/50 italic">
                Select a team on the left to start chatting.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── helper: auto-provision threads for assigned teams ────────────────
async function ensureThreadsForAssignedTeams(mentorId: string): Promise<void> {
  const svc = await createServiceClient();
  const { data: assignments } = (await svc
    .schema("future")
    .from("mentor_team_assignments")
    .select("team_id")
    .eq("mentor_id", mentorId)) as unknown as {
    data: { team_id: string }[] | null;
  };
  const teamIds = (assignments ?? []).map((a) => a.team_id);
  if (teamIds.length === 0) return;

  const { data: existing } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .select("team_id")
    .eq("mentor_id", mentorId)
    .in("team_id", teamIds)) as unknown as {
    data: { team_id: string }[] | null;
  };
  const have = new Set((existing ?? []).map((r) => r.team_id));
  const missing = teamIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  await svc
    .schema("future")
    .from("message_threads" as never)
    .insert(
      missing.map((tid) => ({ team_id: tid, mentor_id: mentorId })) as never
    );
}
