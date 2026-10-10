/**
 * Take Pride badge codes. PURE: no database, no Node-only modules, so the
 * same code runs in the browser, on the server and in a unit check.
 *
 * Printed / QR format: "TP26-1234-K7QXM" = badge number + a 5-character
 * secret (tp_delegates.badge_secret). The number alone is guessable, so a
 * Catalyst Partner (lead capture) and a delegate (scan to connect) must
 * present the secret. The gate desk (organisers) may use the number alone.
 */

/** Secret alphabet: no 0 / O / 1 / I / L, so a printed code reads cleanly. */
export const BADGE_SECRET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const BADGE_SECRET_LENGTH = 5;

export type ParsedBadge = {
  /** "TP26-1234": the tp_delegates.badge_code value. */
  code: string;
  /** "K7QXM", or null when only the number was given (old badges, typed numbers). */
  secret: string | null;
};

const FULL = /TP\s*26[\s-]*(\d{4})(?!\d)(?:[\s-]*([A-Z0-9]{5}))?(?![A-Z0-9])/;
const BARE = /^(\d{4})(?:[\s-]*([A-Z0-9]{5}))?$/;

/**
 * Reads a badge from scanned or typed text. Accepts "TP26-1234-K7QXM",
 * "tp26 1234 k7qxm", "TP261234K7QXM", the old "TP26-1234" (secret null),
 * and a bare "1234" or "1234-K7QXM" typed on its own. Returns null when no
 * badge number can be found. The secret is only checked for shape here;
 * whether it is RIGHT is decided on the server.
 */
export function parseBadge(text: unknown): ParsedBadge | null {
  if (typeof text !== "string") return null;
  const s = text.toUpperCase().trim();
  if (!s || s.length > 200) return null;
  const m = s.match(FULL) ?? s.match(BARE);
  if (!m) return null;
  return { code: `TP26-${m[1]}`, secret: m[2] ?? null };
}

/** The full printed code, e.g. "TP26-1234-K7QXM". */
export function fullBadgeCode(code: string, secret: string | null | undefined): string {
  return secret ? `${code}-${secret}` : code;
}
