/**
 * "No raw database text may ever reach a student" — applied to the Server
 * Actions a delegate can trigger.
 *
 * WHY THIS IS A WRAPPER AND NOT A NEW TRANSLATOR
 * ----------------------------------------------
 * `humanise()` in lib/yi-future/invite-options.ts already does the translation,
 * and `looksLikeDatabaseText()` already decides what counts as database-shaped.
 * Both were written for #878's invite flow and are unit-tested. This module
 * deliberately adds NO new matching rules: it delegates to those two so there is
 * exactly one place where "what does a student see instead of a Postgres error"
 * is decided. A second, drifting copy of that logic is worse than none.
 *
 * WHAT THIS ADDS
 * --------------
 * The one thing the action sites were missing: the raw text is still written to
 * the server log before it is replaced. Swapping `error.message` for a friendly
 * sentence at ~30 call sites would otherwise have thrown away the only clue for
 * diagnosing a real failure — trading one silent-failure class for another,
 * which is the mistake #879/#887/#888 were all about.
 *
 * Anything that is already a plain sentence passes through untouched, because
 * `humanise()` returns its input when it is not database-shaped. So the actions'
 * own hand-written messages are unaffected.
 */

import { humanise, looksLikeDatabaseText } from "./invite-options";

/**
 * Turn a Postgres/PostgREST error message into something a 17-year-old can act
 * on, keeping the original in the server log.
 *
 * @param raw   the driver's `error.message` (may be null/undefined)
 * @param where a short tag naming the action, so the log line is greppable
 */
export function safeError(raw: string | null | undefined, where: string): string {
  const text = (raw ?? "").trim();

  if (!text) {
    return "Something went wrong at our end. Reload the page and try again.";
  }

  // Only log the ones that are actually database-shaped. The actions' own
  // sentences are not failures worth a stack of log noise.
  if (looksLikeDatabaseText(text)) {
    console.error(`[yi-future] ${where}: ${text}`);
  }

  return humanise(text);
}
