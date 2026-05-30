"use client";

// ─── Offline Score Buffer ─────────────────────────────────────────
// Saves score drafts to localStorage so jury members don't lose work
// if they lose connectivity. Syncs back when connection is restored.

const BUFFER_KEY = "yip_score_buffer";

export interface BufferedScore {
  participantId: string;
  rubricId: string;
  eventId: string;
  agendaItemId: string | null;
  criteriaScores: Record<string, number>;
  totalScore: number;
  comments: string;
  savedAt: string;
}

function getBuffer(): Record<string, BufferedScore> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setBuffer(buffer: Record<string, BufferedScore>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/** Build a unique key for a jury+participant score */
function bufferKey(juryAssignmentId: string, participantId: string): string {
  return `${juryAssignmentId}::${participantId}`;
}

// ─── Stale-rubric guard ───────────────────────────────────────────
// A rubric can change mid-event. A score draft buffered against the OLD
// rubric carries criteriaScores keyed by criteria that no longer exist on
// the active rubric. Submitting such an entry would write silently-wrong
// data (keys that don't line up with the live rubric → corrupted results).
//
// Policy: FAIL TOWARD DROPPING. A false-drop only forces a harmless
// re-score; a false-submit corrupts the event's results. So we are strict:
// an entry is valid ONLY if its scored keys are a subset of the active
// rubric's expected keys. (A missing key is fine — it defaults to 0 — but
// an EXTRA/unknown key means the entry was scored against a different
// rubric shape and must be dropped.)

/**
 * Is this buffered entry still consistent with the active rubric?
 *
 * @param entry       the buffered score draft
 * @param rubricKeys  the active rubric's expected criteria keys
 *                    (the flat parent keys the form writes — see ScoreForm)
 * @returns true if every scored key belongs to the active rubric
 *
 * Conservative by design: if rubricKeys is empty/missing we treat the entry
 * as INVALID (we can't prove it's safe), and any scored key outside the
 * expected set marks the whole entry stale.
 */
export function validateAgainstRubric(
  entry: BufferedScore,
  rubricKeys: string[] | null | undefined
): boolean {
  if (!rubricKeys || rubricKeys.length === 0) return false;
  const expected = new Set(rubricKeys);
  const scored = entry?.criteriaScores;
  if (!scored || typeof scored !== "object") return false;
  for (const k of Object.keys(scored)) {
    if (!expected.has(k)) return false; // stale / foreign key → drop
  }
  return true;
}

/** Save a draft score to localStorage */
export function saveToBuffer(
  juryAssignmentId: string,
  score: BufferedScore
): void {
  const buffer = getBuffer();
  const key = bufferKey(juryAssignmentId, score.participantId);
  buffer[key] = { ...score, savedAt: new Date().toISOString() };
  setBuffer(buffer);
}

/**
 * Get a buffered score for a specific participant.
 *
 * When `rubricKeys` is supplied (the active rubric's expected criteria keys),
 * the entry is validated against it. A stale entry — one carrying criteria
 * keys that no longer exist on the active rubric — is DROPPED from the buffer
 * and `null` is returned, so the juror re-scores against the live rubric
 * instead of silently rehydrating wrong data. Omitting `rubricKeys` keeps the
 * legacy behavior (no validation) for callers that don't have the rubric.
 */
export function getFromBuffer(
  juryAssignmentId: string,
  participantId: string,
  rubricKeys?: string[] | null
): BufferedScore | null {
  const buffer = getBuffer();
  const key = bufferKey(juryAssignmentId, participantId);
  const entry = buffer[key] ?? null;
  if (!entry) return null;

  // Only validate when the caller hands us the active rubric. Fail toward
  // dropping: a stale entry is removed rather than returned for rehydrate.
  if (rubricKeys !== undefined && !validateAgainstRubric(entry, rubricKeys)) {
    delete buffer[key];
    setBuffer(buffer);
    return null;
  }

  return entry;
}

/** Remove a specific score from the buffer (after successful sync) */
export function removeFromBuffer(
  juryAssignmentId: string,
  participantId: string
): void {
  const buffer = getBuffer();
  const key = bufferKey(juryAssignmentId, participantId);
  delete buffer[key];
  setBuffer(buffer);
}

/** Get all buffered scores (for syncing when back online) */
export function getAllBuffered(): BufferedScore[] {
  const buffer = getBuffer();
  return Object.values(buffer);
}

/**
 * Partition every buffered entry into "valid" (safe to submit against the
 * active rubric) and "stale" (criteria keys no longer match — must be dropped
 * and re-scored). Stale entries are REMOVED from the buffer as a side effect
 * so they can never be submitted on a later flush.
 *
 * The caller supplies `resolveRubricKeys`, which maps a buffered entry's
 * `rubricId` to the active rubric's expected criteria keys. Returning
 * null/empty for an entry forces it to be treated as stale (fail-closed).
 *
 * Use this at the reconnect/flush boundary instead of blindly submitting the
 * raw buffer, so a mid-event rubric change can't corrupt results.
 */
export function takeValidBuffered(
  resolveRubricKeys: (entry: BufferedScore) => string[] | null | undefined
): { valid: BufferedScore[]; dropped: BufferedScore[] } {
  const buffer = getBuffer();
  const valid: BufferedScore[] = [];
  const dropped: BufferedScore[] = [];
  let mutated = false;

  for (const [key, entry] of Object.entries(buffer)) {
    const rubricKeys = resolveRubricKeys(entry);
    if (validateAgainstRubric(entry, rubricKeys)) {
      valid.push(entry);
    } else {
      dropped.push(entry);
      delete buffer[key];
      mutated = true;
    }
  }

  if (mutated) setBuffer(buffer);
  return { valid, dropped };
}

/** Clear the entire buffer */
export function clearBuffer(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BUFFER_KEY);
  } catch {
    // Ignore
  }
}
