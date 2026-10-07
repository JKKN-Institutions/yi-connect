/**
 * Control-room date helpers. A <input type="datetime-local"> has no time
 * zone, so the control room always reads and writes it as IST
 * (Asia/Kolkata, +05:30 — India has no daylight saving) and stores
 * timestamptz.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;

/** timestamptz ISO -> "YYYY-MM-DDTHH:mm" in IST, for a datetime-local value. */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** datetime-local value read as IST -> ISO. Blank -> null. Unreadable -> error. */
export function istInputToIso(value: string | null | undefined): { iso: string | null } | { error: string } {
  const v = (value ?? "").trim();
  if (v === "") return { iso: null };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return { error: `"${v}" is not a date and time.` };
  const t = Date.parse(`${v}:00+05:30`);
  if (Number.isNaN(t)) return { error: `"${v}" is not a date and time.` };
  return { iso: new Date(t).toISOString() };
}

/** Filename-safe slug. */
export function safeName(raw: string): string {
  const dot = raw.lastIndexOf(".");
  const base = dot > 0 ? raw.slice(0, dot) : raw;
  const ext = dot > 0 ? raw.slice(dot + 1).toLowerCase() : "";
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "health-card";
  return ext ? `${slug}.${ext}` : slug;
}

export const HEALTH_CARD_EXTS = ["xlsx", "xls", "csv"] as const;
export const HEALTH_CARD_MAX_BYTES = 10 * 1024 * 1024;

export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Postgres unique-violation and friends, said plainly. */
export function plainDbError(message: string | undefined, fallback: string): string {
  const m = message ?? "";
  if (m.includes("recognition_cycles_one_current")) return "Another cycle is already current. Try again.";
  if (m.includes("recognition_cycles_weights_ck")) return "The three weights must be whole numbers that add up to 100.";
  if (m.includes("recognition_evaluators_one_leader")) return "This award already has an NMT leader. Remove that leader first.";
  if (m.includes("recognition_awards_cycle_id_vertical_key")) return "This cycle already has an award for that vertical.";
  if (m.includes("recognition_evaluators_region_ck")) return "A Regional Mentor needs a region; an NMT member must not have one.";
  if (m.includes("frozen") || m.includes("append-only")) return "That record is locked and can't be changed.";
  if (m.includes("duplicate key")) return `${fallback} It already exists.`;
  return fallback;
}
