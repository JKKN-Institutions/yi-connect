/**
 * YIQ role catalogue + grant validation.
 *
 * PURE — no I/O, no `"use server"`, no `server-only`. Imported by the server
 * action that writes yi_directory AND by the client grant form, so the two can
 * never disagree about what a role means or what scope it needs. Shared types
 * live here rather than in the action because a `"use server"` file may export
 * only async functions.
 *
 * ── CANONICAL SOURCE ────────────────────────────────────────────────────
 * A YIQ role is a ROW in `yi_directory.role_assignments` with `app='yiq'`.
 * There is no `yiq.organisers` table and there must never be one (CLAUDE.md:
 * yi_directory is the mother source for every Yi person and every role they
 * hold). This module only DESCRIBES and VALIDATES; it never writes.
 *
 * ── THE FOUR VALUES ARE NOT A WISH LIST ─────────────────────────────────
 * They are exactly what the LIVE gates read — lib/yiq/auth/event-access.ts
 * and lib/yiq/auth/require-super-admin.ts. Before adding a fifth, add it to a
 * gate first: a role this file invents but no gate reads grants NOTHING, and
 * in the UI it looks identical to a role that works.
 *
 * ── FAIL CLOSED ─────────────────────────────────────────────────────────
 * A null/blank scope must never widen to "all". `getYiqEventAccess` already
 * refuses to match a blank zone or chapter, so a role row with no scope is
 * dead weight that reads to a human as "they have access". Every validator
 * below therefore REJECTS a missing scope rather than defaulting it.
 */

// Zone codes are Yi-wide handbook constants (ER/WR/NR/NER/SRTN/SRTKKA) that
// happen to live under lib/yip/. Reused rather than re-declared so YIQ zone
// codes can never drift from the rest of the platform.
import { YI_ZONES, type YiZone } from "@/lib/yip/hierarchy";

export type YiqRoleValue =
  | "yiq_super_admin"
  | "regional_admin"
  | "chapter_admin"
  | "chapter_organizer";

/** What kind of scope a role REQUIRES to mean anything. */
export type YiqScopeKind = "national" | "zone" | "chapter";

export type YiqRoleDef = {
  value: YiqRoleValue;
  label: string;
  scope: YiqScopeKind;
  /** One line for the grant form's role picker. */
  summary: string;
  /** Plain English, for an organiser who has never seen this app before. */
  can: string[];
  /** The deliberate limits — say them out loud so nobody assumes otherwise. */
  cannot: string[];
  /** Shown under the role in the team list when there is something to warn about. */
  note?: string;
};

export const YIQ_ROLES: readonly YiqRoleDef[] = [
  {
    value: "yiq_super_admin",
    label: "National admin",
    scope: "national",
    summary: "Every chapter, every event, plus the national question bank.",
    can: [
      "Build papers, edit the national question bank and the topic list",
      "View, run and delete any chapter's YIQ event",
      "See live scores and the Top 10 before they are published",
      "Grant and revoke YIQ roles",
    ],
    cannot: [
      "Add another national admin — only a platform super-admin can do that",
    ],
  },
  {
    value: "regional_admin",
    label: "Regional admin",
    scope: "zone",
    summary: "One Yi zone. Full control of every chapter event inside it.",
    can: [
      "View and run every YIQ event in their zone",
      "Verify schools, confirm teams, open and close the online round, run the finals console, publish a chapter's result",
      "Delete teams, schools and events inside their zone",
    ],
    cannot: [
      "See scores before they are published — that is national only",
      "Touch a chapter outside their zone",
      "Change national master data: papers, questions, topics",
    ],
  },
  {
    value: "chapter_admin",
    label: "Chapter chair",
    scope: "chapter",
    summary: "One chapter. Everything, including deleting.",
    can: [
      "Everything for their own chapter's event",
      "Delete teams, schools and the event itself",
    ],
    cannot: [
      "See scores before they are published",
      "Touch another chapter",
      "Change national master data: papers, questions, topics",
    ],
    note:
      "A Yi chapter chair ALREADY has this — the gate reads it straight from the Yi directory. Grant this only to someone who is not the chair but needs chair-level power.",
  },
  {
    value: "chapter_organizer",
    label: "Chapter organiser",
    scope: "chapter",
    summary: "One chapter. Runs the event, cannot delete.",
    can: [
      "Verify schools, confirm teams, open and close the online round",
      "Run the finals console, record scores and publish that chapter's result",
    ],
    cannot: [
      "Delete anything — not a team, not a school, not the event",
      "See scores before they are published",
      "Touch another chapter",
    ],
  },
];

