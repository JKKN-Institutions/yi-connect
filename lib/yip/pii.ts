/**
 * DPDP privacy helpers.
 *
 * The pseudonym format MUST stay in lockstep with the SQL in
 * `supabase/migrations/yip_dpdp_privacy_mode.sql` (`fn_anonymize_event_pii`), so
 * a LIVE-MASKED name (privacy mode on, event not yet purged) is identical to the
 * eventual PURGED name stored in the database. Both use the first 8 chars of the
 * row id, which is stable and unique enough to distinguish people in results
 * without revealing identity.
 */

/** Anonymized display name for a participant, by row id. */
export function participantPseudonym(id: string): string {
  return `Participant #${id.slice(0, 8)}`;
}

/** Anonymized display name for a volunteer, by row id. */
export function volunteerPseudonym(id: string): string {
  return `Volunteer #${id.slice(0, 8)}`;
}

/** Placeholder written into NOT-NULL text PII columns (e.g. school_name). */
export const PII_REMOVED_PLACEHOLDER = "[removed]";
