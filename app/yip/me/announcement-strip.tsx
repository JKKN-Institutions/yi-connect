"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { getEventAnnouncements } from "./announcement-actions";

type Item = { id: string; body: string; createdAt: string };

interface Props {
  eventId: string;
  participantId: string;
}

/**
 * Error boundary. The strip lives directly above the live ballot, so if
 * anything inside it throws during render we swallow it and render NOTHING —
 * the ballot below must never be taken down by an announcement bug.
 */
class StripBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — announcements are non-critical */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function AnnouncementStripInner({ eventId, participantId }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      // Skip work while the tab is hidden (battery + needless polling).
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const next = await getEventAnnouncements(eventId, participantId);
        if (mounted.current) setItems(Array.isArray(next) ? next : []);
      } catch {
        if (mounted.current) setItems([]);
      }
    };

    load();
    timer = setInterval(load, 25000);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted.current = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [eventId, participantId]);

  // Nothing to announce → render nothing (keeps the ballot uncluttered).
  if (items.length === 0) return null;

  // Seamless marquee: render the track twice and translate -50% so the loop is
  // continuous. Duration scales with the amount of text so the speed stays
  // comfortable whether there are 1 or 10 announcements.
  const durationSec = Math.max(24, items.length * 7);

  const Track = ({ ariaHidden }: { ariaHidden?: boolean }) => (
    <div
      className="flex shrink-0 items-center gap-10 pr-10"
      aria-hidden={ariaHidden}
    >
      {items.map((it) => (
        <span
          key={(ariaHidden ? "dup-" : "") + it.id}
          className="text-sm font-medium text-amber-900/90"
        >
          {it.body}
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50">
      <style>{`
        @keyframes yipAnnScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .yip-ann-track { animation: none !important; }
        }
      `}</style>
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center gap-2 border-r border-amber-200/70 bg-amber-100/80 px-3">
          <Megaphone className="size-4 shrink-0 text-amber-700" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            News
          </span>
        </div>
        <div
          className="relative flex-1 overflow-hidden py-2"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
          }}
        >
          <div
            className="yip-ann-track flex w-max whitespace-nowrap hover:[animation-play-state:paused]"
            style={{ animation: `yipAnnScroll ${durationSec}s linear infinite` }}
          >
            <Track />
            <Track ariaHidden />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnnouncementStrip(props: Props) {
  return (
    <StripBoundary>
      <AnnouncementStripInner {...props} />
    </StripBoundary>
  );
}