const ROLE_BY_VALUE = new Map<string, YiqRoleDef>(
  YIQ_ROLES.map((r) => [r.value, r])
);

/** Display order for the team list: widest scope first. */
export const YIQ_ROLE_ORDER: readonly YiqRoleValue[] = YIQ_ROLES.map(
  (r) => r.value
);

export const YIQ_ZONE_CODES: readonly YiZone[] = YI_ZONES.map((z) => z.code);

/**
 * `clean(null) === clean("") === clean("   ") === null`.
 * A scope that trims to nothing is MISSING, not "all" — every caller below
 * treats the null as a reason to reject, never as a wildcard.
 */
function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

export function isYiqRoleValue(v: unknown): v is YiqRoleValue {
  return typeof v === "string" && ROLE_BY_VALUE.has(v);
}

export function yiqRoleDef(v: string | null | undefined): YiqRoleDef | null {
  const key = clean(v);
  return key ? ROLE_BY_VALUE.get(key) ?? null : null;
}

/** Human label, falling back to the raw stored value so an unknown row is still readable. */
export function yiqRoleLabel(v: string | null | undefined): string {
  return yiqRoleDef(v)?.label ?? clean(v) ?? "—";
}

export function roleScopeKind(v: string | null | undefined): YiqScopeKind | null {
  return yiqRoleDef(v)?.scope ?? null;
}

export function roleNeedsChapter(v: string | null | undefined): boolean {
  return roleScopeKind(v) === "chapter";
}

export function roleNeedsZone(v: string | null | undefined): boolean {
  return roleScopeKind(v) === "zone";
}

/** Case-insensitive zone-code check. Blank is never a zone. */
export function isYiZoneCode(v: string | null | undefined): v is YiZone {
  const t = clean(v);
  if (!t) return false;
  return YIQ_ZONE_CODES.some((z) => z.toLowerCase() === t.toLowerCase());
}

export type RoleGrantInput = {
  role: string | null | undefined;
  chapter?: string | null;
  zone?: string | null;
};

export type NormalizedRoleGrant = {
  role: YiqRoleValue;
  /** Set only for chapter-scoped roles. */
  chapter: string | null;
  /** Required for zone roles; carried as informational metadata for chapter roles. */
  zone: YiZone | null;
};

/**
 * The single validation rule for granting a YIQ role.
 *
 * Returns an error string to SHOW THE ADMIN, or null when the grant is legal.
 * FAIL CLOSED: a scoped role whose scope is missing, blank or whitespace is
 * REJECTED. It is never treated as "all chapters" or "all zones" — the gates
 * would refuse to match it anyway, so such a row is an invisible no-op that
 * reads to a human as granted access.
 *
 * Does NOT check that the chapter actually exists — that needs a database
 * read, so the server action does it (a typo'd chapter name grants nothing
 * and looks fine, which is exactly the failure this pair is guarding).
 */
export function validateRoleGrant(input: RoleGrantInput): string | null {
  const roleRaw = clean(input.role);
  if (!roleRaw) return "Choose a role.";

  const def = ROLE_BY_VALUE.get(roleRaw);
  if (!def) {
    return `"${roleRaw}" is not a YIQ role. Choose one of: ${YIQ_ROLE_ORDER.join(", ")}.`;
  }

  const chapter = clean(input.chapter);
  const zone = clean(input.zone);

  if (def.scope === "chapter") {
    if (!chapter) {
      return `${def.label} applies to ONE chapter — pick the chapter. Leaving it blank does not mean every chapter, it means the role grants nothing.`;
    }
    if (chapter.length < 2) {
      return `"${chapter}" is not a chapter name.`;
    }
    // A chapter role may carry its chapter's zone as metadata; if one is
    // supplied it still has to be a real zone code.
    if (zone && !isYiZoneCode(zone)) {
      return `"${zone}" is not a Yi zone. Use one of: ${YIQ_ZONE_CODES.join(", ")}.`;
    }
    return null;
  }

  if (def.scope === "zone") {
    if (!zone) {
      return `${def.label} applies to ONE Yi zone — pick the zone. Leaving it blank does not mean every zone, it means the role grants nothing.`;
    }
    if (!isYiZoneCode(zone)) {
      return `"${zone}" is not a Yi zone. Use one of: ${YIQ_ZONE_CODES.join(", ")}.`;
    }
    return null;
  }

  // national — no scope required, and any supplied scope is dropped by
  // normalizeRoleGrant() rather than being written to a row that implies a
  // narrowing the gate does not honour.
  return null;
}

