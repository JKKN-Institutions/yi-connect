"use client";

/**
 * Chat moderation client — organiser surface for the YIP community chat.
 *
 * ⚠️ CHILD SAFETY: every action this client calls is independently flag-gated
 * and canManage-gated on the server (app/yip/actions/chat.ts). This component
 * is presentation only — it holds no authority.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  MessagesSquare,
  Megaphone,
  Landmark,
  Users,
  Flag,
  Snowflake,
  Play,
  Trash2,
  ArrowLeft,
  Loader2,
  VolumeX,
  Volume2,
  UserCircle2,
  RefreshCw,
  PlusCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/yip/ui/button";
import { cn } from "@/lib/yip/utils";
import {
  modListChannels,
  modListMessages,
  modListDmThreads,
  listReportedMessages,
  listMutedStudents,
  muteStudent,
  unmuteStudent,
  freezeChannel,
  unfreezeChannel,
  deleteMessage,
  seedChatChannels,
  modPostAnnouncement,
  type ModChannel,
  type ModMessage,
  type ModDmThread,
  type ModMutedStudent,
} from "@/app/yip/actions/chat";

type Tab = "channels" | "reported" | "dms" | "muted";

type ThreadView =
  | { kind: "channel"; channel: ModChannel }
  | { kind: "dm"; thread: ModDmThread };

const KIND_ICON: Record<ModChannel["kind"], typeof Users> = {
  party: Landmark,
  committee: Users,
  announcement: Megaphone,
};

const TABS: { id: Tab; label: string }[] = [
  { id: "channels", label: "Channels" },
  { id: "reported", label: "Reported" },
  { id: "dms", label: "Direct messages" },
  { id: "muted", label: "Muted students" },
];

export function ChatModerationClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [tab, setTab] = useState<Tab>("channels");
  const [thread, setThread] = useState<ThreadView | null>(null);

  const [channels, setChannels] = useState<ModChannel[]>([]);
  const [reported, setReported] = useState<ModMessage[]>([]);
  const [dmThreads, setDmThreads] = useState<ModDmThread[]>([]);
  const [muted, setMuted] = useState<ModMutedStudent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Channel seeding (idempotent — safe to re-run to top up after new
  // parties/committees) + the organiser announcement composer.
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [announcementNotice, setAnnouncementNotice] = useState<string | null>(
    null
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [chRes, repRes, dmRes, muteRes] = await Promise.all([
      modListChannels(eventId),
      listReportedMessages(eventId),
      modListDmThreads(eventId),
      listMutedStudents(eventId),
    ]);
    if (chRes.success) setChannels(chRes.data);
    else setError(chRes.error);
    if (repRes.success) setReported(repRes.data);
    if (dmRes.success) setDmThreads(dmRes.data);
    if (muteRes.success) setMuted(muteRes.data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  function act(fn: () => Promise<{ success: boolean }>) {
    startTransition(async () => {
      const res = (await fn()) as
        | { success: true }
        | { success: false; error: string };
      if (!res.success) setError(res.error);
      await refreshAll();
    });
  }

  function handleSeed() {
    startTransition(async () => {
      setError(null);
      setSeedNotice(null);
      const res = await seedChatChannels(eventId);
      if (res.success) {
        const { created, skipped, total } = res.data;
        setSeedNotice(
          `Created ${created} channel${created === 1 ? "" : "s"}, ` +
            `skipped ${skipped} already existing (${total} total).`
        );
      } else {
        setError(res.error);
      }
      await refreshAll();
    });
  }

  function handlePostAnnouncement(channelId: string) {
    const body = announcementDraft.trim();
    if (!body) return;
    startTransition(async () => {
      setError(null);
      setAnnouncementNotice(null);
      const res = await modPostAnnouncement(eventId, channelId, body);
      if (res.success) {
        setAnnouncementDraft("");
        setAnnouncementNotice("Announcement posted.");
      } else {
        setError(res.error);
      }
      await refreshAll();
    });
  }

  if (thread) {
    return (
      <ThreadPanel
        eventId={eventId}
        view={thread}
        onBack={() => setThread(null)}
        onChanged={refreshAll}
        onMute={(participantId) =>
          act(() => muteStudent(eventId, participantId))
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#FF9933]/10">
            <MessagesSquare className="size-5 text-[#FF9933]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1a1a3e]">
              Chat moderation
            </h2>
            <p className="text-xs text-[#1a1a3e]/50">
              {eventName} · messages are kept for the event + 90 days
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshAll()}
          disabled={loading || pending}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-[#1a1a3e]/5 bg-white p-1">
        {TABS.map((t) => {
          const badge =
            t.id === "reported"
              ? reported.length
              : t.id === "muted"
                ? muted.length
                : null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-[#FF9933]/10 text-[#FF9933]"
                  : "text-[#1a1a3e]/50 hover:text-[#1a1a3e]"
              )}
            >
              {t.label}
              {badge !== null && badge > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-600">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-[#FF9933]" />
        </div>
      ) : (
        <>
          {tab === "channels" && (
            <div className="space-y-2">
              {seedNotice && (
                <p className="rounded-lg bg-[#138808]/10 px-3 py-2 text-xs text-[#138808]">
                  {seedNotice}
                </p>
              )}

              {channels.length === 0 ? (
                /* No channels yet → the prominent setup path (GAP 1). */
                <div className="flex flex-col items-center rounded-xl border border-dashed border-[#1a1a3e]/10 bg-white px-4 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[#FF9933]/10">
                    <MessagesSquare className="size-6 text-[#FF9933]" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#1a1a3e]">
                    No channels yet
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-[#1a1a3e]/50">
                    Create one channel per party, one per committee, and an
                    organiser-only Announcements channel. Safe to re-run later —
                    it only adds what&apos;s missing.
                  </p>
                  <Button
                    className="mt-4"
                    disabled={pending}
                    onClick={handleSeed}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PlusCircle className="size-4" />
                    )}
                    Create channels
                  </Button>
                </div>
              ) : (
                <>
                  {/* Organiser announcement composer (GAP 2) — announcements
                      are read-only for students; this is the only post path. */}
                  {(() => {
                    const annCh = channels.find(
                      (c) => c.kind === "announcement"
                    );
                    if (!annCh) return null;
                    return (
                      <div className="space-y-2 rounded-xl border border-[#1a1a3e]/5 bg-white px-3 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Megaphone className="size-4 text-[#FF9933]" />
                          <span className="text-sm font-medium text-[#1a1a3e]">
                            Post an announcement
                          </span>
                          <span className="text-[10px] text-[#1a1a3e]/40">
                            students can read but not reply
                          </span>
                        </div>
                        <textarea
                          value={announcementDraft}
                          onChange={(e) => setAnnouncementDraft(e.target.value)}
                          rows={2}
                          maxLength={2000}
                          placeholder="Write an announcement for all participants…"
                          className="w-full resize-none rounded-lg border border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
                        />
                        <div className="flex items-center justify-between gap-2">
                          {announcementNotice ? (
                            <span className="text-xs text-[#138808]">
                              {announcementNotice}
                            </span>
                          ) : (
                            <span />
                          )}
                          <Button
                            size="sm"
                            disabled={pending || !announcementDraft.trim()}
                            onClick={() => handlePostAnnouncement(annCh.id)}
                          >
                            {pending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                            Post
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Idempotent top-up after new parties/committees appear. */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={handleSeed}
                    >
                      <PlusCircle className="size-3.5" /> Create missing
                      channels
                    </Button>
                  </div>
                </>
              )}

              {channels.length > 0 &&
                channels.map((ch) => {
                  const Icon = KIND_ICON[ch.kind];
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center gap-3 rounded-xl border border-[#1a1a3e]/5 bg-white px-3 py-3 shadow-sm"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#FF9933]/10 text-[#FF9933]">
                        <Icon className="size-4.5" />
                      </span>
                      <button
                        onClick={() => setThread({ kind: "channel", channel: ch })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[#1a1a3e]">
                            {ch.name}
                          </span>
                          {ch.frozenAt && (
                            <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600">
                              <Snowflake className="size-3" />
                              Frozen
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-[#1a1a3e]/40">
                          {ch.kind} · {ch.messageCount} message
                          {ch.messageCount === 1 ? "" : "s"}
                        </span>
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          act(() =>
                            ch.frozenAt
                              ? unfreezeChannel(eventId, ch.id)
                              : freezeChannel(eventId, ch.id)
                          )
                        }
                      >
                        {ch.frozenAt ? (
                          <>
                            <Play className="size-3.5" /> Unfreeze
                          </>
                        ) : (
                          <>
                            <Snowflake className="size-3.5" /> Freeze
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}

          {tab === "reported" && (
            <div className="space-y-2">
              {reported.length === 0 ? (
                <Empty text="No reported messages. Student reports land here." />
              ) : (
                reported.map((m) => (
                  <MessageRow
                    key={m.id}
                    message={m}
                    pending={pending}
                    onDelete={() => act(() => deleteMessage(m.id))}
                    onMute={
                      m.senderParticipantId
                        ? () =>
                            act(() =>
                              muteStudent(
                                eventId,
                                m.senderParticipantId as string,
                                "Reported message"
                              )
                            )
                        : undefined
                    }
                  />
                ))
              )}
            </div>
          )}

          {tab === "dms" && (
            <div className="space-y-2">
              {dmThreads.length === 0 ? (
                <Empty text="No student–YUVA direct messages yet." />
              ) : (
                dmThreads.map((t) => (
                  <button
                    key={`${t.participantId}|${t.volunteerId}`}
                    onClick={() => setThread({ kind: "dm", thread: t })}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#1a1a3e]/5 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:bg-gray-50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#138808]/10 text-[#138808]">
                      <UserCircle2 className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#1a1a3e]">
                        {t.participantName} ↔ {t.volunteerName}
                      </span>
                      <span className="block text-xs text-[#1a1a3e]/40">
                        {t.messageCount} message{t.messageCount === 1 ? "" : "s"}{" "}
                        · last {formatTime(t.lastMessageAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {tab === "muted" && (
            <div className="space-y-2">
              {muted.length === 0 ? (
                <Empty text="No muted students. Mute a sender from a thread or the reported queue." />
              ) : (
                muted.map((m) => (
                  <div
                    key={m.participantId}
                    className="flex items-center gap-3 rounded-xl border border-[#1a1a3e]/5 bg-white px-3 py-3 shadow-sm"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                      <VolumeX className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#1a1a3e]">
                        {m.participantName}
                      </span>
                      <span className="block text-xs text-[#1a1a3e]/40">
                        Muted {formatTime(m.createdAt)}
                        {m.reason ? ` · ${m.reason}` : ""}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        act(() => unmuteStudent(eventId, m.participantId))
                      }
                    >
                      <Volume2 className="size-3.5" /> Unmute
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Thread panel (channel thread or read-only DM thread) ───────

function ThreadPanel({
  eventId,
  view,
  onBack,
  onChanged,
  onMute,
}: {
  eventId: string;
  view: ThreadView;
  onBack: () => void;
  onChanged: () => Promise<void>;
  onMute: (participantId: string) => void;
}) {
  const [messages, setMessages] = useState<ModMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title =
    view.kind === "channel"
      ? view.channel.name
      : `${view.thread.participantName} ↔ ${view.thread.volunteerName}`;
  const subtitle =
    view.kind === "channel"
      ? `${view.channel.kind} channel · includes removed messages`
      : "Student–YUVA direct messages · read-only oversight";

  const refresh = useCallback(async () => {
    const res = await modListMessages(
      eventId,
      view.kind === "channel"
        ? { channelId: view.channel.id }
        : {
            participantId: view.thread.participantId,
            volunteerId: view.thread.volunteerId,
          }
    );
    if (res.success) {
      setMessages(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [eventId, view]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleDelete(messageId: string) {
    startTransition(async () => {
      const res = await deleteMessage(messageId);
      if (!res.success) setError(res.error);
      await refresh();
      await onChanged();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex size-8 items-center justify-center rounded-lg text-[#1a1a3e]/50 hover:bg-[#1a1a3e]/5"
          aria-label="Back to moderation overview"
        >
          <ArrowLeft className="size-4.5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1a1a3e]">
            {title}
          </p>
          <p className="truncate text-xs text-[#1a1a3e]/40">{subtitle}</p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-[#FF9933]" />
        </div>
      ) : messages.length === 0 ? (
        <Empty text="No messages in this thread." />
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              pending={pending}
              onDelete={m.deletedAt ? undefined : () => handleDelete(m.id)}
              onMute={
                m.senderKind === "student" && m.senderParticipantId
                  ? () => onMute(m.senderParticipantId as string)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared message row ─────────────────────────────────────────

function MessageRow({
  message: m,
  pending,
  onDelete,
  onMute,
}: {
  message: ModMessage;
  pending: boolean;
  onDelete?: () => void;
  onMute?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#1a1a3e]/5 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[#1a1a3e]">
          {m.senderName}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-[#1a1a3e]/30">
          {m.senderKind}
        </span>
        {m.channelName && (
          <span className="rounded-full bg-[#FF9933]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF9933]">
            {m.channelName}
          </span>
        )}
        {!m.channelId && (
          <span className="rounded-full bg-[#138808]/10 px-2 py-0.5 text-[10px] font-medium text-[#138808]">
            DM
          </span>
        )}
        {m.reportedAt && (
          <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
            <Flag className="size-2.5" />
            Reported
          </span>
        )}
        {m.deletedAt && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            Removed
          </span>
        )}
        <span className="ml-auto shrink-0 text-[10px] text-[#1a1a3e]/30">
          {formatTime(m.createdAt)}
        </span>
      </div>
      <p
        className={cn(
          "mt-1 text-sm whitespace-pre-wrap break-words",
          m.deletedAt ? "text-[#1a1a3e]/40 line-through" : "text-[#1a1a3e]/80"
        )}
      >
        {m.body}
      </p>
      {(onDelete || onMute) && (
        <div className="mt-2 flex gap-2">
          {onDelete && (
            <Button
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={onDelete}
            >
              <Trash2 className="size-3" /> Remove
            </Button>
          )}
          {onMute && (
            <Button
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={onMute}
            >
              <VolumeX className="size-3" /> Mute sender
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#1a1a3e]/10 bg-white px-4 py-10 text-center text-sm text-[#1a1a3e]/40">
      {text}
    </p>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
