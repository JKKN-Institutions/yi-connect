/**
 * Varnam Vizha — permission-letter generator (PURE functions, no DB, no IO).
 *
 * In 2025 every permission letter was hand-written per event per authority.
 * generateLetter() produces a formal, printable plain-text English letter the
 * committee only has to sign — with [CHAIR_NAME] / [PHONE] placeholders left
 * for the chair to fill in before printing.
 *
 * The authority `key` is what lib/varnam/actions/manage-permissions.ts stores
 * in yi_connect.varnam_permissions.authority — keep keys stable.
 */

export type VarnamAuthorityKey = "collector" | "police" | "corporation";

export type VarnamAuthority = {
  key: VarnamAuthorityKey;
  /** Formal addressee line used in the letter and on the boards. */
  name: string;
};

export const AUTHORITIES: VarnamAuthority[] = [
  { key: "collector", name: "The District Collector, Erode" },
  { key: "police", name: "The Commissioner of Police, Erode" },
  {
    key: "corporation",
    name: "The Commissioner, Erode City Municipal Corporation",
  },
];

/** Status pipeline for a permission request (mirrors the DB CHECK). */
export const PERMISSION_STATUSES = [
  "needed",
  "drafted",
  "submitted",
  "approved",
] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

/** Resolve an authority by its stored key (null if unknown). */
export function getAuthority(key: string): VarnamAuthority | null {
  return AUTHORITIES.find((a) => a.key === key) ?? null;
}

export type LetterEvent = {
  title: string;
  start_date: string | null;
  end_date: string | null;
  venue_address: string | null;
  max_capacity: number | null;
  category: string | null;
};

export type LetterEdition = {
  name: string; // "Varnam Vizha 2026"
  year: number;
};

const IST = "Asia/Kolkata";

/** "12 September 2026" in IST (empty string when missing/invalid). */
function fmtDateIST(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** "6:30 PM" in IST (empty string when missing/invalid). */
function fmtTimeIST(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
}

/** Human phrase for when the event happens, IST. */
function whenPhrase(event: LetterEvent): string {
  const startDate = fmtDateIST(event.start_date);
  const endDate = fmtDateIST(event.end_date);
  const startTime = fmtTimeIST(event.start_date);
  const endTime = fmtTimeIST(event.end_date);

  if (!startDate) return "on a date to be confirmed";
  if (endDate && endDate !== startDate) {
    return `from ${startDate} to ${endDate} (timings in IST)`;
  }
  if (startTime && endTime && endTime !== startTime) {
    return `on ${startDate} from ${startTime} to ${endTime} (IST)`;
  }
  if (startTime) return `on ${startDate} at ${startTime} (IST)`;
  return `on ${startDate}`;
}

/** The per-authority "ask" paragraph. */
function askParagraph(key: VarnamAuthorityKey): string {
  switch (key) {
    case "collector":
      return (
        "We request your good office to kindly grant permission to conduct " +
        "the above event at the mentioned venue, and to extend the district " +
        "administration's kind support for its smooth conduct."
      );
    case "police":
      return (
        "We request you to kindly provide security arrangements at the venue " +
        "and route / traffic support for the safe movement of participants " +
        "and the public during the event."
      );
    case "corporation":
      return (
        "We request you to kindly support the event with venue upkeep and " +
        "public amenities — cleaning, dustbins, drinking-water points and " +
        "public conveniences — at the mentioned venue for the duration of " +
        "the event."
      );
  }
}

/**
 * Generate the formal permission letter for one authority.
 * Plain text, printable; placeholders [CHAIR_NAME] and [PHONE] are filled in
 * by the chair before signing.
 */
export function generateLetter(
  authority: VarnamAuthorityKey,
  event: LetterEvent,
  edition: LetterEdition
): { subject: string; body: string } {
  const auth = getAuthority(authority);
  const authorityName = auth ? auth.name : authority;

  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const startDate = fmtDateIST(event.start_date);
  const subject = `Request for permission — ${event.title}${
    startDate ? ` on ${startDate}` : ""
  } as part of ${edition.name}`;

  const participants =
    typeof event.max_capacity === "number" && event.max_capacity > 0
      ? `around ${event.max_capacity}`
      : "approx. 200";
  const categoryText = event.category
    ? `a ${event.category} event`
    : "a community event";
  const venueText = event.venue_address
    ? `at ${event.venue_address}`
    : "at a venue in Erode (to be confirmed)";

  const body = [
    "From:",
    "The Organising Committee,",
    "Erode Varnam Vizha (Yi Erode),",
    "Young Indians (Yi) — Erode Chapter.",
    "",
    `Date: ${today}`,
    "",
    "To:",
    `${authorityName}.`,
    "",
    `Subject: ${subject}`,
    "",
    "Respected Sir / Madam,",
    "",
    `Varnam Vizha is Yi Erode's annual cultural festival, celebrating the ` +
      `spirit of Erode and culminating on Erode Day (16 September). The ` +
      `festival has been conducted with the support of the district ` +
      `administration since 2021, bringing together partner forums, ` +
      `institutions and the public of Erode.`,
    "",
    `As part of ${edition.name}, we are organising "${event.title}" ` +
      `(${categoryText}) ${whenPhrase(event)} ${venueText}. We expect ` +
      `${participants} participants.`,
    "",
    askParagraph(authority),
    "",
    "We assure you of our complete cooperation with all instructions of the " +
      "authorities before, during and after the event. We kindly request you " +
      "to grant the necessary permission at the earliest.",
    "",
    "Thanking you,",
    "",
    "Yours faithfully,",
    "",
    "[CHAIR_NAME]",
    "Chair — Organising Committee, Erode Varnam Vizha (Yi Erode)",
    "Phone: [PHONE]",
    "Email: erodevarnamvizha@gmail.com",
  ].join("\n");

  return { subject, body };
}
