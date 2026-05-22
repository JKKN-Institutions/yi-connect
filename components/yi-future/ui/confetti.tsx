"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

/**
 * fireConfetti — fires a short celebration burst.
 * Color palette tuned to Yi brand (navy, gold, saffron, green).
 */
export function fireConfetti(opts?: { intensity?: "subtle" | "normal" | "big" }) {
  const intensity = opts?.intensity ?? "normal";
  const count =
    intensity === "subtle" ? 60 : intensity === "big" ? 250 : 140;
  const defaults = {
    origin: { y: 0.7 },
    colors: ["#1a1a3e", "#F5A623", "#FF9933", "#138808", "#FEFCF6"],
    scalar: 1.1,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}

export function useConfetti() {
  return useCallback((i?: "subtle" | "normal" | "big") => fireConfetti({ intensity: i }), []);
}
