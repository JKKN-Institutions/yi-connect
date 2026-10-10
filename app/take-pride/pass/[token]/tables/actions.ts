"use server";

import { revalidatePath } from "next/cache";
import { getDelegateByToken } from "@/lib/take-pride/data";
import { cancelOwnCircle, joinCircle, leaveCircle, startCircle, type TableInput } from "@/lib/take-pride/tables";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Topic tables from a delegate's pass. "Me" is always the delegate behind
 * the pass token (getDelegateByToken checks the token shape first); the
 * browser only names a table or sends the form. Every deny returns
 * { success:false, error }. Never redirect.
 */

const BAD_LINK = "This pass link is not valid";

function refresh(token: string) {
  revalidatePath(`/take-pride/pass/${token}/tables`);
}

export async function joinTable(token: string, circleId: string): Promise<TpResult> {
  const me = await getDelegateByToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  const r = await joinCircle(me.id, circleId);
  if (r.success) refresh(token);
  return r;
}

export async function leaveTable(token: string, circleId: string): Promise<TpResult> {
  const me = await getDelegateByToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  const r = await leaveCircle(me.id, circleId);
  if (r.success) refresh(token);
  return r;
}

export async function startTable(token: string, input: TableInput): Promise<TpResult<{ id: string }>> {
  const me = await getDelegateByToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  const r = await startCircle({ id: me.id, is_sample: me.is_sample }, input);
  if (r.success) refresh(token);
  return r;
}

export async function cancelMyTable(token: string, circleId: string): Promise<TpResult> {
  const me = await getDelegateByToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  const r = await cancelOwnCircle(me.id, circleId);
  if (r.success) refresh(token);
  return r;
}
