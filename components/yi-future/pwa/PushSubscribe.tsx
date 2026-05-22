"use client";

import { useCallback, useEffect, useState } from "react";
import {
  subscribeToPush,
  unsubscribeFromPush,
} from "@/app/yi-future/actions/push";

/**
 * Push subscription opt-in for Supabase Auth users.
 *
 * Renders a single button that toggles between subscribed / unsubscribed
 * states. Stores subscriptions in yi.push_subscriptions (migration 135)
 * scoped to the current auth.uid().
 *
 * Browser support requirements:
 *   - serviceWorker + PushManager + Notification APIs
 *   - VAPID public key in NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *
 * Renders nothing if push isn't supported (e.g. iOS < 16.4, some
 * embedded webviews) or if the VAPID key isn't configured — silent
 * no-op rather than a broken button.
 */

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "subscribed"; endpoint: string }
  | { kind: "unsubscribed" }
  | { kind: "error"; message: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushSubscribe({
  className,
  label,
}: {
  className?: string;
  label?: string;
} = {}): React.JSX.Element | null {
  const [state, setState] = useState<State>({ kind: "idle" });
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  /* ─── Initial probe ─────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupported()) {
        if (!cancelled) setState({ kind: "unsupported" });
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState({ kind: "blocked" });
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (existing && Notification.permission === "granted") {
          setState({ kind: "subscribed", endpoint: existing.endpoint });
        } else {
          setState({ kind: "unsubscribed" });
        }
      } catch {
        if (!cancelled) setState({ kind: "unsubscribed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ─── Subscribe flow ────────────────────────────────────────────── */
  const handleEnable = useCallback(async () => {
    if (!vapidKey) {
      setState({
        kind: "error",
        message: "Push not configured (missing VAPID key).",
      });
      return;
    }
    setState({ kind: "loading" });

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(
          permission === "denied"
            ? { kind: "blocked" }
            : { kind: "unsubscribed" }
        );
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // BufferSource expects an ArrayBuffer-backed view. Some TS libs
        // narrow Uint8Array's buffer as ArrayBufferLike (incl. SharedArrayBuffer),
        // so copy into a fresh ArrayBuffer to satisfy the strict signature.
        const keyBytes = urlBase64ToUint8Array(vapidKey);
        const keyBuffer = new ArrayBuffer(keyBytes.byteLength);
        new Uint8Array(keyBuffer).set(keyBytes);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBuffer,
        });
      }

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const endpoint = json.endpoint || sub.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        setState({
          kind: "error",
          message: "Subscription missing keys.",
        });
        return;
      }

      const res = await subscribeToPush({
        endpoint,
        p256dh,
        auth,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      if (!res.ok) {
        setState({ kind: "error", message: res.error });
        return;
      }
      setState({ kind: "subscribed", endpoint });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Subscribe failed.",
      });
    }
  }, [vapidKey]);

  /* ─── Unsubscribe flow ──────────────────────────────────────────── */
  const handleDisable = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await unsubscribeFromPush(endpoint);
      }
      setState({ kind: "unsubscribed" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unsubscribe failed.",
      });
    }
  }, []);

  /* ─── Render ───────────────────────────────────────────────────── */
  // Silent no-op when push isn't viable
  if (state.kind === "unsupported") return null;
  if (!vapidKey) return null;

  const baseClasses =
    className ??
    "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60";

  if (state.kind === "blocked") {
    return (
      <button
        type="button"
        disabled
        className={baseClasses}
        title="Notifications blocked. Enable them in your browser settings."
      >
        Notifications blocked
      </button>
    );
  }

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <button type="button" disabled className={baseClasses}>
        Loading…
      </button>
    );
  }

  if (state.kind === "subscribed") {
    return (
      <button type="button" onClick={handleDisable} className={baseClasses}>
        Notifications enabled (turn off)
      </button>
    );
  }

  if (state.kind === "error") {
    return (
      <button
        type="button"
        onClick={handleEnable}
        className={baseClasses}
        title={state.message}
      >
        Retry enable notifications
      </button>
    );
  }

  // unsubscribed
  return (
    <button type="button" onClick={handleEnable} className={baseClasses}>
      {label ?? "Enable notifications"}
    </button>
  );
}
