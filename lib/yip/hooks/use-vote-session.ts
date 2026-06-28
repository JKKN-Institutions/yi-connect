"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import type { Tables } from "@/types/yip/database";
import {
  sessionAppliesToViewer,
  isParallelKind,
  type ViewerScope,
} from "@/lib/yip/vote-scope";

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
  options?: {
    trackVotes?: boolean;
    /**
     * Participant mode. When provided, the hook returns the single OPEN/closed/
     * revealed session that applies to THIS voter (their party's election, a
     * bench vote for their side, or any House-wide vote). Fails closed: party/
     * bench ballots stay hidden until the viewer's party/side is known (pass a
     * loaded scope, or `null` while loading).
     */
    viewer?: ViewerScope | null;
    /**
     * Control mode. Ignore parallel (party-leader) elections so the main panel
     * only drives the one-at-a-time votes (Speaker / Bill / bench / cabinet /
     * shadow); parallel party-leader elections are managed per party via
     * useActiveVoteSessions.
     */
    excludeParallel?: boolean;
  }
): VoteSessionState {
  const supabase = createClient();
  const hasViewer = options?.viewer !== undefined;
  const viewerPartyId = options?.viewer?.partyId ?? null;
  const viewerSide = options?.viewer?.side ?? null;
  const excludeParallel = options?.excludeParallel ?? false;
  const [session, setSession] = useState<VoteSession | null>(null);
  const [tallies, setTallies] = useState<VoteTally[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const votesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Monotonic token: on the participant screen the viewer loads async, so an
  // early (null-viewer) fetch and the later (loaded-viewer) fetch race. Only the
  // most recent fetch may commit, else a stale null-viewer result could clobber
  // the loaded one and strand a voter on an empty ballot for their own election.
  const seqRef = useRef(0);

  // Fetch the vote session that applies to this consumer. Several party
  // elections can be open at once, so we fetch them all and pick the relevant
  // one (per-viewer, House-wide-only, or plain latest).
  const fetchSession = useCallback(async () => {
    const mySeq = ++seqRef.current;
    const { data: rows } = await supabase
      .from("vote_sessions")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["open", "closed", "revealed"])
      .order("opened_at", { ascending: false })
      .limit(100);

    if (mySeq !== seqRef.current) return; // a newer fetch superseded this one

    const all = rows ?? [];
    let picked: VoteSession | null;
    if (hasViewer) {
      picked =
        all.find((s) =>
          sessionAppliesToViewer(
            { vote_type: s.vote_type, config: s.config },
            { partyId: viewerPartyId, side: viewerSide }
          )
        ) ?? null;
    } else if (excludeParallel) {
      picked = all.find((s) => !isParallelKind(s.vote_type)) ?? null;
    } else {
      picked = all[0] ?? null;
    }

    setSession(picked);
    setLoading(false);

    if (options?.trackVotes) {
      if (picked) {
        fetchTallies(picked);
      } else {
        setTallies([]);
        setTotalVotes(0);
      }
    }
  }, [
    eventId,
    supabase,
    options?.trackVotes,
    hasViewer,
    viewerPartyId,
    viewerSide,
    excludeParallel,
  ]);

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
      // NOTE: keep `from` bound to the client — assigning the bare method and
      // calling it detached loses `this` and throws "Cannot read properties of
      // undefined (reading 'rest')" at runtime (caught in live QA 2026-06-12).
      const votesClient = supabase as unknown as {
        from: (t: string) => VotesQuery;
      };
      const votes_ = (t: string) => votesClient.from(t);

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

  // Keep the realtime handler pointing at the latest fetchSession (with the
  // current viewer / houseWideOnly filter) without re-binding the subscription.
  const fetchRef = useRef(fetchSession);
  useEffect(() => {
    fetchRef.current = fetchSession;
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
        () => {
          // Any session change → re-resolve the applicable session. Re-applies
          // the viewer / houseWideOnly filter and refreshes tallies (so a new
          // party election never overwrites the one this consumer cares about).
          fetchRef.current();
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
