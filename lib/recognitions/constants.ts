/**
 * Yi Recognitions — fixed vocabulary from the spec.
 *
 * Sources:
 *   mail 1 (process flow)            verticals, categories, word limits
 *   Latest_Evaluation_Matrix doc     Layer 2 / Layer 3 parameters, weights
 *
 * Mail 1 lists "Health" twice in the apply matrix; it is one vertical here.
 * recognitions_04 (Director, 2026-10-15): 14 recognitions, any slug allowed.
 */

/**
 * The kinds of recognition (recognition_awards.kind, recognitions_04). They
 * group the chapter's list and pick a ribbon for a recognition the app does
 * not know by name.
 */
export const KINDS = ["project", "initiative", "stakeholder", "sports", "branding"] as const;
export type AwardKind = (typeof KINDS)[number];

/** Group headings on the chapter's list (plural). */
export const KIND_LABEL: Record<AwardKind, string> = {
  project: "Projects",
  initiative: "Initiatives",
  stakeholder: "Stakeholders",
  sports: "Sports",
  branding: "Branding",
};

/** One recognition's kind (singular), for the control room. */
export const KIND_SINGULAR: Record<AwardKind, string> = {
  project: "Project",
  initiative: "Initiative",
  stakeholder: "Stakeholder",
  sports: "Sports",
  branding: "Branding",
};

export function isKind(v: unknown): v is AwardKind {
  return typeof v === "string" && (KINDS as readonly string[]).includes(v);
}

/**
 * Recognitions grouped by kind, in KINDS order, keeping each group's own
 * order. Any without a kind (rows from before recognitions_04) come last
 * under "Other recognitions". Empty groups are left out.
 */
export function groupByKind<T extends { kind: AwardKind | null }>(
  items: T[]
): Array<{ kind: AwardKind | null; label: string; items: T[] }> {
  const groups: Array<{ kind: AwardKind | null; label: string; items: T[] }> = KINDS.map((k) => ({
    kind: k,
    label: KIND_LABEL[k],
    items: items.filter((i) => i.kind === k),
  }));
  groups.push({ kind: null, label: "Other recognitions", items: items.filter((i) => !isKind(i.kind)) });
  return groups.filter((g) => g.items.length > 0);
}

/**
 * A recognition's key (recognition_awards.vertical). Any short slug: the
 * super admin may add recognitions the app has never heard of
 * (recognitions_04), so this is a string, not a fixed union.
 */
export type Vertical = string;

/** Same rule as the database CHECK in recognitions_04. */
export const SLUG_RE = /^[a-z][a-z0-9_]{1,39}$/;

/**
 * The recognitions the app knows by name. The 14 of 2026 (Director,
 * 2026-10-15) in their default order, then the two retired keys so older
 * cycles still read well. Titles are defaults only: the real title is the
 * row's, and the super admin renames it in the control room.
 */
export const KNOWN_RECOGNITIONS: Array<{ slug: string; kind: AwardKind; title: string; current: boolean }> = [
  { slug: "masoom", kind: "project", title: "Masoom", current: true },
  { slug: "road_safety", kind: "project", title: "Road Safety", current: true },
  { slug: "climate", kind: "project", title: "Climate Change", current: true },
  { slug: "health", kind: "project", title: "Health", current: true },
  { slug: "accessibility", kind: "project", title: "Accessibility", current: true },
  { slug: "entrepreneurship", kind: "initiative", title: "Entrepreneurship", current: true },
  { slug: "innovation", kind: "initiative", title: "Innovation", current: true },
  { slug: "learning", kind: "initiative", title: "Learning", current: true },
  { slug: "membership", kind: "stakeholder", title: "Membership", current: true },
  { slug: "yuva", kind: "stakeholder", title: "Yuva", current: true },
  { slug: "thalir", kind: "stakeholder", title: "Thalir", current: true },
  { slug: "rural", kind: "stakeholder", title: "Rural Initiatives", current: true },
  { slug: "sports", kind: "sports", title: "Sports", current: true },
  { slug: "branding", kind: "branding", title: "Branding", current: true },
  { slug: "impact", kind: "initiative", title: "Impact", current: false },
  { slug: "future", kind: "initiative", title: "Future", current: false },
];

/** The current set of recognition keys, in default order. */
export const VERTICALS: readonly string[] = KNOWN_RECOGNITIONS.filter((r) => r.current).map((r) => r.slug);

/** Default names of the known keys. For any recognition use verticalLabel(), which falls back on the title. */
export const VERTICAL_LABEL: Record<string, string> = Object.fromEntries(
  KNOWN_RECOGNITIONS.map((r) => [r.slug, r.title])
);

/** The default kind of a known key, or null for one the app doesn't know. */
export function knownKind(slug: string): AwardKind | null {
  return KNOWN_RECOGNITIONS.find((r) => r.slug === slug)?.kind ?? null;
}

