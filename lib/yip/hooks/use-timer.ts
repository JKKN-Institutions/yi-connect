"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { playWarningBeep, playTimesUpChime } from "@/lib/yip/timer-sound";

interface TimerResult {
  /** Total seconds remaining (0 if expired) */
  seconds: number;
  /** Minutes component of remaining time */
  minutes: number;
  /** Seconds component (within current minute) */
  displaySeconds: number;
  /** Formatted mm:ss string */
  display: string;
  /** True when timer has reached 0 */
  isExpired: boolean;
  /** True when timer is actively counting down */
  isActive: boolean;
}

/**
 * useTimer — Server-timestamp-based countdown timer.
 *
 * The timer end is stored as an ISO timestamp in the database.
 * Client computes: remaining = timerEnd - Date.now()
 * This means ALL clients show the same time (no drift between devices).
 */
export function useTimer(
  timerEnd: string | null,
  isRunning: boolean
): TimerResult {
  const computeRemaining = useCallback(() => {
    if (!timerEnd || !isRunning) return 0;
    const remaining = Math.max(
      0,
      Math.ceil((new Date(timerEnd).getTime() - Date.now()) / 1000)
    );
    return remaining;
  }, [timerEnd, isRunning]);

  const [remaining, setRemaining] = useState<number>(computeRemaining);

  // Fire each cue exactly once per transition: a heads-up beep when crossing
  // into the final 10s, and the time's-up chime on active→expired. warnedRef
  // re-arms whenever remaining climbs back above 10s (a fresh / reset timer).
  const wasExpiredRef = useRef(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    // Immediately compute on prop change
    setRemaining(computeRemaining());

    if (!timerEnd || !isRunning) return;

    const interval = setInterval(() => {
      const r = computeRemaining();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
      }
    }, 200); // Update 5x/sec for smooth display

    return () => clearInterval(interval);
  }, [timerEnd, isRunning, computeRemaining]);

  const minutes = Math.floor(remaining / 60);
  const displaySeconds = remaining % 60;

  const isExpired = Boolean(timerEnd) && isRunning && remaining <= 0;
  const isActive = Boolean(timerEnd) && isRunning && remaining > 0;

  // Sound cues. These only actually play on a screen that armed sound with a
  // tap (see lib/yip/timer-sound.ts); everywhere else they are silent no-ops.
  //  • warning beep once when remaining first drops to ≤10s
  //  • time's-up chime once on the active→expired transition
  useEffect(() => {
    if (isActive && remaining <= 10 && !warnedRef.current) {
      playWarningBeep();
      warnedRef.current = true;
    }
    if (remaining > 10) warnedRef.current = false; // re-arm for a fresh/reset timer

    if (isExpired && !wasExpiredRef.current) {
      playTimesUpChime();
    }
    wasExpiredRef.current = isExpired;
  }, [remaining, isActive, isExpired]);

  return {
    seconds: remaining,
    minutes,
    displaySeconds,
    display: `${String(minutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`,
    isExpired,
    isActive,
  };
}
