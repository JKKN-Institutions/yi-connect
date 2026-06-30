import { MINISTRIES } from "@/lib/yip/constants";

// Per-event cabinet configuration helpers.
//
// The chapter handbook ships 8 default ministries (MINISTRIES in constants.ts),
// but a chapter may run a different number (e.g. Erode 2026 announced 10). Those
// are stored per-event on `events.cabinet_ministries` (jsonb [{key,label}]) and
// `events.cabinet_ministry_count` (int). When unset, everything falls back to
// the MINISTRIES constant so other chapters are unaffected.
//
// These are PURE, client-safe functions (no DB, no "use server") so allocation
// UI, the vote manager, and the readiness board can all share one source.

export type MinistryPortfolio = { key: string; label: string };

/**
 * The effective cabinet portfolios for an event: the per-event override when
 * set, else the MINISTRIES constant.
 */
export function effectiveMinistries(
  cabinetMinistries: unknown
): MinistryPortfolio[] {
  if (Array.isArray(cabinetMinistries) && cabinetMinistries.length > 0) {
    const cleaned = cabinetMinistries
      .filter(
        (m): m is MinistryPortfolio =>
          !!m &&
          typeof m === "object" &&
          typeof (m as MinistryPortfolio).key === "string" &&
          typeof (m as MinistryPortfolio).label === "string"
      )
      .map((m) => ({ key: m.key, label: m.label }));
    if (cleaned.length > 0) return cleaned;
  }
  return MINISTRIES.map((m) => ({ key: m.key, label: m.label }));
}

/**
 * Resolve a ministry KEY to its display label using the event's effective
 * portfolios first, then the static MINISTRIES default, then the raw key as a
 * last resort. Pure / client-safe so every ministry-routing surface (the QH
 * submit form + question list, the organiser control view, the Shadow desk and
 * the Minister desk) shares ONE resolver — no per-file static label maps.
 */
export function ministryLabel(
  key: string | null | undefined,
  ministries: MinistryPortfolio[]
): string {
  if (!key) return "";
  const inCabinet = ministries.find((m) => m.key === key);
  if (inCabinet) return inCabinet.label;
  const inDefault = MINISTRIES.find((m) => m.key === key);
  return inDefault ? inDefault.label : key;
}

/**
 * Effective number of cabinet seats: an explicit count override wins, else the
 * number of effective portfolios.
 */
export function effectiveCabinetCount(
  cabinetMinistryCount: number | null | undefined,
  cabinetMinistries: unknown
): number {
  if (typeof cabinetMinistryCount === "number" && cabinetMinistryCount > 0) {
    return cabinetMinistryCount;
  }
  return effectiveMinistries(cabinetMinistries).length;
}

/** True when the organiser has explicitly configured a per-event cabinet. */
export function hasCabinetOverride(
  cabinetMinistryCount: number | null | undefined,
  cabinetMinistries: unknown
): boolean {
  return (
    (typeof cabinetMinistryCount === "number" && cabinetMinistryCount > 0) ||
    (Array.isArray(cabinetMinistries) && cabinetMinistries.length > 0)
  );
}
