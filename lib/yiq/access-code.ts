import { randomInt } from "node:crypto";

/**
 * YIQ access codes. Students log in with a code (no password, no Supabase
 * Auth account) — same pattern as YIP participants and YiFi registrants.
 *
 * Alphabet excludes visually ambiguous glyphs (0/O, 1/I/L, 5/S, 8/B) because
 * these are read off a printed slip by a 14-year-old in a school hall.
 */
const ALPHABET = "ACDEFGHJKMNPQRTUVWXYZ2346799";
const UNAMBIGUOUS = "ACDEFGHJKMNPQRTUVWXYZ23467";

function pick(n: number, alphabet: string = UNAMBIGUOUS): string {
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

/** Team code, e.g. "YIQ-K7M2-QR". Printed on the team's confirmation slip. */
export function generateTeamCode(): string {
  return `YIQ-${pick(4)}-${pick(2)}`;
}

/** Student code, e.g. "Q7MK2W". Six chars — short enough to type on a phone. */
export function generateStudentCode(): string {
  return pick(6);
}

/** Normalise anything a student types: strip spaces/dashes, upper-case. */
export function normaliseCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export { ALPHABET as YIQ_CODE_ALPHABET };
