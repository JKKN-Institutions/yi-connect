"use client";

// Shared, gesture-armed sounds for the live session timer (projector + control
// panel). Browsers block all audio until a page receives a user gesture, so a
// screen must call armTimerSound() from a click/tap ONCE; after that the warning
// beep + time's-up chime play. A module-level AudioContext is reused so a single
// tap covers every later beep on that screen. Screens that never arm (e.g. a
// participant's phone) stay silent by design — nothing plays unless armed.

let ctx: AudioContext | null = null;
let armed = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = ctx ?? new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Unlock sound on THIS screen. Must be called from a user gesture (onClick).
 * Returns true if an AudioContext is available. Idempotent.
 */
export function armTimerSound(): boolean {
  const c = getCtx();
  if (!c) return false;
  void c.resume().catch(() => {});
  armed = true;
  return true;
}

export function isTimerSoundArmed(): boolean {
  return armed;
}

// Play a single sine tone. No-op unless this screen has been armed by a gesture.
function tone(freq: number, durationSec: number, peakGain: number) {
  if (!armed) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") void c.resume().catch(() => {});
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(peakGain, c.currentTime);
    // Exponential fade-out avoids an end-of-tone click.
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + durationSec + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Web Audio unavailable — silently skip. */
  }
}

/** Soft, short heads-up beep when entering the final seconds. */
export function playWarningBeep() {
  tone(660, 0.18, 0.25);
}

/** Louder, longer "time's up" chime at 0:00 — clearly distinct from the warning. */
export function playTimesUpChime() {
  tone(880, 0.45, 0.6);
}
