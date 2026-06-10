/**
 * Tiny display formatters shared by the Phase 8 public pages/cards.
 * Plain module — safe in RSCs and client components alike.
 */

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
});

/** "12 Jun 2026" — date-only columns and timestamps alike; null-safe. */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return DATE_FMT.format(d);
}

/** "12 Jun 2026, 10:30 am" for timestamptz values; null-safe. */
export function formatDateTime(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return DATE_TIME_FMT.format(d);
}

/** "10:30 am" for timestamptz values; null-safe. */
export function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return TIME_FMT.format(d);
}

/** "12 Jun – 28 Aug 2026" (graceful when either side is missing). */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s ?? e;
}

/** Total program hours from snapshot session minutes: "12 hours" / "12.5 hours". */
export function formatHours(totalMinutes: number): string | null {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null;
  const hours = totalMinutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${label} hour${rounded === 1 ? "" : "s"}`;
}

/** "45 min" / "1.5 hr" per-session duration. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}
