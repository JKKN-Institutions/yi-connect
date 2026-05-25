import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createClient,
  createServiceClient,
} from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";

// ─── Types ──────────────────────────────────────────────────────────

type ThreadRow = {
  id: string;
  team_id: string;
  mentor_id: string;
  created_at: string;
  last_message_at: string;
  teams: { team_name: string } | null;
  mentors: { full_name: string | null } | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_type: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type EnrichedMessage = MessageRow & { sender_name: string };

// ─── Helpers ────────────────────────────────────────────────────────

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Auth helper ────────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user;
}

// ─── Server Action: send message as admin ───────────────────────────

async function sendAsAdmin(formData: FormData) {
  "use server";

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) return;

  const user = await requireAuth();
  const svc = await createServiceClient();

  await svc
    .schema("future")
    .from("messages" as never)
    .insert({
      thread_id: threadId,
      sender_type: "admin",
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
    } as never);

  await svc
    .schema("future")
    .from("message_threads" as never)
    .update({ last_message_at: new Date().toISOString() } as never)
    .eq("id", threadId);

  revalidatePath("/yi-future/chapter/messages");
}

// ─── Data fetchers ──────────────────────────────────────────────────

async function getChapterThreads(chapterId: string): Promise<ThreadRow[]> {
  const svc = await createServiceClient();

  // Get all teams in this chapter first, then fetch their threads
  const { data: teamRows } = (await svc
    .schema("future")
    .from("teams")
    .select("id")
    .eq("chapter_id", chapterId)) as unknown as {
    data: { id: string }[] | null;
  };

  const teamIds = (teamRows ?? []).map((t) => t.id);
  if (teamIds.length === 0) return [];

  const { data: threads } = (await svc
    .schema("future")
    .from("message_threads" as never)
    .select(
      "id, team_id, mentor_id, created_at, last_message_at, teams(team_name), mentors(full_name)"
    )
    .in("team_id", teamIds)
    .order("last_message_at", { ascending: false })) as unknown as {
    data: ThreadRow[] | null;
  };

  return threads ?? [];
}

