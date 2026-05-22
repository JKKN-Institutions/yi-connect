"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { submitScore } from "@/app/actions/yip/scoring";
import { removeFromBuffer, type BufferedScore } from "@/lib/yip/score-buffer";

export type SyncState = {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastSyncResult: { synced: number; failed: number } | null;
};

/**
 * Watches navigator.onLine for the current jury session.
 * When connectivity returns, automatically flushes the localStorage score buffer
 * through the submitScore server action. Removes successfully-synced entries.
 *
 * Usage in a jury page:
 *   const sync = useOfflineSync(juryAssignmentId);
 *   <OfflineSyncBadge state={sync} />
 */
export function useOfflineSync(juryAssignmentId: string | null): SyncState {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number;
    failed: number;
  } | null>(null);

  // Prevent concurrent flushes; rotate a lock flag.
  const flushingRef = useRef(false);

  const countPending = useCallback(() => {
    if (!juryAssignmentId) {
      setPendingCount(0);
      return;
    }
    // Buffer keys are formatted `${juryAssignmentId}::${participantId}` in
    // score-buffer. We read localStorage directly to filter by our jury id,
    // since getAllBuffered() drops the key scope.
    try {
      const raw = localStorage.getItem("yip_score_buffer");
      if (!raw) {
        setPendingCount(0);
        return;
      }
      const map = JSON.parse(raw) as Record<string, BufferedScore>;
      const prefix = `${juryAssignmentId}::`;
      const count = Object.keys(map).filter((k) => k.startsWith(prefix)).length;
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, [juryAssignmentId]);

  const flush = useCallback(async () => {
    if (!juryAssignmentId) return;
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    flushingRef.current = true;
    setSyncing(true);

    try {
      const raw = localStorage.getItem("yip_score_buffer");
      if (!raw) {
        return;
      }
      const map = JSON.parse(raw) as Record<string, BufferedScore>;
      const prefix = `${juryAssignmentId}::`;
      const entries = Object.entries(map).filter(([k]) =>
        k.startsWith(prefix)
      );

      if (entries.length === 0) return;

      let synced = 0;
      let failed = 0;

      for (const [, buffered] of entries) {
        try {
          const res = await submitScore({
            juryAssignmentId,
            participantId: buffered.participantId,
            eventId: buffered.eventId,
            rubricId: buffered.rubricId,
            agendaItemId: buffered.agendaItemId,
            criteriaScores: buffered.criteriaScores,
            totalScore: buffered.totalScore,
            comments: buffered.comments ?? "",
            // Keep the buffered intent: a draft in the buffer stays a draft.
            // If the juror wanted it submitted, they would have hit Submit,
            // which calls submitScore directly and clears the buffer entry.
            status: "draft",
          });
          if (res.success) {
            removeFromBuffer(juryAssignmentId, buffered.participantId);
            synced += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }

      setLastSyncAt(new Date().toISOString());
      setLastSyncResult({ synced, failed });
      countPending();
    } finally {
      flushingRef.current = false;
      setSyncing(false);
    }
  }, [juryAssignmentId, countPending]);

  // Track online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      // Attempt flush automatically on reconnect
      flush();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial read
    setIsOnline(navigator.onLine);
    countPending();

    // Also: refresh pending count periodically since saveToBuffer doesn't fire
    // an event. Every 10s is plenty — the buffer is localStorage, not hot path.
    const interval = setInterval(countPending, 10_000);

    // And trigger one flush attempt on mount in case we loaded straight into
    // online mode with buffered drafts from a prior session.
    if (navigator.onLine) flush();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [flush, countPending]);

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === "yip_score_buffer") countPending();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [countPending]);

  return {
    isOnline,
    pendingCount,
    syncing,
    lastSyncAt,
    lastSyncResult,
  };
}
