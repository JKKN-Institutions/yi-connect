"use client";

import { useEffect, useRef, useState } from "react";

/**
 * <CountUp to={127} /> — rAF-driven integer counter. Mobile-friendly.
 * Accepts prefix/suffix for "₹" or " delegates".
 */
export function CountUp({
  to,
  durationMs = 1400,
  prefix = "",
  suffix = "",
  className = "",
}: {
  to: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setValue(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.floor(eased * to));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(to);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);

  return (
    <span className={className}>
      {prefix}
      {value.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
