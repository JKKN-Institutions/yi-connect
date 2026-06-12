"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import type { Tables } from "@/types/yip/database";

type VoteSession = Tables<{ schema: "yip" }, "vote_sessions">;

interface VoteTally {
  vote_value: string;
  count: number;
}

interface VoteSessionState {
  session: VoteSession | null;
  isOpen: boolean;
  isClosed: boolean;
  isRevealed: boolean;
  tallies: VoteTally[];
  totalVotes: number;
  loading: boolean;
}

/**
 * useVoteSession - Subscribes to vote_sessions for a given event.
 * Returns real-time session state, status flags, and live tallies (for organizer view).
 */
export function useVoteSession(
  eventId: string,
  options?: { trackVotes?: boolean }
): VoteSessionState {
  const supabase = createClient();
  const [session, setSession] = useState<VoteSession | null>(null);
  const [tallies, setTallies] = useState<VoteTally[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const votesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch the active vote session
  const fetchSession = useCallback(async () => {
    const { data } = await supabase
      .from("vote_sessions")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["open", "closed", "revealed"])
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setSession(data ?? null);
    setLoading(false);

    // If tracking votes and session exists, fetch tallies
    if (options?.trackVotes && data) {
      fetchTallies(data);
    }
  }, [eventId, supabase, options?.trackVotes]);

  // Fetch vote tallies — scoped to THIS session (yip.votes.session_id,
  // migration 20260612100000) so a runoff never counts round-1 ballots.
  // session_id is not in the generated DB types yet (CLI banner corruption
  // blocks regeneration), hence the narrow untyped query.
  const fetchTallies = useCallback(
    async (s: Pick<VoteSession, "id" | "agenda_item_id" | "vote_type">) => {
      type VotesQuery = {
        select: (cols: string) => VotesQuery;
        eq: (col: string, val: string) => VotesQuery;
        is: (col: string, val: null) => VotesQuery;
        then: Promise<{ data: { vote_value: string }[] | null }>["then"];
      };
      const votes_ = (supabase as unknown as { from: (t: string) => VotesQuery })
        .from;

      const { data: scoped } = await votes_("votes")
        .select("vote_value")
        .eq("session_id", s.id);

      let votes = scoped ?? [];

      // LEGACY fallback: pre-migration ballots have session_id NULL. If this
      // session has no scoped ballots, fall back to the old agenda-item query
      // (NULL-session rows only) so historical revealed results don't go blank.
      if (votes.length === 0) {
        const { data: legacy } = await votes_("votes")
          .select("vote_value")
          .eq("agenda_item_id", s.agenda_item_id)
          .eq("vote_type", s.vote_type)
          .is("session_id", null);
        votes = legacy ?? [];
      }

      const tallyMap: Record<string, number> = {};
      votes.forEach((v) => {
        tallyMap[v.vote_value] = (tallyMap[v.vote_value] || 0) + 1;
      });

      const newTallies: VoteTally[] = Object.entries(tallyMap)
        .map(([vote_value, count]) => ({ vote_value, count }))
        .sort((a, b) => b.count - a.count);

      setTallies(newTallies);
      setTotalVotes(votes.length);
    },
    [supabase]
  );

  // Initial fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Subscribe to vote_sessions changes
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`yip:vote-session:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "yip",
          table: "vote_sessions",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const updated = payload.new as VoteSession;
            setSession(updated);

            // Fetch tallies when session changes
            if (options?.trackVotes) {
              fetchTallies(updated);
            }
          }
          if (payload.eventType === "DELETE") {
            setSession(null);
            setTallies([]);
            setTotalVotes(0);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Subscribe to votes table for live counting (organizer only)
  useEffect(() => {
    if (!options?.trackVotes || !session) {
      if (votesChannelRef.current) {
        supabase.removeChannel(votesChannelRef.current);
        votesChannelRef.current = null;
      }
      return;
    }

    if (votesChannelRef.current) {
      supabase.removeChannel(votesChannelRef.current);
    }

    const channel = supabase
      .channel(`yip:votes-live:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "yip",
          table: "votes",
          // Trigger-only: kept on agenda_item_id (not session_id) so it also
          // fires for legacy NULL-session inserts during the migration window.
          // The actual scoping happens inside fetchTallies.
          filter: `agenda_item_id=eq.${session.agenda_item_id}`,
        },
        () => {
          // Re-fetch tallies on new vote
          fetchTallies(session);
        }
      )
      .subscribe();

    votesChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      votesChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, options?.trackVotes]);

  return {
    session,
    isOpen: session?.status === "open",
    isClosed: session?.status === "closed",
    isRevealed: session?.status === "revealed",
    tallies,
    totalVotes,
    loading,
  };
}
