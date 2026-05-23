import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/app/yi-future/actions/auth";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  listThreadsForTeam,
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

export default async function DelegateMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const sp = await searchParams;
  const selectedThreadId = sp.thread ?? null;

  const svc = await createServiceClient();

  // Resolve this delegate's team (a delegate is on at most one team per edition)
  const { data: membership } = (await svc
    .schema("future")
    .from("team_members")
    .select("team_id, teams(team_name)")
    .eq("delegate_id", session.id)
    .maybeSingle()) as unknown as {
    data: { team_id: string; teams: { team_name: string } | null } | null;
  };

  if (!membership) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">💬</div>
        <h2 className="text-lg font-bold text-navy">No team yet</h2>
        <p className="mt-2 text-sm text-navy/60">
          Once your chapter places you on a team, your mentor conversations will
          appear here.
        </p>
        <Link
          href="/yi-future/me"
          className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const teamId = membership.team_id;
  const teamName = membership.teams?.team_name ?? "Your team";

  // Auto-provision threads for any mentor currently assigned to this team
  await ensureThreadsForTeamMentors(teamId);

  const threadsRes = await listThreadsForTeam(teamId);
  const threads: ThreadListItem[] = threadsRes.ok ? (threadsRes.data ?? []) : [];

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
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Messages</h1>
        <p className="mt-1 text-sm text-navy/60">
          {teamName} · talk to your mentors directly.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={`md:block bg-white border border-navy/10 rounded-lg overflow-hidden ${
            active ? "hidden" : "block"
          }`}
        >
          <div className="px-3 py-2 border-b border-navy/10 text-xs font-semibold uppercase tracking-wider text-navy/60">
            Mentors ({threads.length})
          </div>
          {threads.length === 0 ? (
            <div className="p-4 text-sm text-navy/50">
              No mentors assigned to your team yet.
            </div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {threads.map((t) => {
                const isActive = active?.id === t.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/yi-future/me/messages?thread=${t.id}`}
                      className={`block px-3 py-3 hover:bg-ivory/60 ${
                        isActive ? "bg-yi-gold/10" : ""
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-semibold text-navy text-sm truncate">
                          {t.mentor_name}
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

        <section className={`${active ? "block" : "hidden md:block"}`}>
          {active ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href="/yi-future/me/messages"
                    className="md:hidden text-xs font-semibold uppercase tracking-widest text-navy/50 hover:text-navy"
                  >
                    ← All mentors
                  </Link>
                  <h2 className="text-lg font-bold text-navy">
                    {active.mentor_name}
                  </h2>
                </div>
              </div>
              <Thread
                threadId={active.id}
                currentSender={{
                  type: "delegate",
                  id: session.id,
                  name: session.name ?? "Delegate",
                }}
                initialMessages={initialMessages}
              />
            </div>
          ) : (
            <div className="hidden md:flex h-[60vh] items-center justify-center bg-white border border-navy/10 rounded-lg">
              <p className="text-sm text-navy/50 italic">
                Pick a mentor on the left to start chatting.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── helper: auto-provision threads for this team's mentors ───────────
async function ensureThreadsForTeamMentors(teamId: string): Promise<void> {
  const svc = await createServiceClient();
  const { data: assignments } = (await svc
    .schema("future")
    .from("mentor_team_assignments")
    .select("mentor_id")
    .eq("team_id", teamId)) as unknown as {
    data: { mentor_id: string }[] | null;
  };
  const mentorIds = (assignments ?? []).map((a) => a.mentor_id);
  if (mentorIds.length === 0) return;

  const { data: existing } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .select("mentor_id")
    .eq("team_id", teamId)
    .in("mentor_id", mentorIds)) as unknown as {
    data: { mentor_id: string }[] | null;
  };
  const have = new Set((existing ?? []).map((r) => r.mentor_id));
  const missing = mentorIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  await svc
    .schema("future")
    .from("message_threads" as never)
    .insert(
      missing.map((mid) => ({ team_id: teamId, mentor_id: mid })) as never
    );
}
