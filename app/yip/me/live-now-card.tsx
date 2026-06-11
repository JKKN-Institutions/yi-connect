"use client";

import { Radio, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { useRealtimeEvent } from "@/lib/yip/hooks/use-realtime-event";
import { useTimer } from "@/lib/yip/hooks/use-timer";

interface LiveNowCardProps {
  eventId: string;
}

/**
 * Live now — subscribes to the event's current agenda item + the live timer
 * so the student sees, on their own phone, which session is on and how much
 * time remains. Realtime (no manual refresh) via useRealtimeEvent + useTimer,
 * the same hooks the projector and control panel use.
 *
 * Renders nothing until the event is actually live (a current agenda item is
 * set), so the card stays out of the way before/after the session.
 */
export function LiveNowCard({ eventId }: LiveNowCardProps) {
  const { event, currentAgendaItem } = useRealtimeEvent(eventId);

  const timer = useTimer(
    event?.live_timer_end ?? null,
    event?.live_timer_running ?? false
  );

  // Nothing live yet — keep the dashboard uncluttered.
  if (!currentAgendaItem) return null;

  const showTimer = timer.isActive || timer.isExpired;

  return (
    <Card className="border-red-200 bg-gradient-to-r from-red-50 to-rose-50 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-red-500 to-rose-400 animate-pulse" />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500">
              <Radio className="size-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                Live Now
              </p>
              <p className="text-base font-bold text-gray-900 truncate">
                {currentAgendaItem.title}
              </p>
              {event?.live_timer_label && (
                <p className="text-xs text-gray-600 mt-0.5 truncate">
                  {event.live_timer_label}
                </p>
              )}
            </div>
          </div>

          {showTimer && (
            <div className="flex shrink-0 flex-col items-center">
              <div className="flex items-center gap-1">
                <Clock
                  className={`size-3.5 ${
                    timer.isExpired ? "text-red-600" : "text-gray-500"
                  }`}
                />
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${
                    timer.isExpired
                      ? "text-red-600"
                      : timer.seconds <= 30
                        ? "text-orange-600"
                        : "text-gray-900"
                  }`}
                >
                  {timer.isExpired ? "00:00" : timer.display}
                </span>
              </div>
              <span className="text-[10px] text-gray-400">
                {timer.isExpired ? "Time up" : "remaining"}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
