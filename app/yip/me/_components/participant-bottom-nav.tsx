"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Landmark, Vote, MessageSquare, BookOpen } from "lucide-react";

import { cn } from "@/lib/yip/utils";
import { GuideDrawer } from "@/components/yip/guide";
import { GUIDES } from "@/lib/yip/guide/content";
import { type PrimaryDesk } from "@/lib/yip/participant-desk";

/**
 * ParticipantBottomNav — fixed bottom tab bar for the YIP participant PWA.
 *
 * Action-oriented + role-aware: Home · Desk · Vote · Chat · Guide. "Desk" points
 * at the viewer's primary desk (Committee Room for committee members, or their
 * leadership desk for office-bearers) — see lib/yip/participant-desk. The
 * role/phase-specific destinations (Motion, Questions, PM/Shadow extras, …) stay
 * as dashboard cards; this bar is only the always-relevant ones.
 *
 * Replaces the floating Guide FAB — the Guide tab opens the same GuideDrawer.
 * Pinned to the bottom (with safe-area inset) because YIP installs as a
 * standalone PWA with no browser chrome.
 */
export function ParticipantBottomNav({
  desk,
  chatEnabled,
  eventId,
}: {
  desk: PrimaryDesk | null;
  chatEnabled: boolean;
  eventId: string | null;
}) {
  const pathname = usePathname();
  const [guideOpen, setGuideOpen] = React.useState(false);

  type Tab = {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
  };

  const tabs: Tab[] = [
    { label: "Home", href: "/yip/me", icon: Home, active: pathname === "/yip/me" },
  ];
  if (desk) {
    tabs.push({
      label: desk.label,
      href: desk.href,
      icon: Landmark,
      active: pathname.startsWith(desk.href),
    });
  }
  tabs.push({
    label: "Vote",
    href: "/yip/me/vote",
    icon: Vote,
    active: pathname.startsWith("/yip/me/vote"),
  });
  if (chatEnabled) {
    tabs.push({
      label: "Chat",
      href: "/yip/me/chat",
      icon: MessageSquare,
      active: pathname.startsWith("/yip/me/chat"),
    });
  }

  const cellClasses =
    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors";

  return (
    <>
      <nav
        aria-label="Participant navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#FF9933]/15 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-lg items-stretch">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={cn(
                  cellClasses,
                  t.active
                    ? "text-[#FF9933]"
                    : "text-gray-500 hover:text-gray-900",
                )}
              >
                <Icon className="size-5" />
                <span className="leading-none">{t.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            aria-label="Open guide"
            className={cn(
              cellClasses,
              guideOpen ? "text-[#FF9933]" : "text-gray-500 hover:text-gray-900",
            )}
          >
            <BookOpen className="size-5" />
            <span className="leading-none">Guide</span>
          </button>
        </div>
      </nav>

      <GuideDrawer
        guide={GUIDES.student}
        eventId={eventId}
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
    </>
  );
}
