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

/**
 * Should this event's participant names be masked in LIVE, non-organiser views?
 *
 * True while privacy mode is on AND the event has not yet been purged. (After
 * purge the stored names are already pseudonyms, so masking is a no-op but
 * harmless.) Plain function — safe to import in client components.
 */
export function eventPrivacyMasked(event: {
  privacy_mode?: boolean | null;
  pii_purged_at?: string | null;
}): boolean {
  return !!event.privacy_mode && !event.pii_purged_at;
}

/**
 * Display name for a participant in a non-organiser audience. When `masked`,
 * returns the stable pseudonym (matches the SQL purge); otherwise the real name
 * (falling back to the pseudonym if the name is missing).
 */
export function maskName(
  masked: boolean,
  id: string,
  fullName: string | null | undefined,
): string {
  return masked ? participantPseudonym(id) : fullName ?? participantPseudonym(id);
}

/**
 * Jury-facing blind label. Jurors always score against the participant's
 * NUMBER, never the name — fairness, not privacy (so it applies to every
 * event regardless of privacy mode). Uses the constituency (seat) number —
 * the SAME number shown as "Const. No." on every other screen, so a juror
 * and an organiser looking up "Participant 101" see the same person. Falls
 * back to the id-based pseudonym for any row without a constituency number.
 */
export function juryLabel(
  constituencyNumber: number | null | undefined,
  id: string,
): string {
  return constituencyNumber != null
    ? `Participant ${constituencyNumber}`
    : participantPseudonym(id);
}
