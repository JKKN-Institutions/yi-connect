/**
 * YIP in-app community chat — feature flag.
 *
 * ⚠️ CHILD SAFETY: YIP participants are MINORS (school students). This feature
 * is FOUNDATION-ONLY and DEFAULTS OFF. It MUST NOT be turned on in production
 * until (a) a named Yi moderation owner exists and (b) a child-safety review is
 * complete.
 *
 * Driven by env `NEXT_PUBLIC_YIP_CHAT_ENABLED`. Anything other than the exact
 * string "true" — including unset, "false", "1", "TRUE" — leaves chat OFF.
 * The `NEXT_PUBLIC_` prefix lets both server actions and client components read
 * the same flag.
 *
 * Every chat surface (server actions + UI) checks `CHAT_ENABLED` and renders a
 * "coming soon" placeholder / returns a disabled result when it is false.
 */
export const CHAT_ENABLED =
  process.env.NEXT_PUBLIC_YIP_CHAT_ENABLED === "true";
