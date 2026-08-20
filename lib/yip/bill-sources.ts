// Bill sources — Government Bills & Private Members' Bills (Regional Round).
//
// Data model (additive, back-compat — supabase/migrations/*_yip_bill_sources.sql):
//   • yip.bills.source (text, default 'committee')  — 'committee' | 'government' | 'private_member'
//   • yip.bills.mover_participant_id (uuid, no FK)  — WHO moves the bill:
//     the concerned Minister (government) or the private Member (private_member).
//
// Government/private-member bills carry committee_name NULL (no drafting
// committee) and reuse the existing presentation / amendment / voting
// machinery unchanged. The creating action mirrors the mover into presenter_1
// so every existing presenter consumer (projector display, scoring flow)
// resolves the mover with zero changes.
//
// GRACEFUL DEGRADATION: code deploys BEFORE the migration is applied, so every
// read/write of the new columns must survive them not existing yet. Reads that
// use select("*") degrade automatically (the columns are simply absent →
// billSourceOf() falls back to 'committee'). Writers catch
// isMissingBillSourceError and retry without the new columns — the bill then
// behaves as a committee-unlinked bill whose mover is still presenter_1.
//
// PURE + CLIENT-SAFE — no DB, no "use server".

import { OFFICIAL_DUTY_ROLES } from "./constants";

export const BILL_SOURCES = ["committee", "government", "private_member"] as const;
export type BillSource = (typeof BILL_SOURCES)[number];

/** Human labels for the three origins (full + short badge forms). */
export const BILL_SOURCE_LABELS: Record<BillSource, string> = {
  committee: "Committee Bill",
  government: "Government Bill",
  private_member: "Private Member's Bill",
};
export const BILL_SOURCE_SHORT: Record<BillSource, string> = {
  committee: "Committee",
  government: "Govt",
  private_member: "PMB",
};

/**
 * Agenda types that put a BILL on the floor of the House.
 *
 * Historically there was exactly one ('bill_presentation'), so every bill /
 * vote / projector surface compared `agenda_type === "bill_presentation"`
 * directly. The 2026 Regional Round adds a SECOND one: the global
 * "Regional Round (2-day)" preset creates Day 2 item #2 with
 * agenda_type='private_members_bills' and use_for_voting=true.
 *
 * Under the old literal comparison that session was a dead end: the organiser
 * saw the "Open Bill Vote" button (it keys off use_for_voting) but openVote
 * refused it, no BillSession card rendered so no bill could be put on the
 * floor at all, and the projector stayed dark for the full 90 minutes.
 *
 * Use this predicate — never the bare literal — anywhere the question is
 * "is the House currently sitting on a bill?".
 */
export const BILL_FLOOR_AGENDA_TYPES = [
  "bill_presentation",
  "private_members_bills",
] as const;

/** True when this agenda_type puts a bill on the floor (see the list above). */
export function isBillFloorAgendaType(
  agendaType: string | null | undefined
): boolean {
  return (BILL_FLOOR_AGENDA_TYPES as readonly string[]).includes(
    agendaType ?? ""
  );
}

/**
 * Cabinet-side minister roles — the only movers of a GOVERNMENT bill.
 * (Shadow ministers sit in opposition: they are NOT government ministers and
 * therefore move private members' bills like any other non-minister Member.)
 * Kept here, not in constants.ts, so this stays the single bills-domain source.
 */
const GOVERNMENT_MINISTER_ROLES = new Set([
  "prime_minister",
  "deputy_prime_minister",
  "cabinet_minister",
]);

/** Presiding officers never move bills (they chair the House). */
const PRESIDING_ROLES = new Set(["speaker", "nominated_speaker", "deputy_speaker"]);

/** True when this parliament_role may move a GOVERNMENT bill. */
export function isGovernmentMinister(parliamentRole: string | null | undefined): boolean {
  return GOVERNMENT_MINISTER_ROLES.has(parliamentRole ?? "");
}

/**
 * True when this parliament_role may move a PRIVATE MEMBER'S bill:
 * any Member who is NOT a government minister, NOT presiding, and NOT a duty
 * official of the House.
 *
 * The duty-official exclusion is the same one the ballot already enforces:
 * OFFICIAL_DUTY_ROLES (Parliamentary Administrator / Journalist) are officials
 * rather than competing Members — isVotingEligibleRole() in vote-scope.ts
 * keeps them off every ballot. A person who may not VOTE on a bill must not be
 * offered as the Member who MOVES one. Imported from constants so a future
 * duty role is excluded here automatically.
 *
 * deputy_minister is deliberately NOT excluded — constants.ts records it as
 * "an ordinary government-side participant with no special exclusions".
 */
export function canMovePrivateMemberBill(
  parliamentRole: string | null | undefined
): boolean {
  const role = parliamentRole ?? "";
  return (
    !GOVERNMENT_MINISTER_ROLES.has(role) &&
    !PRESIDING_ROLES.has(role) &&
    !OFFICIAL_DUTY_ROLES.has(role)
  );
}

/** Minimal bill shape the source helpers read (all fields optional → degrades). */
export type BillSourceCarrier = {
  source?: string | null;
  committee_name?: string | null;
};

/**
 * A bill's origin. Rows read before the migration (or legacy rows) have no
 * `source` field → 'committee', the only pre-Regional-Round value.
 */
export function billSourceOf(bill: BillSourceCarrier): BillSource {
  const s = bill.source;
  return s === "government" || s === "private_member" ? s : "committee";
}

/**
 * The small badge text for bill lists: "Govt" / "PMB" for the new sources,
 * the committee name (or a generic fallback) for committee bills.
 */
export function billSourceBadgeLabel(bill: BillSourceCarrier): string {
  const source = billSourceOf(bill);
  if (source !== "committee") return BILL_SOURCE_SHORT[source];
  return bill.committee_name ?? BILL_SOURCE_LABELS.committee;
}

/**
 * True when a Supabase/PostgREST error means the `source` /
 * `mover_participant_id` columns don't exist yet (migration not applied).
 *   • SELECT with an unknown column → Postgres 42703 "column … does not exist"
 *   • INSERT/UPDATE payload with an unknown column → PostgREST PGRST204
 *     "Could not find the '…' column of 'bills' in the schema cache"
 * Callers catch THIS specific failure and retry without the new columns.
 */
export function isMissingBillSourceError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code ?? "";
  const message = (err as { message?: string }).message ?? "";
  if (!/\bsource\b|mover_participant_id/.test(message)) return false;
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache/i.test(message)
  );
}
