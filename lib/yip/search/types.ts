/**
 * Shared contract for YIP global search.
 *
 * WHY THIS FILE EXISTS
 * Search is a uniquely leaky surface: it lets someone type a guess and learn
 * whether it matched. Every blindness rule YIP enforces on a PAGE has to be
 * re-enforced here, or the search box becomes the way around it. So the rules
 * live in ONE place — this file and `viewer.ts` — and both the server action
 * and the UI read them from here rather than each deciding for itself.
 *
 * Two hard rules that apply to EVERY viewer, including national super-admins:
 *
 *   1. NO CREDENTIALS, EVER. `access_code` (participants, jury, volunteers) is
 *      never a searchable column and never a returned field. Yi-Future shipped
 *      `access_code.ilike.%q%` inside a delegate search filter, which turns the
 *      search box into a credential-enumeration oracle — type a few characters
 *      and learn a real login code. We do not repeat that here.
 *   2. NO CONTACT DETAILS, EVER. email / phone / parent_phone / school_name are
 *      never searchable and never returned. Participants are minors.
 *
 * And one deliberate simplification:
 *
 *   3. NO SCORES IN SEARCH, for anyone. Scores are `canViewScores`-gated
 *      (super-admin + chapter chair only, a safeguarding decision reaffirmed
 *      three times) and belong on the Results page where that gate is applied.
 *      Keeping them out of search entirely means a search snippet can never be
 *      the thing that leaks a named minor's mark.
 */

/** Which kind of signed-in person is searching. */
export type SearchViewerKind =
  | "staff" // Supabase Auth: national / regional / chair / organiser
  | "jury" // access-code session, scoped to ONE event
  | "participant" // access-code session, scoped to ONE event
  | "volunteer"; // access-code session, scoped to ONE event

/**
 * A resolved searcher plus exactly what they may look at. Produced by
 * `resolveSearchViewer()`; every query in the search action must be filtered
 * through it. Never construct one by hand in a component.
 */
export type SearchViewer = {
  kind: SearchViewerKind;
  /**
   * Events whose rows this viewer may match against.
   * "all" is reserved for platform / YIP super-admins.
   */
  eventScope: "all" | string[];
  /**
   * May real participant names be shown? FALSE for jury (they see the blind
   * `juryLabel()` number instead), volunteers and participants.
   */
  canSeeNames: boolean;
  /** Result groups this viewer is allowed to receive at all. */
  groups: readonly SearchGroupKey[];
  /** For access-code sessions: the single event they are inside. */
  eventId?: string;
  /** For access-code sessions: their own row id (participants/jury/volunteers). */
  selfId?: string;
};

/** Every kind of thing the search can return. */
export type SearchGroupKey =
  | "events"
  | "participants"
  | "parties"
  | "committees"
  | "bills"
  | "questions"
  | "motions"
  | "jury"
  | "volunteers"
  | "agenda"
  | "ministries"
  | "pages";

/** Human labels for the group headers in the palette. */
export const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {
  events: "Events",
  participants: "Participants",
  parties: "Parties",
  committees: "Committees",
  bills: "Bills",
  questions: "Questions",
  motions: "Motions",
  jury: "Jury",
  volunteers: "Volunteers",
  agenda: "Sessions",
  ministries: "Ministries",
  pages: "Pages",
};

/**
 * Display order in the palette. Events first (the commonest target), Pages last
 * (a fallback when nothing concrete matched).
 */
export const SEARCH_GROUP_ORDER: readonly SearchGroupKey[] = [
  "events",
  "participants",
  "agenda",
  "parties",
  "committees",
  "bills",
  "questions",
  "motions",
  "jury",
  "volunteers",
  "ministries",
  "pages",
] as const;

/**
 * One row in the palette. Deliberately flat and display-only: a hit carries
 * what to SHOW and where to GO, never the underlying record. Nothing here may
 * hold a score, a contact detail or an access code.
 */
export type SearchHit = {
  group: SearchGroupKey;
  /** Stable key for React + de-duplication. */
  id: string;
  /** Primary line, already redacted for this viewer (may be "Participant 115"). */
  title: string;
  /** Optional second line — context such as the event or chapter. Never PII. */
  subtitle?: string | null;
  /** Where selecting this row navigates to. */
  href: string;
};

export type SearchResponse =
  | { success: true; hits: SearchHit[] }
  | { success: false; error: string };

/** Minimum characters before we hit the database. */
export const SEARCH_MIN_QUERY = 2;

/** Per-group cap, so one noisy group cannot crowd out the rest. */
export const SEARCH_GROUP_LIMIT = 6;

/** Overall cap on rows returned to the client. */
export const SEARCH_TOTAL_LIMIT = 40;

/**
 * Strip characters that would break the PostgREST `.or()` grammar or inject
 * LIKE wildcards. Mirrors the guard already used by the dashboard search and by
 * Yi-Future's `safeSearch()`. Returns "" when nothing searchable survives, and
 * callers MUST skip the query in that case rather than searching for "%%".
 */
export function sanitizeSearchQuery(raw: string): string {
  return (raw ?? "").replace(/[%_,()"\\]/g, " ").trim();
}
