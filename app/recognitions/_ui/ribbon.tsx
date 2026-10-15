import { VERTICALS, type AwardKind } from "@/lib/recognitions/constants";

type Stripes = Array<[string, number]>;

/**
 * The signature: each recognition wears its own medal-ribbon stripe, like
 * the ribbon bar of an order of merit. [colour var, relative width].
 * Keyed by the recognition's key (recognition_awards.vertical).
 */
const STRIPES: Record<string, Stripes> = {
  membership: [["--rx-laurel", 3], ["--rx-gilt", 2], ["--rx-laurel", 3]],
  learning: [["--rx-cobalt", 3], ["--rx-ivory", 1], ["--rx-cobalt", 1], ["--rx-ivory", 1], ["--rx-cobalt", 3]],
  impact: [["--rx-vermilion", 2], ["--rx-gilt", 1], ["--rx-vermilion", 3], ["--rx-gilt", 1], ["--rx-vermilion", 2]],
  future: [["--rx-teal", 2], ["--rx-ivory", 1], ["--rx-teal", 2], ["--rx-ivory", 1], ["--rx-teal", 2]],
  climate: [["--rx-forest", 3], ["--rx-sky", 2], ["--rx-forest", 3]],
  rural: [["--rx-saffron", 3], ["--rx-laurel", 1], ["--rx-saffron", 1], ["--rx-laurel", 1], ["--rx-saffron", 3]],
  health: [["--rx-rose", 3], ["--rx-ivory", 1], ["--rx-rose", 1], ["--rx-ivory", 1], ["--rx-rose", 3]],
  // recognitions_04 (2026): the other seven of the fourteen.
  masoom: [["--rx-plum", 3], ["--rx-ivory", 1], ["--rx-plum", 3]],
  road_safety: [["--rx-gilt", 2], ["--rx-ink", 1], ["--rx-gilt", 2], ["--rx-ink", 1], ["--rx-gilt", 2]],
  accessibility: [["--rx-sky", 3], ["--rx-cobalt", 1], ["--rx-sky", 3]],
  entrepreneurship: [["--rx-gilt", 3], ["--rx-vermilion", 1], ["--rx-gilt", 3]],
  innovation: [["--rx-teal", 3], ["--rx-gilt", 1], ["--rx-teal", 3]],
  yuva: [["--rx-vermilion", 3], ["--rx-ivory", 1], ["--rx-vermilion", 3]],
  thalir: [["--rx-forest", 2], ["--rx-saffron", 1], ["--rx-forest", 2], ["--rx-saffron", 1], ["--rx-forest", 2]],
  sports: [["--rx-cobalt", 2], ["--rx-saffron", 1], ["--rx-cobalt", 2]],
  branding: [["--rx-plum", 2], ["--rx-gilt", 1], ["--rx-plum", 1], ["--rx-gilt", 1], ["--rx-plum", 2]],
};

/** A recognition the app doesn't know by key wears its kind's ribbon. */
const KIND_STRIPES: Record<AwardKind, Stripes> = {
  project: [["--rx-forest", 2], ["--rx-ivory", 1], ["--rx-forest", 2]],
  initiative: [["--rx-cobalt", 2], ["--rx-gilt", 1], ["--rx-cobalt", 2]],
  stakeholder: [["--rx-laurel", 2], ["--rx-saffron", 1], ["--rx-laurel", 2]],
  sports: [["--rx-cobalt", 2], ["--rx-ivory", 1], ["--rx-saffron", 2]],
  branding: [["--rx-plum", 2], ["--rx-ivory", 1], ["--rx-plum", 2]],
};

/** Neither known nor given a kind: a plain neutral ribbon. */
const PLAIN: Stripes = [["--rx-line-strong", 2], ["--rx-ivory", 1], ["--rx-line-strong", 2]];

function stripesFor(vertical: string, kind?: AwardKind | null): Stripes {
  return STRIPES[vertical] ?? (kind ? KIND_STRIPES[kind] : undefined) ?? PLAIN;
}

export function ribbonGradient(vertical: string, kind?: AwardKind | null): string {
  const stripes = stripesFor(vertical, kind);
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
  kind,
  size = "md",
  className = "",
}: {
  vertical: string;
  /** The recognition's kind: picks the ribbon when the key is not a known one. */
  kind?: AwardKind | null;
  size?: "md" | "lg" | "tall";
  className?: string;
}) {
  const cls = size === "lg" ? "rx-ribbon rx-ribbon-lg" : size === "tall" ? "rx-ribbon rx-ribbon-tall" : "rx-ribbon";
  const gradient = ribbonGradient(vertical, kind);
  return (
    <span
      aria-hidden="true"
      className={`${cls} ${className}`}
      style={{ backgroundImage: size === "tall" ? gradient.replace("90deg", "180deg") : gradient }}
    />
  );
}

/** The thin band across the very top of every page: the ribbons of this year's recognitions. */
export function RibbonRail() {
  return (
    <div className="rx-rail" aria-hidden="true">
      {VERTICALS.map((v) => (
        <span key={v} style={{ backgroundImage: ribbonGradient(v) }} />
      ))}
    </div>
  );
}
