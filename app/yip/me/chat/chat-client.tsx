"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Users,
  Megaphone,
  Landmark,
  UserCircle2,
  Loader2,
  Flag,
  PauseCircle,
} from "lucide-react";
import { Button } from "@/components/yip/ui/button";
import { cn } from "@/lib/yip/utils";
import { useLiveThread } from "@/lib/yip/use-live-thread";
import {
  ReplyQuote,
  ReactionChips,
  MessageActions,
  PinnedBanner,
  ChannelSearch,
  MentionInput,
  MessageBody,
} from "@/components/yip/chat-message-extras";
import {
  SectionShell,
  SectionHeading,
  INK,
  SAFFRON,
  GREEN,
  SERIF,
  inkA,
} from "../credential-ui";
import {
  listChannels,
  listMessages,
  postChannelMessage,
  postDmToYuva,
  listYuvaContacts,
  reportMessage,
  toggleReaction,
  listPinnedMessages,
  searchMessages,
  listChannelMembers,
  type ChatChannel,
  type ChatMessage,
  type ChatMember,
  type ChatReplyPreview,
  type YuvaContact,
} from "@/app/yip/actions/chat";

interface ChatClientProps {
  eventId: string;
  participantId: string;
  participantName: string;
  /**
   * Deep-link target. When set (e.g. arriving from the /yip/me announcements
   * strip with ?channel=announcement), the matching channel opens directly once
   * channels load, instead of landing on the channel list. One-shot: if the
   * user navigates Back to the list we don't re-open it.
   */
  openChannelKind?: ChatChannel["kind"];
}

type View =
  | { kind: "list" }
  | { kind: "channel"; channel: ChatChannel }
  | { kind: "dm"; volunteer: YuvaContact };

const KIND_ICON: Record<ChatChannel["kind"], typeof Users> = {
  party: Landmark,
  committee: Users,
  announcement: Megaphone,
};

