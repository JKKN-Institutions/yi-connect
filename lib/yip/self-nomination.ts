/**
 * YIP Self-Nomination — pure module (catalogue, types, helpers).
 *
 * Students put themselves forward for one or more of three roles BEFORE the
 * organiser runs the real elections. This file holds everything that is not a
 * server action: a `"use server"` file may export ONLY async functions, so the
 * role catalogue, the row/stat/result types and every synchronous helper live
 * here and are imported by both the actions and the UI.
 *
 * IMPORTANT (Director decision, 2026-08-14): a self-nomination is a LIST THE
 * ORGANISER READS. It never auto-populates vote_sessions.config.candidateIds
 * and never grants a role — the organiser still hand-picks ballot candidates
 * exactly as today.
 */

// ─── Role catalogue ─────────────────────────────────────────────
//
// The stored value IS the yip parliament_role enum value, so the organiser's
// downstream role assignment needs no translation table. Labels + descriptions
// are verbatim from the feature spec — do not reword them in the UI.

export const SELF_NOMINATION_ROLE_KEYS = [
  "parliamentary_administrator",
  "speaker",
  "party_leader",
  "parliamentary_journalist",
  "prime_minister",
  "leader_of_opposition",
  "cabinet_minister",
  "shadow_minister",
] as const;

export type SelfNominationRole = (typeof SELF_NOMINATION_ROLE_KEYS)[number];

export type SelfNominationRoleDef = {
  /** Stored value + the yip.parliament_role enum member this maps to. */
  key: SelfNominationRole;
  /** Student-facing label (spec verbatim). */
  label: string;
  /** One-line student-facing description (spec verbatim). */
  description: string;
};

/**
 * Canonical order. Every list the student and the organiser see — checkboxes,
 * stat tiles, CSV columns, the roles rendered on a results row — uses THIS
 * order, so a nomination reads the same everywhere.
 */
export const SELF_NOMINATION_ROLES: readonly SelfNominationRoleDef[] = [
  {
    key: "parliamentary_administrator",
    label: "Administrator",
    description:
      "Supports the Speaker with impartial procedure and record-keeping.",
  },
  {
    key: "speaker",
    label: "Speaker",
    description: "Runs the House and every session with strict neutrality.",
  },
  {
    key: "party_leader",
    label: "Party Leader",
    description:
      "Leads your party's coalition negotiations and represents it going forward.",
  },
  // Added 2026-08-21 (Director). A duty official, not a competing MP — see
  // OFFICIAL_DUTY_ROLES in lib/yip/constants.ts. Selected on a written news
  // report rather than a question paper; the report runs as the
  // 'parliamentary_journalist' questionnaire post.
  {
    key: "parliamentary_journalist",
    label: "Student Journalist",
    description:
      "Covers the House across both days and reports on it — neutral about their own party.",
  },
  // Added 2026-08-21 (Director). LATER-STAGE roles: this pair runs AFTER
  // Government Formation, so unlike the four above they are not open to
  // everyone — see eligibleSelfNominationRoles(). A Member gets at most ONE of
  // them, decided by which bench their party landed on.
  {
    key: "prime_minister",
    label: "Prime Minister",
    description:
      "Heads the Government, sets the legislative agenda, and answers for the ruling coalition.",
  },
  {
    key: "leader_of_opposition",
    label: "Leader of Opposition",
    description:
      "Leads the Opposition benches, holds the Government to account, and offers the alternative.",
  },
  // Added 2026-08-21 (Director). Also later-stage and bench-decided, but the
  // SAME opportunity on both benches — a Ruling Member's picks are tagged
  // Cabinet Minister and an Opposition Member's identical picks are tagged
  // Shadow Minister. Unlike PM/LOP there is NO Party-Leader bar: no such
  // restriction was specified for this stage. Both carry exactly two
  // ministries — see normalizeCabinetMinistries().
  {
    key: "cabinet_minister",
    label: "Cabinet Minister",
    description:
      "Holds two portfolios in Government — answers for them in Question Hour and tables their Bills.",
  },
  {
    key: "shadow_minister",
    label: "Shadow Minister",
    description:
      "Shadows two portfolios from the Opposition benches — scrutinises them and offers the alternative.",
  },
] as const;

