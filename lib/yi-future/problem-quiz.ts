// ─────────────────────────────────────────────────────────────────────
// problem-quiz.ts — ADVISORY problem-match quiz (no DB, no side effects).
//
// A delegate who is unsure which of the 12 Future 6.0 problem statements
// to rank can take this 9-question affinity quiz. Each answer option
// carries `weights` that nudge:
//   • a TRACK slug  (broad theme affinity), and/or
//   • a problem TITLE (specific-problem affinity).
//
// `scoreQuiz` is a PURE function: given the chosen answers and the live
// catalog of 12 problems (id + title + track_slug), it returns all 12
// problems scored & sorted descending. Deterministic — no Date, no
// Math.random, no I/O. The UI uses the ranking only as a suggestion; it
// is NEVER persisted.
//
// Track slugs match `future.tracks.slug`. In THIS (monorepo) edition the
// four 6.0 track slugs are UNDERSCORED (see lib/yi-future/constants.ts):
//   road_safety | climate_change | accessibility | public_health
// (Slugs are resolved from the live DB at render time and passed into
//  scoreQuiz, so a slug mismatch simply contributes 0 — fail-soft.)
// ─────────────────────────────────────────────────────────────────────

export type TrackSlug =
  | "road_safety"
  | "climate_change"
  | "accessibility"
  | "public_health";

// Canonical problem titles, grouped by track. Used as weight keys so the
// quiz can nudge a SPECIFIC problem, not just a track.
export const PROBLEM_TITLES = {
  ROAD_GOLDEN_HOUR: "Golden Hour Response System",
  ROAD_COMPLIANCE: "Traffic Rule Compliance Engine",
  ROAD_PEDESTRIAN: "Safer Roads for Pedestrians & Non-Motor Users",
  CLIMATE_WASTE: "Waste Management at Source",
  CLIMATE_TREE: "Tree Survival, Not Just Plantation",
  CLIMATE_POND: "Pond Rejuvenation at Scale",
  ACCESS_AUDIT: "From Audit to Action",
  ACCESS_SIGN: "Indian Sign Language for All",
  ACCESS_EMPLOY: "Employment for Persons with Disabilities",
  HEALTH_MENTAL: "Youth Mental Health Access",
  HEALTH_ADDICTION: "Breaking Peer Pressure Addiction",
  HEALTH_PRIMARY: "Strengthening Primary Healthcare Systems",
} as const;

const T = PROBLEM_TITLES;

// A weight bag: any key may be a TrackSlug or a problem title string.
// Values are small positive integers; they accumulate across questions.
export type WeightBag = Partial<Record<TrackSlug, number>> &
  Record<string, number>;

