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

  // Only the latest fetch may commit (guards out-of-order refetches).
  const seqRef = useRef(0);
  // Current session ids, so the (unfilterable) votes subscription can ignore
  // ballots belonging to OTHER events.
  const idsRef = useRef<string[]>([]);

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
    idsRef.current = all.map((s) => s.id);

    // Live counts are shown only for OPEN sessions, so count only those — keeps
    // the query small and well under the PostgREST ~1000-row cap even late in an
    // event (closed/revealed sessions would otherwise accumulate thousands of
    // ballots and undercount). session_id is not in the generated DB types yet,
    // so use a narrow untyped accessor — same pattern as use-vote-session.ts.
    const openIds = all
      .filter((s) => s.status === "open")
      .map((s) => s.id);
    const counts: Record<string, number> = {};
    if (openIds.length > 0) {
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
        .in("session_id", openIds);
      (votes ?? []).forEach((v) => {
        if (v.session_id) counts[v.session_id] = (counts[v.session_id] ?? 0) + 1;
      });
    }

    if (mySeq !== seqRef.current) return; // superseded by a newer fetch

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
        (payload) => {
          // votes has no event_id to filter on server-side, so ignore ballots
          // that don't belong to one of THIS event's sessions (avoids a
          // refetch storm from other chapters' concurrent events).
          const sid = (payload.new as { session_id?: string | null })
            ?.session_id;
          if (sid && idsRef.current.includes(sid)) fetchRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return { sessions, loading };
}
