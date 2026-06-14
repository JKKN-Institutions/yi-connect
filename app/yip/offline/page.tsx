import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Offline",
  description: "You're offline. Reconnect and try again.",
  robots: { index: false, follow: false },
};

/**
 * YIP offline fallback page. Public + static (no auth, no data) so it can be
 * served when a /yip route is opened with no connection. Reachable directly at
 * /yip/offline; wiring it as the service-worker navigation fallback for
 * never-visited /yip routes is a deliberate follow-up (shared-SW change).
 */
export default function YipOfflinePage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#FF9933]/10">
        <WifiOff className="size-8 text-[#FF9933]" />
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#FF9933]">
        No connection
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#1a1a3e] sm:text-3xl">
        You&rsquo;re offline
      </h1>
      <p className="mt-3 max-w-sm text-sm text-[#1a1a3e]/60">
        Pages you&rsquo;ve already opened stay available offline. For live
        actions like voting, reconnect to the internet and try again.
      </p>
      <Link
        href="/yip/me"
        className="mt-8 inline-flex min-h-[44px] items-center rounded-lg bg-[#FF9933] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#E68A2E]"
      >
        Try again
      </Link>
    </main>
  );
}