export function ChatClient({
  eventId,
  participantId,
  participantName,
  openChannelKind,
}: ChatClientProps) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [yuvas, setYuvas] = useState<YuvaContact[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const didDeepLink = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingList(true);
      const [chRes, yuvaRes] = await Promise.all([
        listChannels(eventId, participantId),
        listYuvaContacts(participantId),
      ]);
      if (!active) return;
      if (chRes.success) setChannels(chRes.data);
      else setListError(chRes.error);
      if (yuvaRes.success) setYuvas(yuvaRes.data);
      setLoadingList(false);
    })();
    return () => {
      active = false;
    };
  }, [eventId, participantId]);

  // Deep-link: open the requested channel directly once channels have loaded.
  // One-shot so a user who taps Back to the list isn't yanked back in.
  useEffect(() => {
    if (didDeepLink.current || !openChannelKind || channels.length === 0) return;
    const target = channels.find((c) => c.kind === openChannelKind);
    if (target) {
      didDeepLink.current = true;
      setView({ kind: "channel", channel: target });
    }
  }, [channels, openChannelKind]);

  const report = (messageId: string) =>
    reportMessage({ participantId, eventId, messageId });

  if (view.kind === "channel") {
    return (
      <Thread
        title={view.channel.name}
        subtitle={labelForKind(view.channel.kind)}
        threadId={`channel:${view.channel.id}`}
        participantId={participantId}
        onBack={() => setView({ kind: "list" })}
        load={(afterIso) =>
          listMessages({ channelId: view.channel.id, participantId, afterIso })
        }
        send={(body, meta) =>
          postChannelMessage({
            participantId,
            channelId: view.channel.id,
            body,
            replyToId: meta?.replyToId ?? null,
            mentions: meta?.mentions ?? [],
          })
        }
        loadPinned={() =>
          listPinnedMessages({ channelId: view.channel.id, participantId })
        }
        loadMembers={async () => {
          const r = await listChannelMembers({
            channelId: view.channel.id,
            participantId,
          });
          return r.success ? r.data : [];
        }}
        search={async (query) => {
          const r = await searchMessages({
            channelId: view.channel.id,
            query,
            participantId,
          });
          return r.success ? r.data : [];
        }}
        canReply
        // Announcements are read-only for students — organisers broadcast,
        // students listen. The server rejects student posts regardless; this
        // hides the composer so nobody hits that error.
        readOnlyNote={
          view.channel.kind === "announcement"
            ? "Announcements are read-only. Only organisers can post here."
            : undefined
        }
        onReport={report}
      />
    );
  }

  if (view.kind === "dm") {
    return (
      <Thread
        title={view.volunteer.name}
        subtitle="YUVA mentor · private message"
        threadId={`dm:${view.volunteer.volunteerId}`}
        participantId={participantId}
        onBack={() => setView({ kind: "list" })}
        load={(afterIso) =>
          listMessages({
            dmWithVolunteerId: view.volunteer.volunteerId,
            participantId,
            afterIso,
          })
        }
        send={(body) =>
          postDmToYuva(participantId, view.volunteer.volunteerId, body)
        }
        onReport={report}
      />
    );
  }

  // ── List view ──
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF9933] to-[#138808]">
          <MessageSquare className="size-5 text-white" />
        </div>
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            The House Floor
          </p>
          <h1 className="text-base font-semibold" style={{ ...SERIF, color: INK }}>
            Community chat
          </h1>
          <p className="text-xs" style={{ color: inkA(0.55) }}>
            Signed in as {participantName}
          </p>
        </div>
      </div>

      {loadingList ? (
        <SectionShell>
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-[#FF9933]" />
          </div>
        </SectionShell>
      ) : (
        <>
          {listError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {listError}
            </p>
          )}

          {/* Channels */}
          <SectionShell accent={SAFFRON}>
            <div className="space-y-2 px-4 py-3">
            <SectionHeading
              eyebrow="Where the House meets"
              title="Channels"
              icon={MessageSquare}
              accent={SAFFRON}
            />
            {channels.length === 0 ? (
              <p className="text-sm text-gray-400">No channels yet.</p>
            ) : (
              channels.map((ch) => {
                const Icon = KIND_ICON[ch.kind];
                return (
                  <button
                    key={ch.id}
                    onClick={() => setView({ kind: "channel", channel: ch })}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[#FF9933]/10 text-[#FF9933]">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {ch.name}
                      </span>
                      <span className="block text-xs text-gray-400">
                        {labelForKind(ch.kind)}
                      </span>
                    </span>
                    {ch.frozenAt && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        <PauseCircle className="size-3" />
                        Paused
                      </span>
                    )}
                  </button>
                );
              })
            )}
            </div>
          </SectionShell>

          {/* YUVA mentors */}
          <SectionShell accent={GREEN}>
            <div className="space-y-2 px-4 py-3">
            <SectionHeading
              eyebrow="Private line"
              title="Message a YUVA mentor"
              icon={UserCircle2}
              accent={GREEN}
            />
            {yuvas.length === 0 ? (
              <p className="text-sm text-gray-400">
                No YUVA mentors available yet.
              </p>
            ) : (
              yuvas.map((v) => (
                <button
                  key={v.volunteerId}
                  onClick={() => setView({ kind: "dm", volunteer: v })}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-3 text-left transition-colors hover:bg-gray-50"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-[#138808]/10 text-[#138808]">
                    <UserCircle2 className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {v.name}
                  </span>
                </button>
              ))
            )}
            </div>
          </SectionShell>

          <p className="pt-2 text-center text-[11px] leading-relaxed text-gray-400">
            You can post in channels and privately message a YUVA mentor.
            Student-to-student private messages are not available.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Thread view (channel OR DM) ────────────────────────────────

interface ThreadProps {
  title: string;
  subtitle: string;
  /** Stable identity of this thread (channel:<id> or dm:<volunteerId>). */
  threadId: string;
  participantId: string;
  onBack: () => void;
  load: (
    afterIso?: string
  ) => Promise<
    | { success: true; data: ChatMessage[] }
    | { success: false; error: string }
  >;
  send: (
    body: string,
    meta?: {
      replyToId?: string | null;
      replyPreview?: ChatReplyPreview | null;
      mentions?: string[];
    }
  ) => Promise<
    | { success: true; data: ChatMessage }
    | { success: false; error: string }
  >;
  /** Allow replying to messages (channels only — DMs don't support reply). */
  canReply?: boolean;
  /** Load pinned messages for the channel banner (channels only). */
  loadPinned?: () => Promise<
    | { success: true; data: ChatMessage[] }
    | { success: false; error: string }
  >;
  /** Load mentionable members for the @-picker (channels only). */
  loadMembers?: () => Promise<ChatMember[]>;
  /** Search messages in this channel (channels only). */
  search?: (query: string) => Promise<ChatMessage[]>;
  /** When set, the composer is replaced by this read-only note. */
  readOnlyNote?: string;
  /** Report a message to the organisers (hidden on the student's own messages). */
  onReport?: (
    messageId: string
  ) => Promise<{ success: true; data: null } | { success: false; error: string }>;
}

function Thread({
  title,
  subtitle,
  threadId,
  participantId,
  onBack,
  load,
  send,
  canReply,
  loadPinned,
  loadMembers,
  search,
  readOnlyNote,
  onReport,
}: ThreadProps) {
  const [draft, setDraft] = useState("");
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadPinned) {
      setPinned([]);
      return;
    }
    let active = true;
    loadPinned().then((r) => {
      if (active && r.success) setPinned(r.data);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (!loadMembers) {
      setMembers([]);
      return;
    }
    let active = true;
    loadMembers().then((list) => {
      if (active) setMembers(list);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Live thread: instant optimistic send + visibility-aware polling for new
  // messages (see lib/yip/use-live-thread). Replaces the old load-once model.
  const { messages, loading, error, sending, sendMessage, patchMessage } =
    useLiveThread({
      threadId,
      participantId,
      load,
      send,
    });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function previewOf(m: ChatMessage): ChatReplyPreview {
    const mine =
      m.senderKind === "student" && m.senderParticipantId === participantId;
    return {
      id: m.id,
      senderName: mine ? "You" : senderLabel(m.senderKind),
      body: m.body,
      deleted: false,
    };
  }

  function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    const liveMentions = mentionIds.filter((id) => {
      const first = members.find((mm) => mm.id === id)?.name.split(" ")[0];
      return first ? body.includes(`@${first}`) : false;
    });
    const meta = {
      replyToId: replyingTo?.id ?? null,
      replyPreview: replyingTo ? previewOf(replyingTo) : null,
      mentions: liveMentions,
    };
    setDraft("");
    setReplyingTo(null);
    setMentionIds([]);
    sendMessage(body, meta);
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    const res = await toggleReaction({ messageId, emoji, participantId });
    if (res.success) patchMessage(messageId, { reactions: res.data });
  }

  async function handleReport(messageId: string) {
    if (!onReport || reportedIds.has(messageId)) return;
    const res = await onReport(messageId);
    if (res.success) {
      setReportedIds((prev) => new Set(prev).add(messageId));
    }
  }

  const visible = messages.filter((m) => !m.deletedAt);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      {/* Thread header */}
      <div className="space-y-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="size-4.5" />
          </button>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: SAFFRON }}
            >
              {subtitle}
            </p>
            <p
              className="truncate text-sm font-semibold"
              style={{ ...SERIF, color: INK }}
            >
              {title}
            </p>
          </div>
          {search && (
            <ChannelSearch
              onSearch={search}
              nameOf={(m) =>
                m.senderKind === "student" &&
                m.senderParticipantId === participantId
                  ? "You"
                  : senderLabel(m.senderKind)
              }
            />
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2.5 overflow-y-auto py-4">
        <PinnedBanner pinned={pinned} />
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-[#FF9933]" />
          </div>
        ) : visible.length === 0 ? (
          <SectionShell>
            <p className="py-10 text-center text-sm" style={{ color: inkA(0.45) }}>
              No messages yet. Say hello.
            </p>
          </SectionShell>
        ) : (
          visible.map((m) => {
            const mine =
              m.senderKind === "student" &&
              m.senderParticipantId === participantId;
            const reported = reportedIds.has(m.id);
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "bg-[#FF9933] text-white"
                      : m.senderKind === "yuva"
                        ? "bg-[#138808]/10 text-gray-900"
                        : "bg-gray-100 text-gray-900",
                    m.pending && "opacity-70"
                  )}
                >
                  {!mine && (
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide opacity-60">
                      {senderLabel(m.senderKind)}
                    </span>
                  )}
                  {m.replyPreview && (
                    <ReplyQuote
                      preview={m.replyPreview}
                      tone={mine ? "accent" : "light"}
                    />
                  )}
                  <span className="whitespace-pre-wrap break-words">
                    <MessageBody
                      body={m.body}
                      mentionsMe={!mine && m.mentions.includes(participantId)}
                    />
                  </span>
                  {mine && (m.pending || m.failed) && (
                    <span
                      className={cn(
                        "mt-0.5 block text-right text-[10px]",
                        m.failed ? "text-red-100" : "text-white/70"
                      )}
                    >
                      {m.failed ? "Not sent — tap send to retry" : "Sending…"}
                    </span>
                  )}
                  <ReactionChips
                    reactions={m.reactions}
                    onToggle={(emoji) => handleToggleReaction(m.id, emoji)}
                    disabled={m.pending || m.failed}
                  />
                  {!(m.pending || m.failed) && (
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-2",
                        mine ? "justify-end" : "justify-between"
                      )}
                    >
                      <MessageActions
                        tone={mine ? "accent" : "light"}
                        align={mine ? "end" : "start"}
                        onReply={canReply ? () => setReplyingTo(m) : undefined}
                        onReact={(emoji) => handleToggleReaction(m.id, emoji)}
                      />
                      {!mine && onReport && (
                        reported ? (
                          <span className="text-[10px] font-medium text-gray-400">
                            Reported
                          </span>
                        ) : (
                          <button
                            onClick={() => handleReport(m.id)}
                            className="flex items-center gap-1 text-[10px] text-gray-400 transition-colors hover:text-red-500"
                            aria-label="Report this message"
                          >
                            <Flag className="size-2.5" />
                            Report
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Composer (or a read-only note for announcement channels) */}
      {readOnlyNote ? (
        <p className="flex items-center justify-center gap-1.5 border-t border-gray-100 pt-3 pb-1 text-center text-xs text-gray-400">
          <Megaphone className="size-3.5 shrink-0" />
          {readOnlyNote}
        </p>
      ) : (
      <div className="border-t border-gray-100 pt-3">
        {replyingTo && (
          <div className="mb-2">
            <ReplyQuote
              preview={previewOf(replyingTo)}
              onCancel={() => setReplyingTo(null)}
            />
          </div>
        )}
        <div className="flex items-end gap-2">
        {canReply && members.length > 0 ? (
          <MentionInput
            value={draft}
            onChange={setDraft}
            members={members}
            onAddMention={(id) =>
              setMentionIds((prev) =>
                prev.includes(id) ? prev : [...prev, id]
              )
            }
            onSubmit={handleSend}
            placeholder="Type a message… (@ to mention)"
          />
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Type a message…"
            className="max-h-32 flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
          />
        )}
        <Button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="size-10 shrink-0 rounded-xl bg-[#FF9933] p-0 hover:bg-[#E68A2E]"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
        </div>
      </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function labelForKind(kind: ChatChannel["kind"]): string {
  switch (kind) {
    case "party":
      return "Party channel";
    case "committee":
      return "Committee channel";
    case "announcement":
      return "Announcements";
  }
}

function senderLabel(kind: ChatMessage["senderKind"]): string {
  switch (kind) {
    case "student":
      return "Student";
    case "yuva":
      return "YUVA mentor";
    case "admin":
      return "Organiser";
  }
}
