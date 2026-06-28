"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import type { Tables } from "@/types/yip/database";

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

  const fetchAll = useCallback(async () => {
    const { data: rows } = await supabase
      .from("vote_sessions")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["open", "closed", "revealed"])
      .order("opened_at", { ascending: false })
      .limit(100);
    const all = rows ?? [];

    // Per-session ballot counts. session_id is not in the generated DB types
    // yet (CLI banner corruption), so use a narrow untyped accessor — same
    // pattern as use-vote-session.ts.
    const ids = all.map((s) => s.id);
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      type VotesQuery = {
        select: (c: string) => VotesQuery;
        in: (c: string, v: string[]) => VotesQuery;
        then: Promise<{ data: { session_id: string | null }[] | null }>["then"];
      };
      const votesClient = supabase as unknown as {
        from: (t: string) => VotesQuery;
      };
      const { data: votes } = await votesClient
        .from("votes")
        .select("session_id")
        .in("session_id", ids);
      (votes ?? []).forEach((v) => {
        if (v.session_id) counts[v.session_id] = (counts[v.session_id] ?? 0) + 1;
      });
    }

    setSessions(
      all.map((s) => ({ session: s, totalVotes: counts[s.id] ?? 0 }))
    );
    setLoading(false);
  }, [eventId, supabase]);

  const fetchRef = useRef(fetchAll);
  useEffect(() => {
    fetchRef.current = fetchAll;
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: refetch on any session change for this event, or any new ballot.
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "yip", table: "votes" },
        () => fetchRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return { sessions, loading };
}
