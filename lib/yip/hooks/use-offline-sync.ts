"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { submitScore } from "@/app/yip/actions/scoring";
import { removeFromBufferByKey, type BufferedScore } from "@/lib/yip/score-buffer";

export type SyncState = {
  isOnline: boolean;
  pendingCount: number;
  // How many of the pending entries are intended SUBMITS (not just drafts) —
  // these are the ones that decide results, so the badge calls them out.
  pendingSubmits: number;
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
  const [pendingSubmits, setPendingSubmits] = useState(0);
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
      setPendingSubmits(0);
      return;
    }
    // Buffer keys start `${juryAssignmentId}::` (now suffixed with the session
    // id). We read localStorage directly to filter by our jury id, since
    // getAllBuffered() drops the key scope.
    try {
      const raw = localStorage.getItem("yip_score_buffer");
      if (!raw) {
        setPendingCount(0);
        setPendingSubmits(0);
        return;
      }
      const map = JSON.parse(raw) as Record<string, BufferedScore>;
      const prefix = `${juryAssignmentId}::`;
      const mine = Object.entries(map).filter(([k]) => k.startsWith(prefix));
      setPendingCount(mine.length);
      setPendingSubmits(
        mine.filter(([, v]) => v.status === "submitted").length
      );
    } catch {
      setPendingCount(0);
      setPendingSubmits(0);
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

      for (const [key, buffered] of entries) {
        // Discard phantom entries: untouched all-zero drafts written by the
        // old mount-autosave (no scores, no comments, no flags, not a Submit).
        // Replaying these as drafts could clobber a real score with zeros.
        const hasAnyScore = Object.values(buffered.criteriaScores ?? {}).some(
          (v) => Number(v) > 0
        );
        const hasAnyFlag = buffered.flags
          ? Object.values(buffered.flags).some(Boolean)
          : false;
        if (
          buffered.status !== "submitted" &&
          !hasAnyScore &&
          !hasAnyFlag &&
          !(buffered.comments ?? "").trim()
        ) {
          removeFromBufferByKey(key);
          continue;
        }
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
            // Honour the buffered INTENT. A juror who pressed Submit while
            // offline meant "submitted" — drafts are excluded from results, so
            // downgrading here silently made offline submissions never count.
            // Legacy entries without a status stay drafts.
            status: buffered.status === "submitted" ? "submitted" : "draft",
            // Special-Remarks flags captured offline ride along; omitted for
            // legacy entries (submitScore treats them as optional).
            ...(buffered.flags ? { flags: buffered.flags } : {}),
            // Mark as a background replay: the server refuses to downgrade a
            // since-SUBMITTED row with a stale buffered draft.
            fromOfflineSync: true,
          });
          if (res.success) {
            // Delete by the EXACT stored key — entries may be legacy 2-part
            // (jury::participant) or current 3-part (jury::participant::session).
            removeFromBufferByKey(key);
            synced += 1;
          } else {
            // A stale-rubric rejection can never succeed on retry — drop the
            // entry so the badge doesn't show a forever-pending score; the
            // juror re-scores that participant against the live sheet.
            if (res.error?.startsWith("STALE_OFFLINE_SCORE")) {
              removeFromBufferByKey(key);
            }
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
    // an event — AND retry the flush. navigator.onLine lies on captive-portal
    // venue wifi ("online" but requests fail), so the `online` event alone can
    // miss real recovery; a periodic attempt is cheap (flush() early-returns
    // when offline / already flushing / buffer empty).
    const interval = setInterval(() => {
      countPending();
      flush();
    }, 10_000);

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
    pendingSubmits,
    syncing,
    lastSyncAt,
    lastSyncResult,
  };
}