/** A recognition's short name: the known default, else its own title, else its key. */
export function verticalLabel(a: { vertical: string; title?: string | null }): string {
  return VERTICAL_LABEL[a.vertical] ?? (a.title?.trim() || a.vertical);
}

export const CATEGORIES = ["pioneers", "trailblazers", "sparks"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  pioneers: "Pioneers",
  trailblazers: "Trailblazers",
  sparks: "Sparks",
};

/** Yi zone codes — the same key in yi.chapters.region and role_assignments.yi_zone. */
export const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;
export type Region = (typeof REGIONS)[number];
// Shown as Yi's own codes. No expanded names: guessing them would be wrong.

export type Layer = "rm" | "nmt";

export const LAYER_LABEL: Record<Layer, string> = {
  rm: "Regional Mentor",
  nmt: "National Management Team",
};

/** Parameter keys are positional (p1..p5); labels come from the matrix doc. */
export const PARAM_KEYS = ["p1", "p2", "p3", "p4", "p5"] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

export type ParamDef = { key: ParamKey; label: string; hint: string };

export const LAYER2_PARAMS: ParamDef[] = [
  {
    key: "p1",
    label: "Planning & Execution",
    hint: "Quality of planning, timely execution, resource use, consistency of delivery.",
  },
  {
    key: "p2",
    label: "CMP Achievement",
    hint: "CMP targets achieved, timeliness, quality of execution, reporting discipline.",
  },
  {
    key: "p3",
    label: "Innovation",
    hint: "New ideas or approaches, problem-solving, relevance, meaningful differentiation.",
  },
  {
    key: "p4",
    label: "Stakeholder Engagement",
    hint: "Member, Yuva, Thalir and Rural engagement; quality of relationships; inclusivity.",
  },
  {
    key: "p5",
    label: "Response",
    hint: "Timely responses to regional and national teams, adaptability, closing action points.",
  },
];

export const LAYER3_PARAMS: ParamDef[] = [
  {
    key: "p1",
    label: "Innovation & 3A Alignment",
    hint: "A non-CMP initiative that is genuinely new and serves Awareness, Action or Advocacy.",
  },
  {
    key: "p2",
    label: "Scalability",
    hint: "Could another chapter replicate it? Cost, transferability, documentation.",
  },
  {
    key: "p3",
    label: "National Alignment",
    hint: "Does it advance Yi's national strategy and priorities?",
  },
  {
    key: "p4",
    label: "Measurable Impact",
    hint: "Real transformation and outcomes, not attendance.",
  },
  {
    key: "p5",
    // A normal NMT measure out of 5, like p1-p4 (Director, 2026-10-15,
    // from the Latest Evaluation Matrix). The NMT total is /25.
    label: "Storytelling & Documentation",
    hint: "Ability to capture and communicate the initiative as a compelling, evidence-backed case study.",
  },
];

export const PARAMS_FOR_LAYER: Record<Layer, ParamDef[]> = {
  rm: LAYER2_PARAMS,
  nmt: LAYER3_PARAMS,
};

export const MAX_PARAM = 5;
export const MAX_LAYER_TOTAL = 25;

/** Word limits: mail 1's, plus the 2026 "why" (recognitions_04). */
export const WORDS = {
  nominationReason: 50,
  flagshipEvent: 50,
  announcementDraft: 100,
  evaluatorReason: 50,
  /** A checker's "send back" note — same 50-word cap as other notes. */
  returnNote: 50,
  /** National Leadership's reason for adding a chapter that did not nominate (Director, 2026-10-10). */
  nlAddedReason: 100,
  nmtComments: 250,
  /** The chapter's "Why should your chapter get this recognition?" (Director, 2026-10-15). */
  justification: 100,
  top3Rationale: 300,
  top3Citation: 250,
} as const;

export const RANK_LABEL: Record<1 | 2 | 3, string> = {
  1: "Winner",
  2: "Runner-up",
  3: "Second runner-up",
};

/** Roles in yi_directory.role_assignments with app='recognitions'. */
export const RX_APP = "recognitions";
export const RX_ROLES = {
  superAdmin: "recognitions_super_admin",
  nationalLeadership: "national_leadership",
  chapterRep: "chapter_rep",
  rm: "rm",
  /** Checks nominations from one region (yi_zone). Piyush's 2026 deck. */
  regionalChair: "regional_chair",
  nmt: "nmt",
  nmtLeader: "nmt_leader",
} as const;

/** The database CHECK on recognition_nominations.justification (recognitions_04). */
export const JUSTIFICATION_MAX_CHARS = 2000;

/**
 * The Regional Chair + Regional Mentor check step (recognitions_02). Not used
 * in 2026 (Director, 2026-10-15): a submitted nomination goes straight into
 * the race. Hidden, not deleted: set this back to true to bring the Check
 * desk, its actions and its wording back.
 */
export const CHECK_STEP_ENABLED = false;
