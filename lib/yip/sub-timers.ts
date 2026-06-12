// Sub-phase timer presets for the live Control panel.
//
// During certain sessions the organiser fires SHORT timers repeatedly —
// e.g. Question Hour: each question 60s, answer 90s, follow-up 30s. Presets
// are per-agenda-item: an organiser override lives in yip.agenda.config
// under the `sub_timers` key (JSONB), otherwise we fall back to the
// per-agenda_type defaults below.
//
// Plain lib file on purpose — a "use server" file may only export async
// functions, and these are types/constants/sync helpers (breaks Vercel
// builds otherwise).

export interface SubTimer {
  label: string;
  seconds: number;
}

export const DEFAULT_SUB_TIMERS: Record<string, SubTimer[]> = {
  question_hour: [
    { label: "Question", seconds: 60 },
    { label: "Answer", seconds: 90 },
    { label: "Follow-up", seconds: 30 },
  ],
  zero_hour: [
    { label: "Mention", seconds: 30 },
    { label: "Extended", seconds: 60 },
  ],
  debate: [
    { label: "Speech", seconds: 120 },
    { label: "Rebuttal", seconds: 60 },
  ],
};

// Validation bounds — shared by the server action and the inline editor.
export const SUB_TIMER_MAX_ENTRIES = 10;
export const SUB_TIMER_LABEL_MAX = 30;
export const SUB_TIMER_MIN_SECONDS = 5;
export const SUB_TIMER_MAX_SECONDS = 3600;

/** Shape guard for one {label, seconds} entry — config is untrusted JSONB. */
export function isSubTimer(value: unknown): value is SubTimer {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.label === "string" &&
    v.label.trim().length > 0 &&
    typeof v.seconds === "number" &&
    Number.isFinite(v.seconds) &&
    v.seconds > 0
  );
}

/**
 * Resolve the sub-timer presets for an agenda item.
 * Priority: valid config.sub_timers override → agenda_type default → [].
 * Any malformed config (wrong type, empty array, bad entry shape) falls
 * back to the defaults rather than throwing.
 */
export function getSubTimers(
  agendaType: string | null | undefined,
  config: unknown
): SubTimer[] {
  if (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config)
  ) {
    const raw = (config as Record<string, unknown>).sub_timers;
    if (Array.isArray(raw) && raw.length > 0 && raw.every(isSubTimer)) {
      return raw.map((t) => ({
        label: t.label,
        seconds: Math.round(t.seconds),
      }));
    }
  }
  return agendaType ? (DEFAULT_SUB_TIMERS[agendaType] ?? []) : [];
}

/** Format seconds as m:ss for preset buttons (e.g. 90 → "1:30"). */
export function formatSubTimerSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.round(seconds % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
}
