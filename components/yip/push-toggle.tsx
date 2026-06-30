"use client";

/**
 * Participant push-notification opt-in for YIP. A student taps "Turn on" once,
 * grants the browser permission, and their web-push subscription is stored
 * against their participant id (so @-mentions can reach their phone). Uses the
 * app's existing service worker (Serwist) + VAPID public key.
 *
 * iOS note: Safari only allows web push from an installed PWA, so on iPhone the
 * student must "Add to Home Screen" first; we surface a hint if subscribe fails.
 */

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import {
  saveParticipantPushSubscription,
  removeParticipantPushSubscription,
} from "@/app/yip/actions/push";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "unsupported" | "off" | "on" | "denied" | "busy";

export function PushToggle({
  participantId,
  eventId,
}: {
  participantId: string;
  eventId: string;
}) {
  const [state, setState] = useState<State>("busy");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (active) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active) setState(sub ? "on" : "off");
      } catch {
        if (active) setState("off");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setHint(null);
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setHint("Notifications aren't configured yet. Tell the organisers.");
        setState("off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: our Uint8Array is ArrayBuffer-backed at runtime; the DOM lib's
        // BufferSource type rejects the generic ArrayBufferLike union.
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await saveParticipantPushSubscription({
        participantId,
        eventId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (res.ok) {
        setState("on");
      } else {
        setHint(res.error ?? "Couldn't turn on notifications.");
        setState("off");
      }
    } catch {
      setHint(
        "Couldn't enable notifications. On iPhone, add this app to your Home Screen first, then try again."
      );
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeParticipantPushSubscription({
          participantId,
          eventId,
          endpoint: sub.endpoint,
        });
        await sub.unsubscribe();
      }
    } catch {
      /* best effort */
    }
    setState("off");
  }

  if (state === "unsupported") return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        {state === "on" ? (
          <Bell className="size-4 text-[#138808]" />
        ) : (
          <BellOff className="size-4 text-gray-400" />
        )}
        <div>
          <p className="font-medium text-gray-900">Notifications</p>
          <p className="text-xs text-gray-500">
            {state === "on"
              ? "On — you'll be pinged when someone @mentions you."
              : state === "denied"
                ? "Blocked in your browser settings."
                : "Get pinged when someone @mentions you."}
          </p>
          {hint && <p className="mt-0.5 text-xs text-amber-600">{hint}</p>}
        </div>
      </div>
      {state === "denied" ? null : (
        <button
          type="button"
          disabled={state === "busy"}
          onClick={state === "on" ? disable : enable}
          className={
            state === "on"
              ? "shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              : "shrink-0 rounded-lg bg-[#FF9933] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#E68A2E] disabled:opacity-50"
          }
        >
          {state === "busy" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : state === "on" ? (
            "Turn off"
          ) : (
            "Turn on"
          )}
        </button>
      )}
    </div>
  );
}