/**
 * How many portfolios a Cabinet/Shadow nominee must choose — exactly this many,
 * no more and no fewer (Director, 2026-08-21).
 */
export const CABINET_MINISTRIES_REQUIRED = 2;

/** The two ministry-bearing roles. Everything else ignores `ministries`. */
export const CABINET_ROLES: readonly SelfNominationRole[] = [
  "cabinet_minister",
  "shadow_minister",
];

export function isCabinetRole(role: string): boolean {
  return (CABINET_ROLES as readonly string[]).includes(role);
}

// ─── Eligibility (later-stage roles only) ───────────────────────

/**
 * Roles every Member may always put themselves forward for. These run BEFORE
 * Government Formation, when nobody has a bench yet, so there is nothing to
 * gate on.
 */
const ALWAYS_ELIGIBLE_ROLES: readonly SelfNominationRole[] = [
  "parliamentary_administrator",
  "speaker",
  "party_leader",
  "parliamentary_journalist",
];

/**
 * A leadership mandate that BARS its holder from contesting PM or LOP. A Party
 * Leader already leads their party into coalition talks; a Coalition Leader
 * leads a bloc of them. `coalition_leader` is a distinct parliament_role that
 * REPLACES party_leader on that participant's row, so excluding only
 * "party_leader" would quietly let the more senior of the two stand.
 */
const LEADERSHIP_MANDATE_ROLES = new Set<string>([
  "party_leader",
  "coalition_leader",
]);

export type NominationEligibility = {
  /** The bench the Member's party landed on at Government Formation. */
  partySide: "ruling" | "opposition" | null;
  /** The Member's current parliament_role, if any. */
  parliamentRole: string | null;
};

/**
 * Which roles THIS Member may self-nominate for.
 *
 * The four early roles are always available. PM and LOP are the later stage and
 * are gated two ways (Director, 2026-08-21):
 *
 *   • one bench, one role — Ruling ⇒ Prime Minister, Opposition ⇒ Leader of
 *     Opposition. Never both, and never the other bench's role.
 *   • a Party Leader (or Coalition Leader) gets NEITHER.
 *
 * FAILS CLOSED, per the repo's authorization rule: an unknown or missing
 * `partySide` — a Member not yet allocated a party, or a row read before
 * Government Formation ran — yields no later-stage role at all. Opening the
 * gate on null would let every unallocated Member stand for PM.
 */
export function eligibleSelfNominationRoles(
  who: NominationEligibility
): SelfNominationRole[] {
  const roles = [...ALWAYS_ELIGIBLE_ROLES];

  // PM / LOP — one bench, one role, and barred outright for a Member who
  // already holds a leadership mandate.
  const barred =
    !!who.parliamentRole && LEADERSHIP_MANDATE_ROLES.has(who.parliamentRole);
  if (!barred) {
    if (who.partySide === "ruling") roles.push("prime_minister");
    else if (who.partySide === "opposition") roles.push("leader_of_opposition");
  }

  // Cabinet / Shadow — also bench-decided, but deliberately NOT subject to the
  // leadership bar: no such restriction was specified for this stage, so a
  // Party Leader may still stand for a portfolio.
  const cabinetRole = cabinetRoleForSide(who.partySide);
  if (cabinetRole) roles.push(cabinetRole);

  return SELF_NOMINATION_ROLE_KEYS.filter((k) => roles.includes(k));
}

/**
 * The ministry role this Member's bench gives them, or null before allocation.
 *
 * Cabinet and Shadow are the SAME opportunity seen from the two benches, so
 * this is computed, never chosen — a Ruling Member cannot nominate as a Shadow
 * Minister and vice versa. Unlike PM/LOP there is no Party-Leader bar.
 */
export function cabinetRoleForSide(
  partySide: "ruling" | "opposition" | null
): SelfNominationRole | null {
  if (partySide === "ruling") return "cabinet_minister";
  if (partySide === "opposition") return "shadow_minister";
  return null;
}

export type MinistrySetResult =
  | { ok: true; ministries: string[] }
  | { ok: false; error: string };

