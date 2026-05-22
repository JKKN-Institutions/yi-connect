"use server";

import webpush from "web-push";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  getVapidPublicKey,
  getVapidPrivateKey,
  getVapidSubject,
  hasVapidConfig,
} from "@/lib/yi-future/vapid";

// NOTE: "use server" files may only export async functions. Types and
// runtime constants live in @/app/actions/push-types. web-push requires
// Node runtime — Next's default server-actions runtime is Node, so no
// explicit runtime export is needed (would violate the "functions only" rule).

import type {
  PushSubjectType,
  SaveSubscriptionInput,
  PushPayload,
  PushSaveResult,
} from "./push-types";

type SubjectType = PushSubjectType;
type SaveResult = PushSaveResult;

// ─── HELPERS ────────────────────────────────────────────────────────
async function resolveCurrentSubject(): Promise<
  { type: SubjectType; id: string } | null
> {
  // 1. Access-code session (delegate/mentor/jury/partner)
  const session = await readSession();
  if (session && session.id && session.type) {
    return { type: session.type as SubjectType, id: session.id };
  }

  // 2. Supabase Auth user
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return { type: "auth_user", id: data.user.id };
  } catch {
    /* ignore */
  }

  return null;
}

function configureWebPush(): boolean {
  if (!hasVapidConfig()) return false;
  webpush.setVapidDetails(
    getVapidSubject(),
    getVapidPublicKey()!,
    getVapidPrivateKey()!
  );
  return true;
}

// ─── ACTIONS ────────────────────────────────────────────────────────

/**
 * Persist a browser push subscription for the current authenticated subject.
 * Idempotent: re-subscribing with the same endpoint updates existing row.
 */
export async function savePushSubscription(
  input: SaveSubscriptionInput
): Promise<SaveResult> {
  if (!input?.endpoint || !input?.p256dh || !input?.auth) {
    return { ok: false, error: "Invalid subscription payload." };
  }

  const subject = await resolveCurrentSubject();
  if (!subject) {
    return { ok: false, error: "Not signed in." };
  }

  const svc = await createServiceClient();

  const row = {
    subject_type: subject.type,
    subject_id: subject.id,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: input.userAgent ?? null,
    last_used_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .schema("future")
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Remove a subscription by endpoint.
 */
export async function removePushSubscription(
  endpoint: string
): Promise<SaveResult> {
  if (!endpoint) return { ok: false, error: "Missing endpoint." };

  const svc = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .schema("future")
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Send a push notification to all subscriptions owned by a given subject.
 * Silently cleans up dead subscriptions (410 Gone / 404 Not Found).
 */
export async function sendPushToSubject(
  subjectType: SubjectType,
  subjectId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, removed: 0 };
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

  if (rows.length === 0) return { sent: 0, failed: 0, removed: 0 };

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

// ════════════════════════════════════════════════════════════════════
// yi.push_subscriptions — admin notification channel (migration 135)
//
// Separate from future.push_subscriptions: scoped only to Supabase Auth
// users (admins), broadcast-targetable by super OR platform admins.
// Used by /national/admin/broadcast.
// ════════════════════════════════════════════════════════════════════

export type BroadcastFilter =
  | { kind: "all" }
  | { kind: "chapter"; chapterId: string }
  | { kind: "role"; role: "super" | "platform" | "national" | "chair" };

export type BroadcastResult =
  | { ok: true; sent: number; failed: number; removed: number }
  | { ok: false; error: string };

/**
 * Subscribe the currently-signed-in Supabase Auth user to web push.
 * Idempotent on (user_id, endpoint): re-subscribing updates last_seen_at.
 */
export async function subscribeToPush(
  input: SaveSubscriptionInput
): Promise<SaveResult> {
  if (!input?.endpoint || !input?.p256dh || !input?.auth) {
    return { ok: false, error: "Invalid subscription payload." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const svc = await createServiceClient();
  const row = {
    user_id: user.id,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: input.userAgent ?? null,
    last_seen_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .schema("yi")
    .from("push_subscriptions")
    .upsert(row, { onConflict: "user_id,endpoint" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Unsubscribe the currently-signed-in user from a specific endpoint.
 */
export async function unsubscribeFromPush(
  endpoint: string
): Promise<SaveResult> {
  if (!endpoint) return { ok: false, error: "Missing endpoint." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const svc = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .schema("yi")
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Inline guard: returns true iff signed-in user is super OR platform
 * admin in yi.national_admins. Non-redirecting (broadcast action returns
 * a typed error rather than a redirect mid-form-submit).
 */
async function isSuperOrPlatform(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return false;

  const email = user.email.trim().toLowerCase();
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("national_admins")
    .select("is_super_admin, is_platform_admin" as never)
    .eq("email", email)
    .maybeSingle<{ is_super_admin: boolean; is_platform_admin: boolean }>();

  return Boolean(data?.is_super_admin || data?.is_platform_admin);
}

/**
 * Broadcast a push notification to subscribed Supabase Auth users.
 * Gated to super OR platform admins. Silently prunes 404/410 dead subs.
 *
 * For MVP, only filter.kind === "all" sends to every row in
 * yi.push_subscriptions. Future filters (chapter / role) are stubbed
 * with a TODO — they require joins onto yi.chapter_chairs / national_admins.
 */
export async function broadcastPush(
  title: string,
  body: string,
  url?: string,
  filter?: BroadcastFilter
): Promise<BroadcastResult> {
  if (!title || !title.trim()) {
    return { ok: false, error: "Title is required." };
  }
  if (!body || !body.trim()) {
    return { ok: false, error: "Body is required." };
  }

  const ok = await isSuperOrPlatform();
  if (!ok) {
    return {
      ok: false,
      error: "Only super or platform admins can broadcast.",
    };
  }

  if (!configureWebPush()) {
    return { ok: false, error: "VAPID keys not configured on server." };
  }

  const svc = await createServiceClient();

  // For MVP we only support filter.kind === "all". The other filter
  // kinds will need joins onto admin/chair tables — wire them when the
  // UI exposes the option. We accept the param now to lock the API
  // shape so callers don't break later.
  void filter;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs } = await (svc as any)
    .schema("yi")
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");

  const rows: Array<{
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }> = Array.isArray(subs) ? subs : [];

  if (rows.length === 0) {
    return { ok: true, sent: 0, failed: 0, removed: 0 };
  }

  const payload = JSON.stringify({
    title: title.trim(),
    body: body.trim(),
    url: url && url.trim() ? url.trim() : "/",
    tag: "yi-broadcast",
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
          payload
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
      .schema("yi")
      .from("push_subscriptions")
      .delete()
      .in("id", deadIds);
  }

  return { ok: true, sent, failed, removed: deadIds.length };
}
