import "server-only";

import { getCurrentPersonRoles, isAppAdmin, isAppSuperAdmin } from "@/lib/yi/auth/yi-directory-roles";

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

/** Link tokens are 32 hex chars; anything else is rejected before a query. */
export function isToken(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{32}$/.test(s);
}