/**
 * Validate a Cabinet/Shadow nominee's portfolio picks against the ministries
 * THIS chapter chose for the event (events.cabinet_ministries, resolved by
 * effectiveMinistries()). Enforces exactly two, de-duplicates, and rejects
 * anything outside that event's own list — a chapter running eight portfolios
 * must not receive a nomination for a ninth.
 *
 * Order follows the event's list, so every nomination reads the same way.
 */
export function normalizeCabinetMinistries(
  input: unknown,
  allowed: readonly string[]
): MinistrySetResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: "Choose exactly two portfolios." };
  }
  const allow = new Set(allowed);
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string" || !allow.has(raw)) {
      return { ok: false, error: "That portfolio is not offered at this event." };
    }
    seen.add(raw);
  }
  if (seen.size !== CABINET_MINISTRIES_REQUIRED) {
    return { ok: false, error: "Choose exactly two portfolios." };
  }
  return { ok: true, ministries: allowed.filter((m) => seen.has(m)) };
}

/** Keep only recognised ministries from a stored row, in the event's order. */
export function coerceStoredMinistries(
  value: unknown,
  allowed: readonly string[]
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set(value.filter((v): v is string => typeof v === "string"));
  return allowed.filter((m) => seen.has(m));
}

/**
 * Reject any role the Member is not eligible for. The picker already hides
 * them, but a hand-rolled POST does not go near the picker — this is the check
 * that actually holds, and every write path must call it.
 */
export function assertEligibleRoles(
  roles: readonly SelfNominationRole[],
  who: NominationEligibility
): RoleSetResult {
  const allowed = new Set(eligibleSelfNominationRoles(who));
  for (const role of roles) {
    if (!allowed.has(role)) {
      return {
        ok: false,
        error:
          role === "prime_minister" || role === "leader_of_opposition"
            ? "You are not eligible to stand for that role."
            : "That is not a role you can nominate for.",
      };
    }
  }
  return { ok: true, roles: [...roles] };
}

const ROLE_BY_KEY = new Map<string, SelfNominationRoleDef>(
  SELF_NOMINATION_ROLES.map((r) => [r.key, r])
);

/** Type guard: is this an allowed self-nomination role value? */
export function isSelfNominationRole(v: unknown): v is SelfNominationRole {
  return typeof v === "string" && ROLE_BY_KEY.has(v);
}

/** Spec label for a stored role value. Unknown values echo back unchanged. */
export function selfNominationRoleLabel(role: string): string {
  return ROLE_BY_KEY.get(role)?.label ?? role;
}

/** Comma-joined spec labels in catalogue order — the results/CSV rendering. */
export function selfNominationRoleLabels(roles: readonly string[]): string {
  return sortSelfNominationRoles(roles).map(selfNominationRoleLabel).join(", ");
}

/** Re-order an already-valid role list into catalogue order. */
function sortSelfNominationRoles(roles: readonly string[]): string[] {
  const order = SELF_NOMINATION_ROLE_KEYS as readonly string[];
  return [...roles].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

// ─── Validation ─────────────────────────────────────────────────

export type RoleSetResult =
  | { ok: true; roles: SelfNominationRole[] }
  | { ok: false; error: string };

/**
 * Validate + normalise a client-supplied role selection.
 *
 * Rejects: a non-array, an empty selection, and any value outside the three
 * allowed roles. De-duplicates and returns catalogue order — array-level
 * uniqueness cannot be expressed in a Postgres CHECK (no subqueries), so this
 * function is the ONLY thing standing between a doubled checkbox payload and
 * a `roles = {speaker,speaker}` row. Every write path must call it.
 */
export function normalizeSelfNominationRoles(input: unknown): RoleSetResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: "Select at least one role to nominate for." };
  }
  const seen = new Set<SelfNominationRole>();
  for (const raw of input) {
    if (!isSelfNominationRole(raw)) {
      return { ok: false, error: "That is not a role you can nominate for." };
    }
    seen.add(raw);
  }
  if (seen.size === 0) {
    return { ok: false, error: "Select at least one role to nominate for." };
  }
  const roles = SELF_NOMINATION_ROLE_KEYS.filter((k) => seen.has(k));
  return { ok: true, roles: [...roles] };
}

