// Yi-Future access-code SHAPE — the single definition of what makes a code a
// check-in VOLUNTEER code rather than a student's / mentor's / jury's.
//
// Deliberately NOT a "use server" file and deliberately dependency-free: it is
// imported by server actions AND by the sign-in form (a client component), so
// the browser and the server can never disagree about what a code is.
//
// ═══ THE RESERVED SHAPE ═════════════════════════════════════════════════════
// A volunteer code is EXACTLY 6 characters and its first character is the
// digit ZERO:
//
//     0XXXXX     where X ∈ ABCDEFGHJKLMNPQRSTUVWXYZ23456789   (32 chars)
//
// Everybody else's code — delegate, mentor, jury, corporate partner, expert —
// is 6 characters drawn ENTIRELY from that same 32-character alphabet. That is
// not a convention, it is the only producer: generateAccessCode() in
// lib/yi-future/access-code.ts mints every code in those five tables (8 call
// sites, all of them that one function), and no path in the app accepts a
// human-typed access_code — not the CSV delegate import, not any admin form.
//
// That alphabet contains no 0, no O, no 1 and no I; they were excluded because
// they are ambiguous in print. So a code from that generator can never begin
// with 0, and a volunteer code can therefore never equal any other
// code-holder's code. The collision is IMPOSSIBLE, not merely unlikely.
//
// Which is the whole point: validateAccessCode() routes on the shape alone. A
// 0-leading code is looked up ONLY in future.volunteers; any other code is
// never looked up there at all. There is no ambiguous case left to handle, so
// nothing has to be denied at a busy desk on event day.
//
// Measured against production on 2026-08-10 (read-only census, service client):
// 16,838 issued codes — delegates 16,686 · mentors 140 · jury 9 · partners 0 ·
// experts 3. ZERO of them contain 0, O, 1 or I anywhere, let alone lead with
// one. The guarantee is not just structural, it is true of the live data.
//
// ═══ WHAT WOULD BREAK IT ════════════════════════════════════════════════════
// Exactly one thing: adding 0 — or O, which normalises to 0 below — to the
// alphabet in lib/yi-future/access-code.ts. A delegate code could then start
// with 0, this router would send that delegate to the volunteers table where
// they do not exist, and they would be told "code not recognized" and locked
// out of their own account. It would NOT cause a silent impersonation (the
// generation-time cross-table check and the DB trigger in
// supabase/migrations/future_volunteers_checkin.sql both still stand), but it
// would cause a lockout, which at Future 6.0 scale means thousands of people.
//
// Nothing else can break it. Code LENGTH is fixed at 6 on both sides, and the
// tail alphabet below is defined HERE rather than imported, so widening the
// shared alphabet cannot change what a volunteer code looks like — only what a
// delegate code looks like, which is precisely the danger.
//
// If that shared alphabet ever must include 0/O: either keep the marker out of
// it, or move the marker to a character it cannot emit AND re-issue every live
// volunteer code (regenerateVolunteerCode in app/yi-future/actions/
// volunteers.ts does one at a time).

/** Position 0 of every volunteer code. Reserved; nothing else may start here. */
export const VOLUNTEER_CODE_MARKER = "0";

/**
 * Tail alphabet: the same 32 unambiguous characters the shared generator uses,
 * restated here so this file owns the volunteer shape outright. It must never
 * contain the marker.
 */
const VOLUNTEER_TAIL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Marker + 5 unambiguous characters. `[A-HJ-NP-Z2-9]` is A–Z with I and O cut
 * out, i.e. VOLUNTEER_TAIL_ALPHABET expressed as a class.
 */
const VOLUNTEER_CODE_SHAPE = /^0[A-HJ-NP-Z2-9]{5}$/;

/**
 * Does this (already normalised) code have the reserved volunteer shape?
 * The router's only question. Pass it the output of
 * normalizeAccessCodeInput(), never a raw string.
 */
export function isVolunteerCodeShape(code: string): boolean {
  return VOLUNTEER_CODE_SHAPE.test(code);
}

/**
 * Mint a volunteer code. 32^5 = 33,554,432 possibilities, and uniqueness
 * inside future.volunteers is enforced by a partial unique index plus a retry
 * loop in the calling action.
 *
 * Math.random matches generateAccessCode(), which minted all 16,838 codes now
 * in production; using a CSPRNG for one of the six generators and not the
 * others would be a false sense of progress. Upgrading all six together is a
 * follow-up in a file this change does not own.
 */
export function generateVolunteerAccessCode(): string {
  let code = VOLUNTEER_CODE_MARKER;
  for (let i = 1; i < 6; i++) {
    code += VOLUNTEER_TAIL_ALPHABET.charAt(
      Math.floor(Math.random() * VOLUNTEER_TAIL_ALPHABET.length)
    );
  }
  // Tripwire, not decoration: a code that does not match the shape is a code
  // the router cannot deliver to anybody. Better to fail here, in front of the
  // chair issuing it, than at a desk at 9am.
  if (!isVolunteerCodeShape(code)) {
    throw new Error(
      `Generated volunteer code "${code}" is not the reserved 0XXXXX shape — see lib/yi-future/access-code-shape.ts`
    );
  }
  return code;
}

/**
 * Canonicalise a typed or pasted code. Used by the sign-in form on every
 * keystroke AND by validateAccessCode() on the server, so the two can never
 * disagree.
 *
 *   • upper-case, then drop everything outside A-Z0-9 — spaces, dashes and the
 *     invisible characters that arrive with a paste out of WhatsApp;
 *   • O → 0. A volunteer's card reads "0K7M4J" and a fair share of people will
 *     type the letter. This mapping is LOSSLESS: the letter O appears in no
 *     code in any of the six tables (it is in neither alphabet — confirmed
 *     against all 16,838 live codes), so it can never rewrite something
 *     legitimate into something else.
 *
 * 1 and I are deliberately NOT mapped to each other or to anything: neither
 * appears in any alphabet, so a code containing one cannot match any row and
 * falls through to the ordinary "that code was not recognized" answer, which
 * is the truth.
 */
export function normalizeAccessCodeInput(raw: string): string {
  return (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0");
}
