"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";

/**
 * useSpeakingFloorLive — realtime driver shared by all three Speaking Floor
 * surfaces (phone card, Chair panel, projector meter). Subscribes to
 * yip.speaking_requests for the event and re-runs `fetcher` on every change, the
 * same pattern useVoteSession uses for vote_sessions. Each surface passes a
 * different fetcher (getMySpeakingStatus / getSpeakingFloor / getSpeakingFloorStats)
 * so the server does the joins + fairness math and the client stays thin.
 *
 * trackTurns: also refetch when yip.agenda_speakers changes, so the fairness
 * numbers move when a member finishes a formal-roster / Now-Speaking turn (not
 * just a raise-to-speak turn). agenda_speakers has no event_id column, so that
 * subscription is unfiltered — the fetcher re-scopes to the event. Only the
 * Chair panel + projector need it; the phone card leaves it off.
 */
export function useSpeakingFloorLive<T>(
  eventId: string,
  fetcher: () => Promise<T | null>,
  opts?: { trackTurns?: boolean }
): { data: T | null; loading: boolean } {
  const supabase = createClient();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const trackTurns = opts?.trackTurns ?? false;

  // Keep the realtime handler pointing at the latest fetcher without re-binding
  // the subscription (the fetcher closes over eventId, which is stable here).
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Monotonic token: overlapping refetches (rapid changes) must commit in order,
  // so a slow earlier response can't clobber a newer one.
  const seqRef = useRef(0);
  const refetch = useCallback(async () => {
    const mySeq = ++seqRef.current;
    const result = await fetcherRef.current();
    if (mySeq !== seqRef.current) return;
    setData(result);
    setLoading(false);
  }, []);

  // Initial load.
  useEffect(() => {
    refetch();
  }, [refetch, eventId]);

  // Subscribe to the event's speaking_requests.
  useEffect(() => {
    const channel = supabase
      .channel(`yip:speaking-floor:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "yip",
          table: "speaking_requests",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Optionally track formal-turn completions (agenda_speakers) for the meter.
  useEffect(() => {
    if (!trackTurns) return;
    const channel = supabase
      .channel(`yip:speaking-floor-turns:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "yip", table: "agenda_speakers" },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, trackTurns]);

  return { data, loading };
}
