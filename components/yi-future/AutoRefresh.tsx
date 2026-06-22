"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a server-rendered dashboard showing LIVE data inside the PWA.
 *
 * The page renders fresh on the server, but an installed PWA / the Next.js
 * client router cache can serve a stale snapshot on soft-navigation or a
 * left-open tab (this is what froze the National Dashboard count at 1003 while
 * registrations kept coming in). `router.refresh()` re-fetches the current
 * route's server components, bypassing the client router cache, so the counts
 * update on their own — no manual reload. Fires on an interval and whenever the
 * tab regains focus.
 */
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const id = setInterval(refresh, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);
  return null;
}
