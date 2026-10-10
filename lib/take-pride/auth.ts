import "server-only";

import { getCurrentPersonRoles, isAppAdmin, isAppSuperAdmin } from "@/lib/yi/auth/yi-directory-roles";
import { getReviewAdminSession } from "./review";

/**
 * Organiser desk gate. Reads yi_directory only (the mother source):
 * take_pride_admin / take_pride_super_admin, the Recognitions super admin
 * (who already runs Take Pride awards), or a platform super admin.
 * FAIL CLOSED: no session or no directory person denies.
 */
export type TpOrganiserGate =
  | { ok: true; userId: string; personId: string }
  | { ok: false; reason: "signed_out" | "forbidden" };

export async function requireTpOrganiser(): Promise<TpOrganiserGate> {
  const me = await getCurrentPersonRoles();
  if (!me) return { ok: false, reason: "signed_out" };
  const allowed = (await isAppAdmin("take_pride")) || (await isAppSuperAdmin("recognitions"));
  if (!allowed) return { ok: false, reason: "forbidden" };
  return { ok: true, userId: me.user_id, personId: me.person_id };
}

/**
 * Desk gate for the few desk surfaces that also open in REVIEW MODE (an
 * outside organiser signed in at /take-pride/review as "admin"). Review mode
 * is SAMPLE DATA ONLY: every caller that gets mode "review" must filter to
 * is_sample rows and deny every other write. A real organiser always wins.
 * Everything not converted to this gate keeps requireTpOrganiser(), which
 * never lets a review session in. FAIL CLOSED.
 */
export type TpDeskGate =
  | { ok: true; mode: "real"; userId: string; personId: string }
  | { ok: true; mode: "review"; sessionId: string }
  | { ok: false; reason: "signed_out" | "forbidden" };

export async function requireTpDesk(): Promise<TpDeskGate> {
  const real = await requireTpOrganiser();
  if (real.ok) return { ok: true, mode: "real", userId: real.userId, personId: real.personId };
  const review = await getReviewAdminSession();
  if (review) return { ok: true, mode: "review", sessionId: review.sessionId };
  return real;
}

/** True when the request carries a valid review admin session. */
export async function hasReviewSession(): Promise<boolean> {
  return (await getReviewAdminSession()) !== null;
}

/** Link tokens are 32 hex chars; anything else is rejected before a query. */
export function isToken(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{32}$/.test(s);
}
