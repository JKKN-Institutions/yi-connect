"use server";

import { revalidatePath } from "next/cache";
import { parseBadge } from "@/lib/take-pride/badge";
import {
  BADGE_NEEDS_SECRET,
  BADGE_UNREADABLE,
  SCAN_LIMIT_MESSAGE,
  connectTo,
  type ConnectResult,
  findDelegateByVerifiedBadge,
  getConnectMe,
  markScanOk,
  recordScan,
} from "@/lib/take-pride/connections";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Scan to connect. "Me" is the delegate behind the pass token; the browser
 * only sends the scanned text. The other badge's SECRET is required, so a
 * connection needs the physical badge (or its QR on a phone) in front of
 * you: being face to face is the consent. Every deny is { success:false }.
 */

export async function connectByBadge(token: string, scanned: string): Promise<TpResult<ConnectResult>> {
  const me = await getConnectMe(token);
  if (!me) return { success: false, error: "This pass link is not valid" };
  const scan = await recordScan({ delegateId: me.id });
  if (!scan.allowed) {
    return { success: false, error: scan.reason === "limit" ? SCAN_LIMIT_MESSAGE : "Could not connect. Please try again." };
  }
  const badge = parseBadge(scanned);
  if (!badge) return { success: false, error: "That is not a Take Pride badge code" };
  if (!badge.secret) return { success: false, error: BADGE_NEEDS_SECRET };
  const other = await findDelegateByVerifiedBadge(badge);
  if (!other) return { success: false, error: BADGE_UNREADABLE };
  const out = await connectTo(me, other);
  if (out.kind === "self") return { success: false, error: "That is your own badge. Scan the other person's badge." };
  if (out.kind === "error") return { success: false, error: "Could not connect. Please try again." };
  await markScanOk(scan.attemptId);
  revalidatePath(`/take-pride/pass/${token}/people-saved`);
  const p = out.person;
  return {
    success: true,
    data: { already: out.kind === "already", name: p.full_name, chapter: p.chapter, business: p.business_name, role: p.role_title },
  };
}
