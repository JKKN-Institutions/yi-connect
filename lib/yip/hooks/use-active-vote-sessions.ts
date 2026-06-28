"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import type { Tables } from "@/types/yip/database";
import { getSessionVoteCounts } from "@/app/yip/actions/voting";

type VoteSession = Tables<{ schema: "yip" }, "vote_sessions">;

export interface ActiveVoteSession {
  session: VoteSession;
  /** Raw ballots cast against this session (turnout indicator). */
  totalVotes: number;
}

/**
 * useActiveVoteSessions — every active (open / closed / revealed) vote session
 * for an event, with a live per-session ballot count. Used by the control panel
 * to manage several party-leader elections running in PARALLEL, where the
 * single-session useVoteSession hook isn't enough.
 */
export function useActiveVoteSessions(eventId: string): {
  sessions: ActiveVoteSession[];
  loading: boolean;
} {
  const supabase = createClient();
  const [sessions, setSessions] = useState<ActiveVoteSession[]>([]);
  const [loading, setLoading] = useState(true);
  // Whether any session is OPEN — drives live turnout polling.
  const [hasOpen, setHasOpen] = useState(false);

  // Only the latest fetch may commit (guards out-of-order refetches).
  const seqRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const mySeq = ++seqRef.current;
    const { data: rows } = await supabase
      .from("vote_sessions")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["open", "closed", "revealed"])
      .order("opened_at", { ascending: false })
      .limit(100);
    const all = rows ?? [];

    // Live turnout counts: yip.votes RLS hides ballots until a session is
    // REVEALED (secret ballot), so a client-side read of an OPEN election always
    // returns 0. Count via the organiser-gated server action, which uses the
    // service role and returns ONLY the per-session count (never the ballots).
    // Only OPEN sessions need a live count.
    const openIds = all
      .filter((s) => s.status === "open")
      .map((s) => s.id);
    let counts: Record<string, number> = {};
    if (openIds.length > 0) {
      const res = await getSessionVoteCounts(eventId, openIds);
      if (res.success) counts = res.data;
    }

    if (mySeq !== seqRef.current) return; // superseded by a newer fetch

    setSessions(
      all.map((s) => ({ session: s, totalVotes: counts[s.id] ?? 0 }))
    );
    setHasOpen(openIds.length > 0);
    setLoading(false);
  }, [eventId, supabase]);

  const fetchRef = useRef(fetchAll);
  useEffect(() => {
    fetchRef.current = fetchAll;
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: refetch on any session status change (open/close/reveal). Ballot
  // INSERTs are NOT subscribed — yip.votes RLS gives the organiser no realtime
  // events for unrevealed ballots, so live turnout is driven by polling below.
  useEffect(() => {
    const channel = supabase
      .channel(`yip:active-votes:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "yip",
          table: "vote_sessions",
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Live turnout poll while any election is OPEN. Pauses when the tab is hidden
  // and when nothing is open, so it costs nothing outside an active vote.
  useEffect(() => {
    if (!hasOpen) return;
    const tick = () => {
      if (typeof document === "undefined" || !document.hidden) {
        fetchRef.current();
      }
    };
    const id = setInterval(tick, 3500);
    return () => clearInterval(id);
  }, [hasOpen]);

  return { sessions, loading };
}
