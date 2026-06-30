/**
 * YIP participant web-push sender.
 *
 * Mirrors the yi-future push sender but targets yip.push_subscriptions, keyed by
 * participant_id (YIP students authenticate with an access code, not a Supabase
 * Auth user, so they can't use the user_id-keyed yi_connect push store). Reuses
 * the same VAPID config + the app's existing service-worker `push` handler, so
 * no service-worker change is needed.
 *
 * Plain module (NOT "use server") so the gated chat action can import it.
 */

import webpush from "web-push";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  getVapidPublicKey,
  getVapidPrivateKey,
  getVapidSubject,
  hasVapidConfig,
} from "@/lib/yi-future/vapid";

export type YipPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured = false;
function configure(): boolean {
  if (!hasVapidConfig()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      getVapidSubject(),
      getVapidPublicKey()!,
      getVapidPrivateKey()!
    );
    configured = true;
  }
  return true;
}

/**
 * Send a push to every active subscription of the given participants. Best
 * effort: dead endpoints (404/410) are marked inactive; all errors are swallowed
 * so a push failure never breaks the caller (e.g. posting a message).
 * The yip service client defaults to the yip schema (same as chat.ts).
 */
export async function sendYipPushToParticipants(
  participantIds: string[],
  payload: YipPushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  const ids = Array.from(new Set(participantIds.filter(Boolean)));
  if (ids.length === 0 || !configure()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data: subs } = await svc
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("participant_id", ids)
    .eq("is_active", true);

  const rows: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }> = Array.isArray(subs) ? subs : [];
  if (rows.length === 0) return { sent: 0, failed: 0, removed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/yip/me",
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];

  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const sc =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (sc === 404 || sc === 410) deadIds.push(sub.id);
      }
    })
  );

  if (deadIds.length > 0) {
    await svc
      .from("push_subscriptions")
      .update({ is_active: false })
      .in("id", deadIds);
  }

  return { sent, failed, removed: deadIds.length };
}