async function getThreadMessages(
  threadId: string,
  userId: string
): Promise<EnrichedMessage[]> {
  const svc = await createServiceClient();

  const { data: rows } = (await svc
    .schema("future")
    .from("messages" as never)
    .select("id, thread_id, sender_type, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200)) as unknown as { data: MessageRow[] | null };

  const list = rows ?? [];
  if (list.length === 0) return [];

  // Resolve sender names by type
  const delegateIds = Array.from(
    new Set(
      list
        .filter((r) => r.sender_type === "delegate")
        .map((r) => r.sender_id)
    )
  );
  const mentorIds = Array.from(
    new Set(
      list.filter((r) => r.sender_type === "mentor").map((r) => r.sender_id)
    )
  );

  const nameMap = new Map<string, string>();

  if (delegateIds.length > 0) {
    const { data: ds } = (await svc
      .schema("future")
      .from("delegates")
      .select("id, full_name")
      .in("id", delegateIds)) as unknown as {
      data: { id: string; full_name: string | null }[] | null;
    };
    for (const d of ds ?? []) {
      nameMap.set(`delegate:${d.id}`, d.full_name ?? "Delegate");
    }
  }

  if (mentorIds.length > 0) {
    const { data: ms } = (await svc
      .schema("future")
      .from("mentors")
      .select("id, full_name")
      .in("id", mentorIds)) as unknown as {
      data: { id: string; full_name: string | null }[] | null;
    };
    for (const m of ms ?? []) {
      nameMap.set(`mentor:${m.id}`, m.full_name ?? "Mentor");
    }
  }

  return list.map((r) => ({
    ...r,
    sender_name:
      r.sender_type === "admin" && r.sender_id === userId
        ? "You (Admin)"
        : r.sender_type === "admin"
          ? "Chapter Admin"
          : nameMap.get(`${r.sender_type}:${r.sender_id}`) ??
            (r.sender_type === "mentor" ? "Mentor" : "Delegate"),
  }));
}

// Fetch last message preview for each thread
async function getLastMessagePreviews(
  threadIds: string[]
): Promise<Map<string, { body: string; sender_type: string }>> {
  if (threadIds.length === 0) return new Map();
  const svc = await createServiceClient();

  const { data: recent } = (await svc
    .schema("future")
    .from("messages" as never)
    .select("thread_id, sender_type, body, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(threadIds.length * 4)) as unknown as {
    data:
      | { thread_id: string; sender_type: string; body: string; created_at: string }[]
      | null;
  };

  const map = new Map<string, { body: string; sender_type: string }>();
  for (const r of recent ?? []) {
    if (!map.has(r.thread_id)) {
      map.set(r.thread_id, { body: r.body.slice(0, 80), sender_type: r.sender_type });
    }
  }
  return map;
}

// ─── Page Component ─────────────────────────────────────────────────

type SearchParams = Promise<{ thread?: string }>;

export default async function ChapterMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAuth();
  const ctx = await getChapterContext();

  if (!ctx) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-navy/10 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-navy">No chapter assigned</h2>
        <p className="mt-2 text-sm text-navy/60">
          You need to be linked to a chapter before you can view messages.
        </p>
        <Link
          href="/yi-future/chapter"
          className="mt-4 inline-block text-sm font-semibold text-yi-gold hover:underline"
        >
          Go to Chapter Setup
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const selectedThreadId = sp.thread ?? null;

  // Fetch all threads for teams in this chapter
  const threads = await getChapterThreads(ctx.chapterId);

  // Validate selected thread is in the list
  const active = selectedThreadId
    ? threads.find((t) => t.id === selectedThreadId) ?? null
    : null;

  // Fetch last message previews for the thread list
  const previews = await getLastMessagePreviews(threads.map((t) => t.id));

  // Fetch messages for the active thread
  let messages: EnrichedMessage[] = [];
  if (active) {
    messages = await getThreadMessages(active.id, user.id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Messages</h1>
        <p className="mt-1 text-sm text-navy/60">
          View and respond to mentor-team conversations in{" "}
          <strong>{ctx.chapterName}</strong>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* THREAD LIST */}
        <aside
          className={`md:block bg-white border border-navy/10 rounded-lg overflow-hidden ${
            active ? "hidden" : "block"
          }`}
        >
          <div className="px-3 py-2 border-b border-navy/10 text-xs font-semibold uppercase tracking-wider text-navy/60">
            Conversations ({threads.length})
          </div>
          {threads.length === 0 ? (
            <div className="p-4 text-sm text-navy/50">
              No message threads yet. Threads appear when mentors are assigned to
              teams.
            </div>
          ) : (
            <ul className="divide-y divide-navy/5 max-h-[70vh] overflow-y-auto">
              {threads.map((t) => {
                const isActive = active?.id === t.id;
                const preview = previews.get(t.id);
                return (
                  <li key={t.id}>
                    <Link
                      href={`/yi-future/chapter/messages?thread=${t.id}`}
                      className={`block p-3 cursor-pointer hover:bg-navy/5 border-b border-navy/5 ${
                        isActive ? "bg-yi-gold/10" : ""
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-semibold text-navy text-sm truncate">
                          {t.teams?.team_name ?? "Team"}
                        </div>
                        <div className="text-[10px] text-navy/40 shrink-0">
                          {relTime(t.last_message_at)}
                        </div>
                      </div>
                      <div className="text-[10px] text-navy/40 mt-0.5">
                        Mentor: {t.mentors?.full_name ?? "Unassigned"}
                      </div>
                      <div className="text-xs text-navy/60 truncate mt-0.5">
                        {preview ? (
                          preview.body
                        ) : (
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

        {/* MESSAGE PANEL */}
        <section className={`${active ? "block" : "hidden md:block"}`}>
          {active ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href="/yi-future/chapter/messages"
                    className="md:hidden text-xs font-semibold uppercase tracking-widest text-navy/50 hover:text-navy"
                  >
                    &larr; All threads
                  </Link>
                  <h2 className="text-lg font-bold text-navy">
                    {active.teams?.team_name ?? "Team"}
                  </h2>
                  <p className="text-xs text-navy/50">
                    Mentor: {active.mentors?.full_name ?? "Unassigned"}
                  </p>
                </div>
              </div>

              <div
                className="bg-white border border-navy/10 rounded-lg overflow-hidden flex flex-col"
                style={{ height: "500px" }}
              >
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-center text-xs text-navy/50 italic py-8">
                      No messages in this thread yet.
                    </p>
                  )}
                  {messages.map((m) => {
                    const isMe =
                      m.sender_type === "admin" && m.sender_id === user.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 ${
                            isMe
                              ? "bg-yi-gold/20 text-navy"
                              : "bg-navy/5 text-navy"
                          }`}
                        >
                          <div className="text-[10px] font-semibold text-navy/50">
                            {m.sender_name}
                          </div>
                          <div className="text-sm whitespace-pre-wrap">
                            {m.body}
                          </div>
                          <div className="text-[10px] text-navy/40 mt-1">
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Send form */}
                <form
                  action={sendAsAdmin}
                  className="border-t border-navy/10 p-3 flex gap-2"
                >
                  <input type="hidden" name="thread_id" value={active.id} />
                  <input
                    name="body"
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yi-gold/40"
                    autoComplete="off"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex h-[60vh] items-center justify-center bg-white border border-navy/10 rounded-lg">
              <p className="text-sm text-navy/50 italic">
                Select a conversation on the left to view messages.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
