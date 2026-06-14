"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return "moments ago";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

/**
 * Offline staleness stamp for the student dashboard. The dashboard is
 * server-rendered and cached by the service worker (NetworkFirst), so when the
 * student is offline they're shown the LAST-LOADED copy. This makes that
 * explicit — `renderedAt` is stamped at server-render time, so a cached page
 * served offline shows how old it is, preventing stale results/live-status from
 * being mistaken for current. Renders nothing while online.
 */
export function OfflineStaleNote({ renderedAt }: { renderedAt: string }) {
  const [offline, setOffline] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Refresh the "X ago" label while the student stays offline.
    const interval = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <Clock className="mt-0.5 size-3.5 shrink-0" />
      <span>
        You&rsquo;re viewing a saved copy from {relativeTime(renderedAt)}.
        Reconnect for the latest — live status, votes and results may have
        changed since.
      </span>
    </div>
  );
}
