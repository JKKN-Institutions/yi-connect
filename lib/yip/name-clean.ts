// Participant name cleanup — shared by every roster intake path (bulk import,
// single add, quick walk-in) AND the client-side import preview, so what the
// organiser previews is exactly what gets stored.
//
// Lives in lib/ (not the actions file) because app/yip/actions/participants.ts
// is "use server" and may export ONLY async functions.

// A leading honorific counts ONLY when followed by a dot (optionally spaces)
// or by whitespace — so "Mr. Arun", "Ms.Priya", "Dr Ravi" strip, but names
// like "Ernest", "Missy" or "Drake" are never mangled.
const HONORIFIC_PREFIX = /^(?:mr|mrs|ms|miss|master|dr|er|prof)(?:\.\s*|\s+)/i;

/**
 * Strip leading honorifics (Mr, Mrs, Ms, Miss, Master, Dr, Er, Prof — any
 * case, with or without a trailing dot, up to two stacked like "Prof. Dr.")
 * and collapse repeated whitespace. Never returns an empty name: if stripping
 * would empty it, the (whitespace-normalized) original is kept. The rest of
 * the name is preserved exactly — no case changes.
 */
export function cleanParticipantName(raw: string): string {
  const original = raw.trim().replace(/\s+/g, " ");
  let name = original;
  for (let i = 0; i < 2; i++) {
    const next = name.replace(HONORIFIC_PREFIX, "");
    if (next === name) break;
    name = next;
  }
  name = name.trim().replace(/\s+/g, " ");
  return name.length > 0 ? name : original;
}
