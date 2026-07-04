"use client";

import { useCallback } from "react";
import { Hand } from "lucide-react";
import { useSpeakingFloorLive } from "@/lib/yip/hooks/use-speaking-floor";
import {
  getSpeakingFloorStats,
  type SpeakingFloorStats,
} from "@/app/yip/actions/speaking-floor";

/**
 * ProjectorFairnessMeter — the public "N of M have spoken" panel on the big
 * screen (the "Both" decision: public aggregate here + detailed per-member
 * breakdown on the Chair panel). Aggregate ONLY — it never names anyone, so it
 * creates gentle social pressure toward speaking equity without putting a
 * student on the spot.
 *
 * Self-hides: only during a live session, and only once the floor is actually
 * in use (someone has spoken or is waiting) — so a session never opens with a
 * demoralising "0 of 60" banner. Corner overlay so it doesn't disturb the main
 * projector content; hidden while an AI Moment scene is on screen (visible prop).
 */
export function ProjectorFairnessMeter({
  eventId,
  visible,
}: {
  eventId: string;
  visible: boolean;
}) {
  const { data } = useSpeakingFloorLive<SpeakingFloorStats>(
    eventId,
    useCallback(async () => {
      const res = await getSpeakingFloorStats(eventId);
      return res.success ? res.data : null;
    }, [eventId]),
    { trackTurns: true }
  );

  if (!visible || !data || !data.hasLiveItem || data.totalParticipants === 0) {
    return null;
  }
  // Don't show a "0 of N" banner before anyone has engaged the floor.
  if (data.spokenCount === 0 && data.waitingCount === 0) return null;

  const pct = Math.round((data.spokenCount / data.totalParticipants) * 100);

  return (
    <div className="fixed bottom-8 left-8 z-30 w-72 rounded-2xl border border-white/10 bg-black/60 px-5 py-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF9933]">
          <Hand className="size-3.5" />
          Speaking Floor
        </p>
        {data.waitingCount > 0 && (
          <span className="text-[11px] font-medium text-white/60">
            {data.waitingCount} waiting
          </span>
        )}
      </div>

      <p className="mt-2 text-white">
        <span className="text-3xl font-black tabular-nums">
          {data.spokenCount}
        </span>
        <span className="text-lg font-bold text-white/40">
          {" "}
          of {data.totalParticipants}
        </span>
        <span className="ml-1.5 text-sm font-semibold text-white/60">
          have spoken
        </span>
      </p>

      <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 66 ? "#138808" : "#FF9933",
          }}
        />
      </div>
    </div>
  );
}
