"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createClient } from "@/lib/yi-future/supabase/client";
import { sendMessage, type Message, type SenderType } from "@/app/yi-future/actions/messages";

type CurrentSender = {
  type: SenderType;
  id: string;
  name: string;
};

type Props = {
  threadId: string;
  currentSender: CurrentSender;
  initialMessages: Message[];
};

type RowState = Message & { pending?: boolean; failed?: boolean };

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Thread({ threadId, currentSender, initialMessages }: Props) {
  const [rows, setRows] = useState<RowState[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Schedule after paint so we measure the new height
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // ─── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channelName = `messages:thread:${threadId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "future",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const m = payload.new as {
            id: string;
            thread_id: string;
            sender_type: SenderType;
            sender_id: string;
            body: string;
            created_at: string;
          };

          setRows((prev) => {
            // Skip if this is our own optimistic message that already landed
            if (prev.some((r) => r.id === m.id)) return prev;

            // If this is OUR own message coming back through realtime,
            // try to reconcile any optimistic placeholder by sender + body match
            if (
              m.sender_type === currentSender.type &&
              m.sender_id === currentSender.id
            ) {
              const idx = prev.findIndex(
                (r) =>
                  r.pending &&
                  r.body === m.body &&
                  r.sender_type === m.sender_type
              );
              if (idx >= 0) {
                const next = prev.slice();
                next[idx] = {
                  id: m.id,
                  thread_id: m.thread_id,
                  sender_type: m.sender_type,
                  sender_id: m.sender_id,
                  body: m.body,
                  created_at: m.created_at,
                  sender_name: currentSender.name,
                };
                return next;
              }
            }

            return [
              ...prev,
              {
                id: m.id,
                thread_id: m.thread_id,
                sender_type: m.sender_type,
                sender_id: m.sender_id,
                body: m.body,
                created_at: m.created_at,
                sender_name:
                  m.sender_type === currentSender.type &&
                  m.sender_id === currentSender.id
                    ? currentSender.name
                    : m.sender_type === "mentor"
                      ? "Mentor"
                      : "Delegate",
              },
            ];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, currentSender.type, currentSender.id, currentSender.name, scrollToBottom]);

  // ─── Send handler ──────────────────────────────────────────────
  const handleSend = useCallback(
    async (raw: string) => {
      const body = raw.trim();
      if (!body) return;
      if (body.length > 2000) {
        setError("Message too long (max 2000).");
        return;
      }

      setError(null);
      setSending(true);

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic: RowState = {
        id: tempId,
        thread_id: threadId,
        sender_type: currentSender.type,
        sender_id: currentSender.id,
        sender_name: currentSender.name,
        body,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setRows((prev) => [...prev, optimistic]);
      setDraft("");
      scrollToBottom();

      const res = await sendMessage(threadId, body);

      if (!res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === tempId ? { ...r, pending: false, failed: true } : r
          )
        );
        setError(res.error);
        setSending(false);
        return;
      }

      const real = res.data!;
      setRows((prev) => {
        // If realtime already replaced our optimistic, don't double-add
        if (prev.some((r) => r.id === real.id)) {
          return prev.filter((r) => r.id !== tempId);
        }
        return prev.map((r) =>
          r.id === tempId
            ? {
                ...real,
                pending: false,
              }
            : r
        );
      });
      setSending(false);
      scrollToBottom();
    },
    [threadId, currentSender.type, currentSender.id, currentSender.name, scrollToBottom]
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    void handleSend(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) void handleSend(draft);
    }
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-[60vh] bg-white border border-navy/10 rounded-lg overflow-hidden">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-ivory/40"
      >
        {rows.length === 0 && (
          <p className="text-center text-xs text-navy/50 italic py-8">
            No messages yet. Say hi.
          </p>
        )}
        {rows.map((m) => {
          const mine =
            m.sender_type === currentSender.type &&
            m.sender_id === currentSender.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm ${
                  mine
                    ? "bg-navy text-ivory rounded-br-sm"
                    : "bg-white text-navy border border-navy/10 rounded-bl-sm"
                }`}
              >
                {!mine && (
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-navy/50 mb-0.5">
                    {m.sender_name}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div
                  className={`mt-0.5 text-[10px] ${
                    mine ? "text-ivory/60" : "text-navy/40"
                  }`}
                >
                  {m.pending
                    ? "Sending…"
                    : m.failed
                      ? "Failed — try again"
                      : formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-navy/10 bg-white px-3 py-2 flex items-end gap-2"
      >
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
          maxLength={2000}
          className="flex-1 resize-none rounded-md border border-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yi-gold/40 max-h-32"
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && (
        <div className="px-3 py-1 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
