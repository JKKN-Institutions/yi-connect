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
 * any Member who is NOT a government minister and NOT presiding.
 */
export function canMovePrivateMemberBill(
  parliamentRole: string | null | undefined
): boolean {
  const role = parliamentRole ?? "";
  return !GOVERNMENT_MINISTER_ROLES.has(role) && !PRESIDING_ROLES.has(role);
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
