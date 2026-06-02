/**
 * Shared app/role display labels for the cross-vertical directory (2026-06-02).
 *
 * Single source of truth so the directory list, access-review, and any future
 * surface agree on labels — the inline copies in directory-list-client were
 * stale (missing app='platform' and app='yifi' that exist in live data).
 */

export const APP_OPTIONS = [
  { value: "platform", label: "Platform" },
  { value: "yip", label: "YIP" },
  { value: "future", label: "Yi-Future" },
  { value: "yifi", label: "YiFi" },
  { value: "yuva", label: "Yuva" },
  { value: "thalir", label: "Thalir" },
  { value: "masoom", label: "Masoom" },
  { value: "yi", label: "Yi (cross)" },
] as const;

export const APP_BADGE_CLASS: Record<string, string> = {
  platform: "bg-violet-100 text-violet-800 border-violet-200",
  yip: "bg-orange-100 text-orange-800 border-orange-200",
  future: "bg-indigo-100 text-indigo-800 border-indigo-200",
  yifi: "bg-teal-100 text-teal-800 border-teal-200",
  yuva: "bg-emerald-100 text-emerald-800 border-emerald-200",
  thalir: "bg-pink-100 text-pink-800 border-pink-200",
  masoom: "bg-amber-100 text-amber-800 border-amber-200",
  yi: "bg-slate-200 text-slate-900 border-slate-300",
};

export function appLabel(app: string): string {
  return APP_OPTIONS.find((a) => a.value === app)?.label ?? app;
}

export function appBadgeClass(app: string): string {
  return APP_BADGE_CLASS[app] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

/** Humanise a role value (snake_case → Title Case) for display. */
export function roleLabel(role: string): string {
  return role
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
