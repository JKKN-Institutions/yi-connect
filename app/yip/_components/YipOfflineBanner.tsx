"use client";

import { usePathname } from "next/navigation";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";

// Public / non-dashboard routes where a "You're offline" banner is wrong:
// the projector display (shown to the whole auditorium), the landing page, and
// the access-code / organiser login pages.
function isExcluded(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === "/yip") return true; // landing
  if (pathname.includes("/display")) return true; // projector
  return (
    pathname.startsWith("/yip/join") ||
    pathname.startsWith("/yip/login") ||
    pathname.startsWith("/yip/test-login")
  );
}

/**
 * Connection-status banner, scoped to the YIP DASHBOARDS (student / volunteer /
 * jury / organiser) only — not the public projector view or the login/landing
 * pages, where a transient "offline" banner would be confusing or embarrassing
 * (e.g. on the big screen). Mounted once in app/yip/layout.tsx.
 */
export function YipOfflineBanner() {
  const pathname = usePathname();
  if (isExcluded(pathname)) return null;
  return (
    <OfflineIndicator message="You're offline — you can still view this page. Reconnect to sync and to vote." />
  );
}
