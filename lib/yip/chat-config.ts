/**
 * YIP in-app community chat — feature flag.
 *
 * ENABLED for production on 2026-06-12 by the programme owner (chapter chair).
 * Moderation default: each chapter's chair + organisers (yi_directory roles →
 * getYipEventAccess(...).canManage) moderate their event's chat.
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