/**
 * Trim + upper-case the scope and drop anything the role does not use, so
 * exactly one shape ever reaches the database. Returns null when the grant
 * does not validate — callers must surface validateRoleGrant()'s message
 * rather than silently writing a partial row.
 */
export function normalizeRoleGrant(
  input: RoleGrantInput
): NormalizedRoleGrant | null {
  if (validateRoleGrant(input) !== null) return null;

  const role = clean(input.role) as YiqRoleValue;
  const def = ROLE_BY_VALUE.get(role)!;
  const chapter = clean(input.chapter);
  const zoneRaw = clean(input.zone);
  const zone = zoneRaw
    ? (YIQ_ZONE_CODES.find((z) => z.toLowerCase() === zoneRaw.toLowerCase()) ??
      null)
    : null;

  if (def.scope === "national") return { role, chapter: null, zone: null };
  if (def.scope === "zone") return { role, chapter: null, zone };
  return { role, chapter, zone };
}

/** The `title` column on the assignment — what a human sees in the directory. */
export function yiqAssignmentTitle(grant: NormalizedRoleGrant): string {
  const def = ROLE_BY_VALUE.get(grant.role)!;
  const scope = grant.chapter ?? grant.zone;
  return scope ? `YIQ ${def.label} — ${scope}` : `YIQ ${def.label}`;
}

// ─── Team list shapes (shared: server action ↔ client UI) ───────────────

export type YiqTeamMember = {
  /**
   * `yi_directory.role_assignments.id`. NULL for a DERIVED member — the gate
   * honours them, but there is no YIQ row to revoke.
   */
  assignmentId: string | null;
  personId: string;
  fullName: string;
  email: string | null;
  role: YiqRoleValue;
  chapter: string | null;
  zone: string | null;
  yiYear: number | null;
  /**
   * granted  — an `app='yiq'` row somebody created here.
   * derived  — an `app='yi'` chapter_chair / chapter_co_chair. The Yi directory
   *            IS the source of truth for who chairs a chapter, so the gate
   *            treats them as the YIQ chair automatically. Never duplicate
   *            these as `app='yiq'` rows; the copy would drift.
   */
  source: "granted" | "derived_chapter_chair";
  /**
   * False when `yi_directory.people.user_id` is null: the role exists but the
   * person has no Yi login, so they sign in to nothing and see an empty app
   * with no error. Surface it, never hide it.
   */
  hasLogin: boolean;
};

export type YiqTeamGroup = {
  role: YiqRoleValue;
  def: YiqRoleDef;
  members: YiqTeamMember[];
};

/**
 * Role names that the LIVE gates treat as YIQ national, MIRRORED from the
 * `SUPER_ROLES` set in lib/yiq/auth/event-access.ts and require-super-admin.ts
 * (which do not export it). Change one, change all three.
 *
 * `yiq_national` is not in the catalogue above — nothing here can grant it —
 * but a hand-written row carrying it DOES open every chapter. Listed so the
 * team console can surface such a row instead of filtering it out of view.
 */
export const YIQ_ROLES_THAT_GRANT_NATIONAL: readonly string[] = [
  "yiq_super_admin",
  "yiq_national",
  "platform_super_admin",
];

/**
 * An `app='yiq'` assignment whose role is NOT in the catalogue. The console
 * shows these rather than hiding them: access this page cannot see is access
 * nobody can audit.
 */
export type YiqUnmanagedRole = {
  assignmentId: string;
  personId: string;
  fullName: string;
  email: string | null;
  role: string;
  chapter: string | null;
  zone: string | null;
  /** True when a live gate would still treat this row as national access. */
  grantsNational: boolean;
};

/** Group by role in catalogue order, dropping empty groups. Pure. */
export function groupYiqTeam(members: readonly YiqTeamMember[]): YiqTeamGroup[] {
  const out: YiqTeamGroup[] = [];
  for (const value of YIQ_ROLE_ORDER) {
    const def = ROLE_BY_VALUE.get(value)!;
    const inGroup = members
      .filter((m) => m.role === value)
      .sort(
        (a, b) =>
          (a.chapter ?? a.zone ?? "").localeCompare(b.chapter ?? b.zone ?? "") ||
          a.fullName.localeCompare(b.fullName)
      );
    if (inGroup.length > 0) out.push({ role: value, def, members: inGroup });
  }
  return out;
}
