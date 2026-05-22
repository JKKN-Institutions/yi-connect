"use client";

import { Cloud, CloudOff, CheckCircle2, Loader2 } from "lucide-react";
import type { SyncState } from "@/hooks/yip/use-offline-sync";

/**
 * Mobile-first status pill that tells jurors whether their drafts are safe.
 * Rendered fixed-position on jury pages; always visible so nobody panics
 * when the auditorium Wi-Fi flaps.
 */
export function OfflineSyncBadge({ state }: { state: SyncState }) {
  const { isOnline, pendingCount, syncing, lastSyncResult } = state;

  // Precedence: syncing → offline-with-pending → offline → just-synced → online-idle
  if (syncing) {
    return (
      <Pill tone="amber" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" />
        Syncing {pendingCount > 0 ? `${pendingCount} ` : ""}draft
        {pendingCount === 1 ? "" : "s"}…
      </Pill>
    );
  }

  if (!isOnline && pendingCount > 0) {
    return (
      <Pill tone="red" aria-live="assertive">
        <CloudOff className="size-3.5" />
        Offline · {pendingCount} draft{pendingCount === 1 ? "" : "s"} queued
      </Pill>
    );
  }

  if (!isOnline) {
    return (
      <Pill tone="gray" aria-live="polite">
        <CloudOff className="size-3.5" />
        Offline
      </Pill>
    );
  }

  if (
    lastSyncResult &&
    lastSyncResult.synced > 0 &&
    pendingCount === 0
  ) {
    return (
      <Pill tone="green" aria-live="polite">
        <CheckCircle2 className="size-3.5" />
        Synced {lastSyncResult.synced}
      </Pill>
    );
  }

  if (pendingCount > 0) {
    return (
      <Pill tone="amber" aria-live="polite">
        <Cloud className="size-3.5" />
        {pendingCount} pending
      </Pill>
    );
  }

  // Online, nothing to show — render nothing to keep the UI clean.
  return null;
}

function Pill({
  tone,
  children,
  ...rest
}: {
  tone: "green" | "red" | "amber" | "gray";
  children: React.ReactNode;
  "aria-live"?: "polite" | "assertive";
}) {
  const palette: Record<typeof tone, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    gray: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div
      {...rest}
      role="status"
      className={`fixed top-[calc(env(safe-area-inset-top,0)+0.75rem)] right-3 z-50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm ${palette[tone]}`}
    >
      {children}
    </div>
  );
}
