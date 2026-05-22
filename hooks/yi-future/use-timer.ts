"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
 * Play a short beep tone using the Web Audio API.
 * 880 Hz, sine wave, 0.3 second duration.
 */
function playExpireBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    // Fade out near the end to avoid click
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);

    // Clean up the AudioContext after the tone finishes
    oscillator.onended = () => {
      ctx.close();
    };
  } catch {
    // Web Audio API not available — silently skip
  }
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

  // Track the previous expired state so the beep only fires on the transition
  const wasExpiredRef = useRef(false);

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

  // Play beep exactly once when timer transitions from active to expired
  useEffect(() => {
    if (isExpired && !wasExpiredRef.current) {
      playExpireBeep();
    }
    wasExpiredRef.current = isExpired;
  }, [isExpired]);

  return {
    seconds: remaining,
    minutes,
    displaySeconds,
    display: `${String(minutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`,
    isExpired,
    isActive,
  };
}
