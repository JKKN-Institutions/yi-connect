import type { Vertical } from "@/lib/recognitions/constants";
import { VERTICALS } from "@/lib/recognitions/constants";

/**
 * The signature: each award wears its own medal-ribbon stripe, like the
 * ribbon bar of an order of merit. [colour var, relative width].
 */
const STRIPES: Record<Vertical, Array<[string, number]>> = {
  membership: [["--rx-laurel", 3], ["--rx-gilt", 2], ["--rx-laurel", 3]],
  learning: [["--rx-cobalt", 3], ["--rx-ivory", 1], ["--rx-cobalt", 1], ["--rx-ivory", 1], ["--rx-cobalt", 3]],
  impact: [["--rx-vermilion", 2], ["--rx-gilt", 1], ["--rx-vermilion", 3], ["--rx-gilt", 1], ["--rx-vermilion", 2]],
  future: [["--rx-teal", 2], ["--rx-ivory", 1], ["--rx-teal", 2], ["--rx-ivory", 1], ["--rx-teal", 2]],
  climate: [["--rx-forest", 3], ["--rx-sky", 2], ["--rx-forest", 3]],
  rural: [["--rx-saffron", 3], ["--rx-laurel", 1], ["--rx-saffron", 1], ["--rx-laurel", 1], ["--rx-saffron", 3]],
  health: [["--rx-rose", 3], ["--rx-ivory", 1], ["--rx-rose", 1], ["--rx-ivory", 1], ["--rx-rose", 3]],
};

export function ribbonGradient(vertical: Vertical): string {
  const stripes = STRIPES[vertical];
  const total = stripes.reduce((s, [, w]) => s + w, 0);
  let at = 0;
  const stops = stripes.map(([c, w]) => {
    const from = (at / total) * 100;
    at += w;
    const to = (at / total) * 100;
    return `var(${c}) ${from.toFixed(2)}% ${to.toFixed(2)}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function Ribbon({
  vertical,
  size = "md",
  className = "",
}: {
  vertical: Vertical;
  size?: "md" | "lg" | "tall";
  className?: string;
}) {
  const cls = size === "lg" ? "rx-ribbon rx-ribbon-lg" : size === "tall" ? "rx-ribbon rx-ribbon-tall" : "rx-ribbon";
  return (
    <span
      aria-hidden="true"
      className={`${cls} ${className}`}
      style={{
        backgroundImage:
          size === "tall" ? ribbonGradient(vertical).replace("90deg", "180deg") : ribbonGradient(vertical),
      }}
    />
  );
}

/** The thin band across the very top of every page: all seven ribbons. */
export function RibbonRail() {
  return (
    <div className="rx-rail" aria-hidden="true">
      {VERTICALS.map((v) => (
        <span key={v} style={{ backgroundImage: ribbonGradient(v) }} />
      ))}
    </div>
  );
}
