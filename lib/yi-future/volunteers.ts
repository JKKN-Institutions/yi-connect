// Shared Yi-Future volunteer metadata — imported from server actions AND from
// client UI. Deliberately NOT a "use server" file: a "use server" module may
// export only async functions, so every type/const for volunteers lives here.
//
// Ported from lib/yip/volunteers.ts (the proven YIP model: 116 volunteers
// across 11 stations, each with a per-volunteer 6-char access code). Yi-Future
// needs a much narrower catalogue — the job is staffing a check-in desk — so
// the station list is short on purpose.

/** Keep in lockstep with the CHECK constraint in
 *  supabase/migrations/future_volunteers_checkin.sql. */
export type VolunteerStation =
  | "check_in"
  | "registration"
  | "help_desk"
  | "hospitality"
  | "av_tech"
  | "floating";

export const VOLUNTEER_STATIONS: {
  code: VolunteerStation;
  label: string;
  hint: string;
}[] = [
  {
    code: "check_in",
    label: "Check-in Desk",
    hint: "Marks delegates present as they arrive",
  },
  {
    code: "registration",
    label: "Registration Help",
    hint: "Walk-ins, name corrections — can also mark present",
  },
  { code: "help_desk", label: "Help Desk", hint: "Questions, directions" },
  { code: "hospitality", label: "Hospitality", hint: "Food, water, seating" },
  { code: "av_tech", label: "AV / Tech", hint: "Projector, mics, laptop" },
  { code: "floating", label: "Floating", hint: "Wherever needed" },
];

/**
 * The ONLY stations allowed to mark attendance. The desk gate is fail-closed:
 * a null/unknown station is DENIED, not defaulted. Mirrors
 * requireVolunteerStation() in lib/yip/auth/volunteer-station.ts.
 */
export const STATIONS_WITH_CHECKIN: VolunteerStation[] = [
  "check_in",
  "registration",
];

export function stationLabel(code: string | null | undefined): string {
  return VOLUNTEER_STATIONS.find((s) => s.code === code)?.label ?? "Unassigned";
}

export function isCheckInStation(code: string | null | undefined): boolean {
  return (
    !!code && STATIONS_WITH_CHECKIN.includes(code as VolunteerStation)
  );
}

/** A volunteer row as the chapter-admin screen needs it. */
export type FutureVolunteer = {
  id: string;
  edition_id: string;
  chapter_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  station: VolunteerStation;
  access_code: string | null;
  is_active: boolean;
  arrived: boolean;
  arrived_at: string | null;
  notes: string | null;
};

/** A session (future.phase_events row) the desk can work. */
export type DeskSession = {
  id: string;
  title: string;
  scheduled_at: string;
  venue: string | null;
  completed: boolean;
};

/** One roster line at the desk. NON-PII by design: name only. */
export type DeskRosterRow = {
  id: string;
  full_name: string;
  present: boolean;
};

export type DeskRoster = {
  /** Total ACTIVE delegates in this chapter+edition (exact, uncapped count). */
  total: number;
  /** How many are marked present for this session (exact, uncapped count). */
  presentCount: number;
  /** The rows to render — a bounded slice, never the whole chapter. */
  rows: DeskRosterRow[];
  /** True when `rows` is a truncated slice of a larger match set. */
  truncated: boolean;
};

/** How many roster rows a desk screen renders at once. */
export const DESK_ROSTER_LIMIT = 60;

/**
 * Every desk action returns this. There is no third "threw" state the UI has
 * to guess at: the actions catch their own failures and return ok:false with a
 * sentence a volunteer can act on.
 */
export type DeskResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
