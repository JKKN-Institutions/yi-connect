/**
 * YIP Admin Checklist Template — shared constants & helpers
 * ---------------------------------------------------------
 * The 6 canonical chapter-execution categories are sourced from
 * the YIP 2026 Handbook (p.45–46). Admins may add new categories
 * through the Admin → Checklist Template page, but the canonical
 * six always sort first and always appear in the handbook's
 * chronological order.
 *
 * This module is NON-ASYNC. It is safe to import from both
 * server and client components. Any server actions live in
 * `src/app/actions/admin-checklist.ts`.
 */

export const CANONICAL_CATEGORIES = [
  "Pre-Session Preparation",
  "Venue & Infrastructure",
  "On-Ground Execution",
  "Logistics & Hospitality",
  "Communication & Protocol",
  "Post-Session",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

/** True when `name` is one of the 6 handbook categories. */
export function isCanonicalCategory(name: string): name is CanonicalCategory {
  return (CANONICAL_CATEGORIES as readonly string[]).includes(name);
}

/**
 * Sort comparator that places canonical categories first in their
 * handbook order, then any custom categories alphabetically.
 */
export function compareCategoryOrder(a: string, b: string): number {
  const ai = (CANONICAL_CATEGORIES as readonly string[]).indexOf(a);
  const bi = (CANONICAL_CATEGORIES as readonly string[]).indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.localeCompare(b);
}

/**
 * Returns a Tailwind-friendly colour token for the coloured dot
 * rendered next to each category. Canonical categories get a
 * YIP-branded palette; custom categories fall back to slate.
 */
export function categoryAccentColor(name: string): string {
  const map: Record<string, string> = {
    "Pre-Session Preparation": "#FF9933", // saffron
    "Venue & Infrastructure": "#1a1a3e", // navy
    "On-Ground Execution": "#138808", // green
    "Logistics & Hospitality": "#D97706", // amber
    "Communication & Protocol": "#2563EB", // blue
    "Post-Session": "#7C3AED", // violet
  };
  return map[name] ?? "#64748B"; // slate fallback
}

// ───────────────────────────────────────────────────────────────
// HANDBOOK TEMPLATE (p.45–46) — used by the Reseed action to
// top-up any missing canonical items without a code deploy and
// without a migration. Source of truth mirrors migration 009.
// ───────────────────────────────────────────────────────────────

export type HandbookChecklistItem = {
  category: CanonicalCategory;
  sequence_order: number;
  title: string;
  description: string | null;
  handbook_page: number;
};

export const HANDBOOK_CHECKLIST_TEMPLATE: readonly HandbookChecklistItem[] = [
  // Pre-Session Preparation (p.45)
  { category: "Pre-Session Preparation", sequence_order: 1, title: "Inform schools and Yi members about YIP", description: "Spread awareness through chapter networks", handbook_page: 45 },
  { category: "Pre-Session Preparation", sequence_order: 2, title: "Share registration and payment links", description: "Refer: Registration Guidelines", handbook_page: 45 },
  { category: "Pre-Session Preparation", sequence_order: 3, title: "Conduct student orientation session", description: "Refer: Preparation Guidelines", handbook_page: 45 },
  { category: "Pre-Session Preparation", sequence_order: 4, title: "Finalise participant list (15 days prior)", description: "Hard deadline per handbook", handbook_page: 45 },
  { category: "Pre-Session Preparation", sequence_order: 5, title: "Identify core team", description: "Point of Contact, Session Coordinator, Program Lead", handbook_page: 45 },
  { category: "Pre-Session Preparation", sequence_order: 6, title: "Send invitations as per CII protocols", description: "Drafts to National for MP/Cabinet Minister approval", handbook_page: 45 },
  { category: "Pre-Session Preparation", sequence_order: 7, title: "Finalise venue, logistics, AV setup, and outreach", description: "Refer: Venue & Infrastructure", handbook_page: 45 },
  { category: "Pre-Session Preparation", sequence_order: 8, title: "Confirm volunteers and support teams", description: "10+ YUVA volunteers minimum", handbook_page: 45 },

  // Venue & Infrastructure (p.45)
  { category: "Venue & Infrastructure", sequence_order: 1, title: "Venue setup aligned with parliamentary seating", description: "Circular preferred for discussions", handbook_page: 45 },
  { category: "Venue & Infrastructure", sequence_order: 2, title: "Accessible and inclusive arrangements ensured", description: "Safe, inclusive environment mandate", handbook_page: 45 },
  { category: "Venue & Infrastructure", sequence_order: 3, title: "Breakout rooms for committee discussions", description: "For Committee Mode (handbook p.19)", handbook_page: 45 },
  { category: "Venue & Infrastructure", sequence_order: 4, title: "AV setup tested (mics, projector, speakers)", description: "Test day before event", handbook_page: 45 },
  { category: "Venue & Infrastructure", sequence_order: 5, title: "Internet and power backup ready", description: "Non-negotiable for timer sync", handbook_page: 45 },
  { category: "Venue & Infrastructure", sequence_order: 6, title: "Branding aligned with Yi/CII guidelines", description: "No sponsor logos on main backdrop (p.13)", handbook_page: 45 },

  // On-Ground Execution (p.45)
  { category: "On-Ground Execution", sequence_order: 1, title: "Participants (120–170) confirmed and briefed", description: "Chapter baseline per handbook", handbook_page: 45 },
  { category: "On-Ground Execution", sequence_order: 2, title: "Agenda and timelines clearly displayed", description: "Use projector display", handbook_page: 45 },
  { category: "On-Ground Execution", sequence_order: 3, title: "Seating aligned with party structure", description: "Refer: Role Distribution", handbook_page: 45 },
  { category: "On-Ground Execution", sequence_order: 4, title: "Registration and help desk operational", description: "From 30 min before start", handbook_page: 45 },
  { category: "On-Ground Execution", sequence_order: 5, title: "Moderators managing session flow", description: "Refer: Execution & Moderation (p.11)", handbook_page: 45 },
  { category: "On-Ground Execution", sequence_order: 6, title: "Volunteers assigned (registration, AV, room coordination)", description: "Station assignments ready", handbook_page: 45 },
  { category: "On-Ground Execution", sequence_order: 7, title: "Materials ready (badges, stationery, evaluation tools)", description: "Party/Committee number badges", handbook_page: 45 },

  // Logistics & Hospitality (p.46)
  { category: "Logistics & Hospitality", sequence_order: 1, title: "Meals and refreshments arranged (2 days)", description: "Breakfast + lunch + snacks", handbook_page: 46 },
  { category: "Logistics & Hospitality", sequence_order: 2, title: "Drinking water stations available", description: "Multiple locations", handbook_page: 46 },
  { category: "Logistics & Hospitality", sequence_order: 3, title: "Catering meets hygiene and dietary standards", description: "Check vegetarian options", handbook_page: 46 },
  { category: "Logistics & Hospitality", sequence_order: 4, title: "Clean and hygienic washroom facilities", description: "Daily cleaning schedule", handbook_page: 46 },

  // Communication & Protocol (p.46)
  { category: "Communication & Protocol", sequence_order: 1, title: "Internal alignment with Yi leadership", description: "RM + National informed", handbook_page: 46 },
  { category: "Communication & Protocol", sequence_order: 2, title: "Invitations and dignitary protocols followed", description: "Refer: Invitation Protocols", handbook_page: 46 },
  { category: "Communication & Protocol", sequence_order: 3, title: "Branding and communication aligned", description: "Refer: Branding Guidelines (p.13)", handbook_page: 46 },
  { category: "Communication & Protocol", sequence_order: 4, title: "Opening and closing remarks aligned with YIP messaging", description: "Empower | Engage | Elevate", handbook_page: 46 },

  // Post-Session (p.46)
  { category: "Post-Session", sequence_order: 1, title: "Reporting completed as per national format (Mandatory)", description: "Submit within 7 days", handbook_page: 46 },
  { category: "Post-Session", sequence_order: 2, title: "Finalists/awardees list shared with national team", description: "For regional qualification", handbook_page: 46 },
  { category: "Post-Session", sequence_order: 3, title: "Media coverage and content shared", description: "Ensure branding compliance", handbook_page: 46 },
  { category: "Post-Session", sequence_order: 4, title: "Feedback collected from students and organising team", description: "For continuous improvement", handbook_page: 46 },
];

// ───────────────────────────────────────────────────────────────
// VALIDATION HELPERS (shared client/server)
// ───────────────────────────────────────────────────────────────

export type ChecklistValidationError = {
  field: "title" | "category" | "sequence_order";
  message: string;
};

export function validateChecklistInput(input: {
  title?: string | null;
  category?: string | null;
  sequence_order?: number | null;
}): ChecklistValidationError | null {
  const title = (input.title ?? "").trim();
  const category = (input.category ?? "").trim();
  const sequence = input.sequence_order ?? 1;

  if (title.length < 3) {
    return { field: "title", message: "Title must be at least 3 characters" };
  }
  if (category.length < 2) {
    return { field: "category", message: "Category must be at least 2 characters" };
  }
  if (!Number.isFinite(sequence) || sequence < 1) {
    return { field: "sequence_order", message: "Sequence must be 1 or greater" };
  }
  return null;
}