export type QuizOption = {
  /** Stable id, unique within its question. */
  id: string;
  /** Short label shown on the radio. */
  label: string;
  /** Optional one-line helper under the label. */
  hint?: string;
  /** Track-slug and/or problem-title weights this option contributes. */
  weights: WeightBag;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

// ─── QUESTION BANK (9 questions) ─────────────────────────────────────
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1_headline",
    prompt: "Which headline would make you stop and read?",
    options: [
      {
        id: "a",
        label: "“The first 60 minutes that decide who survives a crash”",
        hint: "Emergency response on the road",
        weights: { road_safety: 3, [T.ROAD_GOLDEN_HOUR]: 4 },
      },
      {
        id: "b",
        label: "“Why the lake your grandparents swam in is now a drain”",
        hint: "Reviving water bodies & green cover",
        weights: { climate_change: 3, [T.CLIMATE_POND]: 3, [T.CLIMATE_TREE]: 1 },
      },
      {
        id: "c",
        label: "“A city built for some, locked to others”",
        hint: "Making spaces & jobs inclusive",
        weights: { accessibility: 3, [T.ACCESS_AUDIT]: 3 },
      },
      {
        id: "d",
        label: "“The quiet crisis in every college hostel room”",
        hint: "Youth wellbeing & mental health",
        weights: { public_health: 3, [T.HEALTH_MENTAL]: 4 },
      },
    ],
  },
  {
    id: "q2_change",
    prompt: "What kind of change excites you most?",
    options: [
      {
        id: "a",
        label: "Saving lives in an emergency",
        weights: { road_safety: 3, [T.ROAD_GOLDEN_HOUR]: 2 },
      },
      {
        id: "b",
        label: "Protecting and restoring the environment",
        weights: { climate_change: 3, [T.CLIMATE_WASTE]: 1, [T.CLIMATE_TREE]: 1 },
      },
      {
        id: "c",
        label: "Making spaces and opportunities inclusive",
        weights: { accessibility: 3, [T.ACCESS_EMPLOY]: 2 },
      },
      {
        id: "d",
        label: "Improving everyday health and wellbeing",
        weights: { public_health: 3, [T.HEALTH_PRIMARY]: 2 },
      },
    ],
  },
  {
    id: "q3_skill",
    prompt: "How do you most like to make an impact?",
    options: [
      {
        id: "a",
        label: "Building a tech tool or app",
        hint: "Data, systems, automation",
        weights: {
          [T.ROAD_COMPLIANCE]: 3,
          [T.ROAD_GOLDEN_HOUR]: 2,
          [T.ACCESS_SIGN]: 2,
          [T.HEALTH_MENTAL]: 1,
        },
      },
      {
        id: "b",
        label: "Designing a policy or standard",
        hint: "Rules, audits, frameworks",
        weights: {
          [T.ACCESS_AUDIT]: 3,
          [T.ROAD_COMPLIANCE]: 2,
          [T.HEALTH_PRIMARY]: 2,
        },
      },
      {
        id: "c",
        label: "Running a community programme",
        hint: "On-ground action with people",
        weights: {
          [T.CLIMATE_POND]: 3,
          [T.CLIMATE_TREE]: 2,
          [T.ACCESS_EMPLOY]: 2,
          [T.HEALTH_PRIMARY]: 1,
        },
      },
      {
        id: "d",
        label: "Creating a behaviour-change campaign",
        hint: "Awareness, habits, mindset",
        weights: {
          [T.HEALTH_ADDICTION]: 3,
          [T.CLIMATE_WASTE]: 2,
          [T.ROAD_PEDESTRIAN]: 1,
        },
      },
    ],
  },
  {
    id: "q4_statistic",
    prompt: "Which India statistic bothers you most?",
    options: [
      {
        id: "a",
        label: "Over 1.5 lakh people die on Indian roads every year",
        weights: { road_safety: 3, [T.ROAD_PEDESTRIAN]: 2, [T.ROAD_COMPLIANCE]: 1 },
      },
      {
        id: "b",
        label: "Most cities dump the majority of their waste untreated",
        weights: { climate_change: 3, [T.CLIMATE_WASTE]: 4 },
      },
      {
        id: "c",
        label: "Crores of persons with disabilities are shut out of jobs",
        weights: { accessibility: 3, [T.ACCESS_EMPLOY]: 4 },
      },
      {
        id: "d",
        label: "Most young people with distress never reach any help",
        weights: { public_health: 3, [T.HEALTH_MENTAL]: 3 },
      },
    ],
  },
  {
    id: "q5_who",
    prompt: "Who do you most want to help?",
    options: [
      {
        id: "a",
        label: "Crash victims and the people who rush to them",
        weights: { road_safety: 2, [T.ROAD_GOLDEN_HOUR]: 3 },
      },
      {
        id: "b",
        label: "Pedestrians, cyclists and street vendors",
        weights: { road_safety: 2, [T.ROAD_PEDESTRIAN]: 3 },
      },
      {
        id: "c",
        label: "Persons with disabilities and the Deaf community",
        weights: { accessibility: 2, [T.ACCESS_SIGN]: 3, [T.ACCESS_AUDIT]: 1 },
      },
      {
        id: "d",
        label: "Students fighting stress, peer pressure or addiction",
        weights: { public_health: 2, [T.HEALTH_ADDICTION]: 3, [T.HEALTH_MENTAL]: 1 },
      },
    ],
  },
  {
    id: "q6_prevent_respond",
    prompt: "Are you more drawn to prevention or response?",
    options: [
      {
        id: "a",
        label: "Prevention — stop the problem before it happens",
        weights: {
          [T.ROAD_COMPLIANCE]: 2,
          [T.CLIMATE_WASTE]: 2,
          [T.HEALTH_ADDICTION]: 2,
          [T.CLIMATE_TREE]: 1,
        },
      },
      {
        id: "b",
        label: "Response — act fast when something goes wrong",
        weights: {
          [T.ROAD_GOLDEN_HOUR]: 3,
          [T.HEALTH_PRIMARY]: 1,
        },
      },
      {
        id: "c",
        label: "Restoration — repair what has already been damaged",
        weights: {
          [T.CLIMATE_POND]: 3,
          [T.CLIMATE_TREE]: 2,
        },
      },
      {
        id: "d",
        label: "Inclusion — fix what was never fair to begin with",
        weights: {
          [T.ACCESS_AUDIT]: 2,
          [T.ACCESS_EMPLOY]: 2,
          [T.ACCESS_SIGN]: 1,
        },
      },
    ],
  },
  {
    id: "q7_verb",
    prompt: "Pick the verb that feels most like you:",
    options: [
      {
        id: "a",
        label: "Rescue",
        weights: { road_safety: 2, [T.ROAD_GOLDEN_HOUR]: 3 },
      },
      {
        id: "b",
        label: "Restore",
        weights: { climate_change: 2, [T.CLIMATE_POND]: 2, [T.CLIMATE_TREE]: 2 },
      },
      {
        id: "c",
        label: "Include",
        weights: { accessibility: 2, [T.ACCESS_EMPLOY]: 2, [T.ACCESS_SIGN]: 1 },
      },
      {
        id: "d",
        label: "Heal",
        weights: { public_health: 2, [T.HEALTH_MENTAL]: 2, [T.HEALTH_PRIMARY]: 1 },
      },
    ],
  },
  {
    id: "q8_weekend",
    prompt: "Your team gets a free weekend to test an idea. You'd rather…",
    options: [
      {
        id: "a",
        label: "Map black-spots and pitch fixes to traffic police",
        weights: { road_safety: 2, [T.ROAD_COMPLIANCE]: 2, [T.ROAD_PEDESTRIAN]: 1 },
      },
      {
        id: "b",
        label: "Run a clean-up and set up source-level waste sorting",
        weights: { climate_change: 2, [T.CLIMATE_WASTE]: 3 },
      },
      {
        id: "c",
        label: "Audit a campus for ramps, signage and access gaps",
        weights: { accessibility: 2, [T.ACCESS_AUDIT]: 3 },
      },
      {
        id: "d",
        label: "Host a peer support and wellbeing session",
        weights: { public_health: 2, [T.HEALTH_MENTAL]: 2, [T.HEALTH_ADDICTION]: 1 },
      },
    ],
  },
  {
    id: "q9_legacy",
    prompt: "When the program ends, what would make you proudest?",
    options: [
      {
        id: "a",
        label: "A faster way for help to reach crash victims",
        weights: { road_safety: 2, [T.ROAD_GOLDEN_HOUR]: 2 },
      },
      {
        id: "b",
        label: "Trees that actually survived, or a pond brought back to life",
        weights: { climate_change: 2, [T.CLIMATE_TREE]: 2, [T.CLIMATE_POND]: 2 },
      },
      {
        id: "c",
        label: "Real jobs or new sign-language access for the Deaf",
        weights: { accessibility: 2, [T.ACCESS_EMPLOY]: 2, [T.ACCESS_SIGN]: 2 },
      },
      {
        id: "d",
        label: "Stronger local clinics or healthier student habits",
        weights: { public_health: 2, [T.HEALTH_PRIMARY]: 2, [T.HEALTH_ADDICTION]: 1 },
      },
    ],
  },
];

