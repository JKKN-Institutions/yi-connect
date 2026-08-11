/**
 * Server-side web-push delivery for Yi-Future.
 *
 * SECURITY (2026-08-11) — WHY THIS FILE EXISTS.
 * `sendPushToSubject` used to be an exported function in
 * `app/yi-future/actions/push.ts`, a `"use server"` module. Every export of a
 * `"use server"` module is a Server Action: Next assigns it an action ID and
 * registers it as a remotely-invocable POST endpoint. It carried NO
 * authorization check of any kind, so any visitor who could reach the app
 * could invoke it directly and deliver an arbitrary notification title, body
 * and click-through URL to any subject whose id they could supply or guess —
 * a phishing primitive wearing the app's own icon.
 *
 * It was inert only because VAPID keys are unset in production, so
 * `configureWebPush()` returns false and the send no-ops. Configuring push
 * would have silently armed it.
 *
 * The gated front door for "send a push to an arbitrary subject" already
 * exists — `sendDevTestPush` in `app/yi-future/actions/dev-push.ts`, behind
 * `requireFutureNationalAdmin()`. The exported action was a back door around
 * that gate.
 *
 * Every caller of this function is server-side (announcements, awards,
 * consent, evaluations, feedback, interviews, dev-push — all `"use server"`
 * modules that apply their own gate before calling), so the fix is to remove
 * it from the action surface entirely rather than bolt on a role check.
 * A function that is not exported from a `"use server"` module has no action
 * ID and no endpoint — it is unreachable from the network by construction,
 * which is a stronger guarantee than any runtime gate.
 *
 * RULES FOR FUTURE EDITORS:
 *   1. Do NOT re-export `sendPushToSubject` from a `"use server"` file. That
 *      re-opens the endpoint and re-creates the gap.
 *   2. Callers are responsible for authorizing the send. This module
 *      deliberately holds no notion of "the current user" — it is a
 *      transport, invoked only after a caller-side gate has passed.
 *
 * `import "server-only"` makes an accidental client import a build error.
 */

import "server-only";

import webpush from "web-push";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  getVapidPublicKey,
  getVapidPrivateKey,
  getVapidSubject,
  hasVapidConfig,
} from "@/lib/yi-future/vapid";
import type { PushPayload, PushSubjectType } from "@/app/yi-future/actions/push-types";

/**
 * Runtime allowlist of targetable subject types.
 *
 * `PushSubjectType` is erased at compile time, so the type annotation alone
 * guarantees nothing about a value that crossed a serialization boundary.
 * Anything not on this list is DENIED (fail closed) rather than passed
 * through to the `subject_type` filter, where an unexpected value would widen
 * or misdirect the query instead of matching nothing.
 */
const ALLOWED_SUBJECT_TYPES: readonly PushSubjectType[] = [
  "auth_user",
  "delegate",
  "jury",
  "mentor",
  "partner",
  "expert",
];

/**
 * Load VAPID credentials into web-push. Returns false when keys are unset,
 * which is the current production state — every send then no-ops.
 */
export function configureWebPush(): boolean {
  if (!hasVapidConfig()) return false;
  webpush.setVapidDetails(
    getVapidSubject(),
    getVapidPublicKey()!,
    getVapidPrivateKey()!
  );
  return true;
}

/**
 * Send a push notification to all subscriptions owned by a given subject.
 * Silently cleans up dead subscriptions (410 Gone / 404 Not Found).
 *
 * NOT an authorization boundary — see the file header. The CALLER must have
 * already established that the current actor is allowed to notify this
 * subject. Never expose this from a `"use server"` module.
 */
export async function sendPushToSubject(
  subjectType: PushSubjectType,
  subjectId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  const none = { sent: 0, failed: 0, removed: 0 };

  // Fail closed on an unknown subject type or an empty subject id: a blank
  // id must never degrade into "match every row of that type".
  if (!ALLOWED_SUBJECT_TYPES.includes(subjectType)) return none;
  if (typeof subjectId !== "string" || subjectId.trim().length === 0) {
    return none;
  }

  if (!configureWebPush()) {
    return none;
  }

  const svc = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs } = await (svc as any)
    .schema("future")
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);

  const rows: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }> = Array.isArray(subs) ? subs : [];

  if (rows.length === 0) return none;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];

  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(sub.id);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any)
      .schema("future")
      .from("push_subscriptions")
      .delete()
      .in("id", deadIds);
  }

  // Best-effort last_used_at touch on successful endpoints
  if (sent > 0) {
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any)
      .schema("future")
      .from("push_subscriptions")
      .update({ last_used_at: now })
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId);
  }

  return { sent, failed, removed: deadIds.length };
}
