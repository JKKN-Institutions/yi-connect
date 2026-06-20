/**
 * Team-invite expiry policy for Yi Future.
 *
 * Invites are valid for INVITE_EXPIRY_DAYS days after they are (re)sent. After
 * that a pending invite is treated as expired everywhere: it can't be accepted,
 * it renders as "Expired" in the UI, and the inviter can send a fresh one.
 *
 * Pure module (no "use server") so both server actions and server components
 * can import it.
 */
export const INVITE_EXPIRY_DAYS = 7;

/** True when a pending invite created at `createdAt` is older than the window. */
export function isInviteExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs > INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}
