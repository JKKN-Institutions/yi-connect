/**
 * Yi Recognitions — fixed vocabulary from the spec.
 *
 * Sources:
 *   mail 1 (process flow)            verticals, categories, word limits
 *   Latest_Evaluation_Matrix doc     Layer 2 / Layer 3 parameters, weights
 *
 * Mail 1 lists "Health" twice in the apply matrix; it is one vertical here.
 */

export const VERTICALS = [
  "membership",
  "learning",
  "impact",
  "future",
  "climate",
  "rural",
  "health",
] as const;
export type Vertical = (typeof VERTICALS)[number];

export const VERTICAL_LABEL: Record<Vertical, string> = {
  membership: "Membership",
  learning: "Learning",
  impact: "Impact",
  future: "Future",
  climate: "Climate",
  rural: "Rural",
  health: "Health",
};

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
    // The 2026 deck calls this a bonus criterion (5 pts). How the bonus counts
    // toward the NMT total is still open with Piyush, so the total stays /25.
    label: "Storytelling & Documentation (bonus)",
    hint: "Bonus, up to 5. Could this become a national case study? Narrative clarity, visuals, evidence, replicability.",
  },
];

export const PARAMS_FOR_LAYER: Record<Layer, ParamDef[]> = {
  rm: LAYER2_PARAMS,
  nmt: LAYER3_PARAMS,
};

export const MAX_PARAM = 5;
export const MAX_LAYER_TOTAL = 25;

/** Word limits, exactly as mail 1 states them. */
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