// ─── PURE SCORING ────────────────────────────────────────────────────

export type ScoredProblem = { problemId: string; score: number };

type ProblemInput = { id: string; title: string; track_slug: string };

/**
 * Score all problems from the chosen quiz answers.
 *
 * @param answers  Map of questionId -> chosen optionId.
 * @param problems The live catalog of 12 problems (id, title, track_slug).
 * @returns        Every problem scored, sorted by score descending. Ties
 *                 are broken by title (A→Z) so the order is fully
 *                 deterministic.
 *
 * Scoring model: walk each answered option, accumulate its weight bag into
 * a single tally keyed by track-slug AND problem-title. A problem's score
 * is its own title weight (specific affinity) PLUS its track weight (broad
 * affinity). Pure: no Date, no randomness, no external state.
 */
export function scoreQuiz(
  answers: Record<string, string>,
  problems: ProblemInput[]
): ScoredProblem[] {
  // 1. Accumulate all selected option weights into one tally.
  const tally: Record<string, number> = {};
  for (const question of QUIZ_QUESTIONS) {
    const chosenId = answers[question.id];
    if (!chosenId) continue;
    const option = question.options.find((o) => o.id === chosenId);
    if (!option) continue;
    for (const [key, value] of Object.entries(option.weights)) {
      tally[key] = (tally[key] ?? 0) + (value ?? 0);
    }
  }

  // 2. Per problem: title weight + its track-slug weight.
  const scored: ScoredProblem[] = problems.map((p) => {
    const titleScore = tally[p.title] ?? 0;
    const trackScore = tally[p.track_slug] ?? 0;
    return { problemId: p.id, score: titleScore + trackScore };
  });

  // 3. Sort desc; deterministic tie-break by title.
  const titleById = new Map(problems.map((p) => [p.id, p.title]));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = titleById.get(a.problemId) ?? "";
    const tb = titleById.get(b.problemId) ?? "";
    return ta.localeCompare(tb);
  });

  return scored;
}
