"use client";

/**
 * useLiveThread — WhatsApp-style live message thread for the YIP chat.
 *
 * Why this exists: the original chat/committee threads loaded messages ONCE on
 * open and again only after you sent — so other people's messages never showed
 * up live, and your own send waited for two server round-trips before appearing.
 * This hook fixes both, for both the community chat (app/yip/me/chat) and the
 * committee room discussion (app/yip/me/committee), from one place.
 *
 * What it does:
 *   1. INSTANT SEND (optimistic) — your message appears the moment you send it,
 *      then quietly reconciles with the saved row (or is marked failed).
 *   2. LIVE INCOMING — while the thread is open AND the tab is visible, it polls
 *      for ONLY new messages (created_at >= cursor) every `pollMs`, and fetches
 *      immediately when you switch back to the app. Polling pauses when the tab
 *      is hidden (battery/data) and while a send is in flight (avoids a
 *      momentary self-duplicate).
 *   3. DE-DUP by id — the boundary row repeats on each delta and is merged, so
 *      no message is ever shown twice and none is missed on equal timestamps.
 *
 * Security/architecture is unchanged: it only calls the gated `load`/`send`
 * server actions passed in by the caller; it knows nothing about the schema.
 * True websocket realtime isn't possible here (students authenticate with an
 * access code, not a Supabase Auth JWT, so the DB can't push to them) — a
 * short visibility-aware poll is the safe, low-risk substitute.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatReplyPreview } from "@/app/yip/actions/chat";

/** Optional metadata for an optimistic send (e.g. the reply quote to show now). */
export interface SendMeta {
  replyToId?: string | null;
  replyPreview?: ChatReplyPreview | null;
  mentions?: string[];
}

type LoadResult =
  | { success: true; data: ChatMessage[] }
  | { success: false; error: string };
type SendResult =
  | { success: true; data: ChatMessage }
  | { success: false; error: string };

export interface LiveThreadMessage extends ChatMessage {
  /** Optimistic message not yet confirmed by the server. */
  pending?: boolean;
  /** Optimistic message whose send failed (kept visible so nothing is lost). */
  failed?: boolean;
}

export interface UseLiveThreadOptions {
  /**
   * Stable identity of the thread (e.g. the channel id, or
   * `${channelId}:${threadKey}`). Changing it resets and reloads from scratch.
   * Required because callers usually pass freshly-created `load`/`send` closures
   * on every render, so the closure identity can't be the reset trigger.
   */
  threadId: string;
  participantId: string;
  /** Full load when called with no cursor; delta load when given an ISO cursor. */
  load: (afterIso?: string) => Promise<LoadResult>;
  /** Send a message; meta carries the reply anchor when replying. */
  send: (body: string, meta?: SendMeta) => Promise<SendResult>;
  /** Poll cadence (ms) for new messages while open + visible. Default 3500. */
  pollMs?: number;
  /** Set false to stop the thread entirely (e.g. a closed dialog). Default true. */
  enabled?: boolean;
}

export interface UseLiveThread {
  /** Confirmed messages (oldest→newest) followed by any optimistic ones. */
  messages: LiveThreadMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  /** Send a message; pass meta to show a reply quote on the optimistic bubble. */
  sendMessage: (body: string, meta?: SendMeta) => void;
  /** Patch one already-loaded message in place (e.g. after a reaction toggle). */
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void;
}

function mergeById(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of base) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  );
}

export function useLiveThread({
  threadId,
  participantId,
  load,
  send,
  pollMs = 3500,
  enabled = true,
}: UseLiveThreadOptions): UseLiveThread {
  const [confirmed, setConfirmed] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<LiveThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Refs so the polling interval reads fresh values without re-subscribing.
  const confirmedRef = useRef<ChatMessage[]>([]);
  const sendingRef = useRef(false);
  const inFlightRef = useRef(false);
  const loadRef = useRef(load);
  const sendRef = useRef(send);
  loadRef.current = load;
  sendRef.current = send;

  const applyConfirmed = useCallback((rows: ChatMessage[], replace: boolean) => {
    setConfirmed((prev) => {
      const next = mergeById(replace ? [] : prev, rows);
      confirmedRef.current = next;
      return next;
    });
  }, []);

  const fetchMessages = useCallback(
    async (full: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const c = confirmedRef.current;
        const cursor = full || c.length === 0 ? undefined : c[c.length - 1].createdAt;
        const res = await loadRef.current(cursor);
        if (res.success) {
          applyConfirmed(res.data, full);
          setError(null);
        } else if (full) {
          // Only surface the initial-load failure; transient delta failures
          // are silent and the next tick retries.
          setError(res.error);
        }
      } finally {
        inFlightRef.current = false;
        if (full) setLoading(false);
      }
    },
    [applyConfirmed]
  );

  // Initial load + hard reset whenever the thread identity (its load fn) or
  // enabled state changes. A new `load` closure ⇒ a different channel/thread.
  useEffect(() => {
    confirmedRef.current = [];
    setConfirmed([]);
    setPending([]);
    setError(null);
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMessages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, enabled]);

  // Visibility-aware polling for new messages.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (sendingRef.current) return;
      fetchMessages(false);
    };
    const id = setInterval(tick, pollMs);
    const onForeground = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (sendingRef.current) return;
      fetchMessages(false);
    };
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, [enabled, pollMs, fetchMessages]);

  const patchMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setConfirmed((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
        confirmedRef.current = next;
        return next;
      });
      setPending((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const sendMessage = useCallback(
    (raw: string, meta?: SendMeta) => {
      const body = raw.trim();
      if (!body || sendingRef.current) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: LiveThreadMessage = {
        id: tempId,
        channelId: null,
        senderKind: "student",
        senderParticipantId: participantId,
        senderVolunteerId: null,
        body,
        dmToVolunteerId: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        replyToId: meta?.replyToId ?? null,
        replyPreview: meta?.replyPreview ?? null,
        reactions: [],
        pinnedAt: null,
        mentions: [],
        pending: true,
      };
      setPending((prev) => [...prev, optimistic]);
      setSending(true);
      sendingRef.current = true;

      void (async () => {
        try {
          const res = await sendRef.current(body, meta);
          if (res.success) {
            // Drop the optimistic copy and merge in the real saved row.
            setPending((prev) => prev.filter((m) => m.id !== tempId));
            applyConfirmed([res.data], false);
          } else {
            setPending((prev) =>
              prev.map((m) =>
                m.id === tempId ? { ...m, pending: false, failed: true } : m
              )
            );
            setError(res.error);
          }
        } catch {
          setPending((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, pending: false, failed: true } : m
            )
          );
          setError("Couldn't send. Check your connection and try again.");
        } finally {
          setSending(false);
          sendingRef.current = false;
        }
      })();
    },
    [participantId, applyConfirmed]
  );

  return {
    messages: [...confirmed, ...pending],
    loading,
    error,
    sending,
    sendMessage,
    patchMessage,
  };
}
