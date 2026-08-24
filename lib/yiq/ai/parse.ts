/**
 * Pure helpers for the Max-lane door. Deliberately NOT "server-only": these
 * are plain functions with no I/O, so they can be exercised by the check
 * script. The network client lives in ./max-lane.ts.
 */

/** The door's documented payload ceiling. Refuse locally rather than eat a 413. */
export const PAYLOAD_CEILING_BYTES = 32_768;

export function parseStrictJson<T>(raw: string): T | null {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  else {
    // Fall back to the outermost {...} or [...] in the text.
    const first = Math.min(
      ...[s.indexOf("{"), s.indexOf("[")].filter((i) => i >= 0).concat([Infinity])
    );
    const last = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (Number.isFinite(first) && last > first) s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
