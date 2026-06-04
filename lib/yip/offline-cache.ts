"use client";

// ─── Offline Inbound Cache ────────────────────────────────────────
// The score-buffer handles OUTBOUND scores (saved on the phone, synced later).
// This module handles the INBOUND data a juror needs to keep scoring through
// an outage: the roster, the role rubrics, each session's scoring parameters,
// and the Special-Remarks deltas. Prefetched while online, read back whenever
// a server call fails — so switching participants/sessions works offline.
//
// Scoped per (event, jury assignment) so two jurors sharing a phone, or one
// juror across two events, never read each other's cache.

const CACHE_PREFIX = "yip_offline_cache";

export interface CachedRubric {
  id: string;
  criteria: unknown; // RubricCriterionShape[] — kept loose to avoid import cycles
  total_max: number;
}

export interface CachedSessionParams {
  criteria: unknown;
  total_max: number;
}

export interface OfflineCache {
  savedAt: string;
  roster?: unknown[]; // Participant[] as the jury client knows it
  sessions?: unknown[]; // ScoreableSession[]
  rubricsByRole?: Record<string, CachedRubric>;
  sessionParams?: Record<string, CachedSessionParams | null>; // by agenda_item_id
  flagDeltas?: Record<string, number> | null;
}

function cacheKey(eventId: string, juryAssignmentId: string): string {
  return `${CACHE_PREFIX}::${eventId}::${juryAssignmentId}`;
}

export function readOfflineCache(
  eventId: string,
  juryAssignmentId: string
): OfflineCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(eventId, juryAssignmentId));
    return raw ? (JSON.parse(raw) as OfflineCache) : null;
  } catch {
    return null;
  }
}

/**
 * Merge-write: each prefetch path (roster, rubrics, session params, flags)
 * lands at its own time — patching keeps earlier pieces instead of clobbering
 * the whole cache with a partial snapshot.
 */
export function patchOfflineCache(
  eventId: string,
  juryAssignmentId: string,
  patch: Partial<OfflineCache>
): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readOfflineCache(eventId, juryAssignmentId) ?? {
      savedAt: "",
    };
    const next: OfflineCache = {
      ...existing,
      ...patch,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(
      cacheKey(eventId, juryAssignmentId),
      JSON.stringify(next)
    );
  } catch {
    // Storage full or unavailable — the app still works online; offline
    // fallback just won't have this piece. Never throw into the UI.
  }
}
