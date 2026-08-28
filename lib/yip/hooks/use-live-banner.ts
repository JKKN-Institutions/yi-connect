"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/yip/supabase/client";

interface LiveBannerState {
  active: boolean;
  text: string | null;
  /** Whether the projector banner flashes. True is the behaviour the banner
   *  always had, so a payload from an older build looks unchanged. */
  pulse: boolean;
}

interface LiveBannerBroadcast {
  active: boolean;
  text: string | null;
  pulse?: boolean;
}

/**
 * useLiveBanner — Subscribes to the per-event live banner broadcast channel
 * (`yip:live-banner:<eventId>`) and returns the current banner state.
 *
 * Initial state is seeded from the event record (props). Updates arrive via
 * Supabase Realtime broadcast when an organizer pushes or clears a banner
 * from the control panel.
 */
export function useLiveBanner(
  eventId: string,
  initialActive: boolean,
  initialText: string | null
): LiveBannerState {
  const supabase = createClient();
  const [active, setActive] = useState<boolean>(initialActive);
  const [text, setText] = useState<string | null>(initialText);
  // Seeded true rather than from the event row: the choice rides the broadcast
  // and is not stored, so a projector reloaded mid-banner comes back flashing
  // until the next push. See pushLiveBanner for why it is not persisted.
  const [pulse, setPulse] = useState<boolean>(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Re-sync if initial props change (e.g. parent refetches event).
  useEffect(() => {
    setActive(initialActive);
  }, [initialActive]);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`yip:live-banner:${eventId}`)
      .on("broadcast", { event: "update" }, (msg) => {
        const payload = msg.payload as LiveBannerBroadcast | undefined;
        if (!payload) return;
        setActive(Boolean(payload.active));
        setText(payload.active ? (payload.text ?? null) : null);
        // Absent on a payload from an older build — treat as flashing, which is
        // exactly what those builds did.
        setPulse(payload.pulse !== false);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return { active, text, pulse };
}