/** Keep only recognised roles from a stored row, in catalogue order. */
export function coerceStoredRoles(value: unknown): SelfNominationRole[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<SelfNominationRole>();
  for (const raw of value) if (isSelfNominationRole(raw)) seen.add(raw);
  return SELF_NOMINATION_ROLE_KEYS.filter((k) => seen.has(k));
}

// ─── Row / stat / result shapes ─────────────────────────────────

/** One student's own nomination, as returned to that student. */
export type SelfNominationRow = {
  id: string;
  eventId: string;
  participantId: string;
  roles: SelfNominationRole[];
  /** The two portfolios, when a Cabinet/Shadow role is on this nomination. */
  ministries: string[];
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
};

export type SelfNominationStats = {
  total: number;
  /** Count per role — a student nominating for 2 roles counts in both. */
  perRole: Record<SelfNominationRole, number>;
};

/**
 * One line of the ORGANISER's results table. Carries the student's identity
 * plus the party columns the organiser needs to run each party's leader ballot
 * (Director decision 3). Students never see any of this about anyone else.
 */
export type SelfNominationResultRow = {
  nominationId: string;
  participantId: string;
  fullName: string;
  constituencyName: string | null;
  constituencyNumber: number | null;
  partyName: string | null;
  partySide: "ruling" | "opposition" | null;
  roles: SelfNominationRole[];
  /** ISO timestamp of the ORIGINAL submission (created_at). */
  submittedAt: string;
  /** ISO timestamp of the last edit (updated_at). */
  updatedAt: string;
};

/** Shared result envelope for every self-nomination server action. */
export type SelfNominationActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Stats ──────────────────────────────────────────────────────

export function emptySelfNominationStats(): SelfNominationStats {
  return {
    total: 0,
    perRole: {
      parliamentary_administrator: 0,
      speaker: 0,
      party_leader: 0,
      parliamentary_journalist: 0,
      prime_minister: 0,
      leader_of_opposition: 0,
      cabinet_minister: 0,
      shadow_minister: 0,
    },
  };
}

/** Total nominations + per-role counts. Pure — safe to re-run client-side. */
export function countSelfNominations(
  rows: readonly { roles: readonly string[] }[]
): SelfNominationStats {
  const stats = emptySelfNominationStats();
  for (const row of rows) {
    stats.total += 1;
    for (const key of SELF_NOMINATION_ROLE_KEYS) {
      if (row.roles.includes(key)) stats.perRole[key] += 1;
    }
  }
  return stats;
}

// ─── Rendering helpers ──────────────────────────────────────────

/**
 * "14-08-2026 19:42" in IST. Events run in India and this file/table is read
 * by chapter staff there — a raw UTC ISO string reads 5h30m early. Same
 * rendering as lib/yip/attendance-csv.ts formatCheckInTime.
 */
export function formatSelfNominationTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Constituency as the organiser reads it: "12 · Anna Nagar", or "" if unset. */
export function constituencyLabel(
  name: string | null | undefined,
  number: number | null | undefined
): string {
  if (number != null && name) return `${number} · ${name}`;
  if (number != null) return String(number);
  return name ?? "";
}

// ─── CSV ────────────────────────────────────────────────────────

export const SELF_NOMINATION_CSV_HEADERS = [
  "Student",
  "Constituency No",
  "Constituency",
  "Party",
  "Bench",
  "Roles Nominated",
  "Submitted At (IST)",
  "Last Edited (IST)",
] as const;

/** Rows for toCsv() from lib/yip/attendance-csv.ts, in table order. */
export function buildSelfNominationCsvRows(
  rows: readonly SelfNominationResultRow[]
): unknown[][] {
  return rows.map((r) => [
    r.fullName,
    r.constituencyNumber ?? "",
    r.constituencyName ?? "",
    r.partyName ?? "",
    r.partySide ?? "",
    selfNominationRoleLabels(r.roles),
    formatSelfNominationTime(r.submittedAt),
    formatSelfNominationTime(r.updatedAt),
  ]);
}

