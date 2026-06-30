"use server";

/**
 * YIP participant push-subscription actions. A student grants browser
 * notification permission once, then this stores their web-push subscription in
 * yip.push_subscriptions (service-role only) keyed to their participant id, after
 * verifying their access-code session. The send path lives in lib/yip/push.ts.
 *
 * The VAPID PUBLIC key the client subscribes with is NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * (read directly in the client) — no action needed for it.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";

export async function saveParticipantPushSubscription(input: {
  participantId: string;
  eventId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.endpoint || !input?.p256dh || !input?.auth) {
    return { ok: false, error: "Invalid subscription payload." };
  }
  const sess = await requireParticipantSession(input.participantId, input.eventId);
  if (!sess.ok) return { ok: false, error: sess.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const now = new Date().toISOString();
  const { error } = await svc.from("push_subscriptions").upsert(
    {
      participant_id: input.participantId,
      event_id: input.eventId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      is_active: true,
      last_used: now,
      updated_at: now,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeParticipantPushSubscription(input: {
  participantId: string;
  eventId: string;
  endpoint: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.endpoint) return { ok: false, error: "Missing endpoint." };
  const sess = await requireParticipantSession(input.participantId, input.eventId);
  if (!sess.ok) return { ok: false, error: sess.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { error } = await svc
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("endpoint", input.endpoint)
    .eq("participant_id", input.participantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
