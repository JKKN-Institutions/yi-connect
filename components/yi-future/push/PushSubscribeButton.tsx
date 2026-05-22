"use client";

import { useEffect, useState } from "react";
import {
  savePushSubscription,
  removePushSubscription,
} from "@/app/yi-future/actions/push";

type State =
  | "loading"
  | "unsupported"
  | "denied"
  | "idle"
  | "subscribing"
  | "subscribed"
  | "unsubscribing"
  | "error";

type Props = {
  vapidPublicKey: string | null;
  className?: string;
};

// ─── HELPERS ────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof window !== "undefined" ? window.atob(base64) : "";
  // Explicit ArrayBuffer (not SharedArrayBuffer) backing for PushManager typings.
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== "undefined" ? window.btoa(binary) : "";
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

// ─── COMPONENT ──────────────────────────────────────────────────────
export default function PushSubscribeButton({
  vapidPublicKey,
  className = "",
}: Props) {
  const [state, setState] = useState<State>("loading");
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isPushSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (existing) {
          setCurrentEndpoint(existing.endpoint);
          setState("subscribed");
        } else {
          setState("idle");
        }
      } catch {
        if (!cancelled) setState("idle");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe() {
    setErrorMsg(null);
    if (!vapidPublicKey) {
      setErrorMsg("Push not configured on server.");
      setState("error");
      return;
    }
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }

    setState("subscribing");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "idle");
        return;
      }

      // Ensure SW is registered (layout inline script handles this on load,
      // but guard here for race where user clicks before SW ready).
      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = sub.toJSON();
      const p256dh =
        (json.keys && json.keys.p256dh) ||
        arrayBufferToBase64(sub.getKey("p256dh"));
      const auth =
        (json.keys && json.keys.auth) || arrayBufferToBase64(sub.getKey("auth"));

      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh,
        auth,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });

      if (!result.ok) {
        setErrorMsg(result.error);
        setState("error");
        return;
      }

      setCurrentEndpoint(sub.endpoint);
      setState("subscribed");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Subscription failed.");
      setState("error");
    }
  }

  async function handleUnsubscribe() {
    setErrorMsg(null);
    setState("unsubscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const endpoint = existing?.endpoint ?? currentEndpoint ?? "";
      if (existing) await existing.unsubscribe();
      if (endpoint) await removePushSubscription(endpoint);
      setCurrentEndpoint(null);
      setState("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unsubscribe failed.");
      setState("error");
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────
  const baseBtn =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors";

  if (state === "loading") {
    return (
      <div
        className={`flex items-center gap-2 text-xs text-navy/50 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-navy/30 animate-pulse" />
        Checking notifications…
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className={`text-xs text-navy/50 ${className}`}>
        Notifications not supported in this browser.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={`text-xs text-yi-saffron ${className}`}>
        Notifications blocked. Enable them in your browser site settings.
      </div>
    );
  }

  if (state === "subscribed") {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy">
          <span className="w-2 h-2 rounded-full bg-yi-gold" />
          Notifications on
        </span>
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={state !== "subscribed"}
          className={`${baseBtn} border border-navy/20 text-navy/70 hover:border-navy/40 disabled:opacity-60`}
        >
          Disable
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={state === "subscribing"}
        className={`${baseBtn} bg-navy text-ivory hover:bg-navy-dark disabled:opacity-60`}
      >
        {state === "subscribing" ? "Enabling…" : "Enable notifications"}
      </button>
      {errorMsg && <span className="text-xs text-yi-saffron">{errorMsg}</span>}
    </div>
  );
}
