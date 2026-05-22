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

/** Get a buffered score for a specific participant */
export function getFromBuffer(
  juryAssignmentId: string,
  participantId: string
): BufferedScore | null {
  const buffer = getBuffer();
  const key = bufferKey(juryAssignmentId, participantId);
  return buffer[key] ?? null;
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

/** Clear the entire buffer */
export function clearBuffer(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BUFFER_KEY);
  } catch {
    // Ignore
  }
}
