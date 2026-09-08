/**
 * Where a YIQ sign-in may send someone afterwards.
 *
 * THE BUG THIS CLOSES. /yiq/login ignored `redirectTo` entirely: it
 * redirected any existing student session to /yiq/me unconditionally, and
 * LoginForm hardcoded router.push("/yiq/me") after a successful sign-in. An
 * organiser who happens to hold a student session — which is normal, they
 * register test teams — clicked an admin link, was bounced to a student page
 * with no explanation, clicked again, and was bounced again. That is exactly
 * the undiagnosable bounce loop CLAUDE.md forbids.
 *
 * WHY THIS IS NOT JUST `redirect(param)`. A redirect target that comes from
 * the query string is attacker-controlled. `?redirectTo=https://evil.example`
 * turns our own sign-in page into a credible phishing hop: the victim sees
 * OUR domain and OUR branding, signs in, and is handed to someone else. So
 * the rule here is an ALLOW-LIST of shape, not a block-list of badness:
 *
 *   - must be a string that starts with a single "/"
 *   - must NOT start with "//" or a backslash, which browsers read as
 *     protocol-relative and resolve to a FOREIGN HOST
 *   - must not contain a scheme, a backslash, whitespace, or a control
 *     character (all of which have been used to smuggle a host past naive
 *     checks)
 *   - must stay inside /yiq — this is the YIQ sign-in, and it has no business
 *     sending anyone into another vertical
 *
 * Anything else falls back to the default. FAIL CLOSED: an unusable
 * redirect sends the student to their own page, which is never harmful.
 */

/** Where a signed-in student goes when nothing better is asked for. */
export const YIQ_DEFAULT_LANDING = "/yiq/me";

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Everything at or below U+0020, plus DEL. Newlines (header smuggling), tabs
 * and NUL bytes (parser confusion) all live in this range.
 */
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f]/;

/**
 * Returns a safe same-site path, or `fallback` when the input cannot be
 * trusted. Never throws, never returns an absolute URL.
 */
export function safeYiqRedirect(
  raw: unknown,
  fallback: string = YIQ_DEFAULT_LANDING
): string {
  if (typeof raw !== "string") return fallback;

  const v = raw.trim();
  if (v === "") return fallback;

  // Control characters and whitespace are used to break parsers apart.
  if (CONTROL_OR_SPACE.test(v)) return fallback;

  // "https:", "javascript:", "data:" — anything with a scheme leaves the site.
  if (SCHEME.test(v)) return fallback;

  // A backslash is treated as a slash by browsers in many positions.
  if (v.includes("\\")) return fallback;

  // Must be a rooted path...
  if (!v.startsWith("/")) return fallback;
  // ...but NOT protocol-relative, which points at another host entirely.
  if (v.startsWith("//")) return fallback;

  // Keep it inside this vertical. "/yiq" exactly, or anything below it.
  // Guard against "/yiqevil" by requiring the boundary character.
  if (v !== "/yiq" && !v.startsWith("/yiq/") && !v.startsWith("/yiq?")) {
    return fallback;
  }

  return v;
}
