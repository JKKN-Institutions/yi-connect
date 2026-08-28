/**
 * Shared skill-axis classification for YIP jury scores.
 *
 * Lifted verbatim out of app/yip/actions/skill-profile.ts so the /me profile and
 * the parliamentary profile classify identically — two copies of this keyword
 * table would drift the moment a new session type added a dimension, and the
 * two screens would then disagree about the same student in front of them.
 *
 * It lives in lib/ rather than beside the action because that file is
 * "use server": anything exported from it becomes a server-action endpoint, and
 * these are plain synchronous helpers.
 */

export type SkillAxis = "research" | "speaking" | "policy" | "process";

// Sub-criterion key → max_score (from lib/yip/constants.ts DEFAULT_RUBRICS).
// Duplicated here to keep this action self-contained and avoid pulling
// rubric structure code into the aggregator. Numbers verified against
// handbook page 20.
export const KEY_MAX: Record<string, number> = {
  // MP rubric (nested)
  "content.relevance": 10,
  "content.originality": 10,
  "content.research": 10,
  "communication.clarity": 10,
  "communication.confidence": 10,
  "communication.fluency": 5,
  "conduct.rules": 10,
  "conduct.engagement": 10,
  "conduct.respect": 10,
  "argumentation.strength": 10,
  "argumentation.emotional": 5,
  "teamwork.coordination": 5,
  "teamwork.listening": 5,
  // Speaker rubric (flat) — used as fallback when no sub-criteria exist
  impartiality: 30,
  leadership: 25,
  knowledge: 20,
  communication: 15,
  time_management: 10,
  // Deputy Speaker extras
  support: 30,
  adaptability: 10,
};

// Classify ANY recorded criterion key into one of the four axes by keyword.
//
// WHY KEYWORDS, NOT A FIXED LIST: jurors record under per-session-type NAMESPACED
// keys (`mupi.*`, `qh.*`, `cmte.*`, `zero.*`, `debate.*`, `bill.*`, `pol.*`) plus
// a few flat keys (`communication`, `vision`, …) — the live dimensions live in
// yip.session_parameters and grow as new session types are added. A hardcoded
// key list silently produced an all-zero profile the moment the rubric model
// moved to namespaced keys (the "Profile builds after your first scoring round"
// bug). Matching on the key's MEANING resolves every current dimension AND any
// future one. Verified against all 46 active dimensions on 2026-06-27. Order is
// significant: more specific axes are tested first so a key like
// `qh.research_relevance` lands in research (not policy via "relevance").
export function classifyAxis(rawKey: string): SkillAxis | null {
  const key = rawKey.toLowerCase();
  const suffix = key.includes(".") ? key.split(".").pop()! : key;
  const s = `${suffix} ${key}`;
  // research — knowledge, preparation, originality, analysis, drafting.
  if (
    /research|knowledge|originality|prepar|critical|subject|understand|draft/.test(
      s
    )
  ) {
    return "research";
  }
  // speaking — communication, delivery, presentation, response, rebuttal.
  if (
    /communicat|delivery|present|rebuttal|response|supplementar|fluen|clarity|confidence|defence|floor_presence|speak/.test(
      s
    )
  ) {
    return "speaking";
  }
  // policy — vision, policy orientation, relevance, substance, feasibility, ideas.
  if (
    /policy|vision|relevance|feasib|ideolog|creativ|problem|argument|identity|quality_question|quality_committee/.test(
      s
    )
  ) {
    return "policy";
  }
  // process — conduct, procedure, time, initiative, teamwork, strategy.
  if (
    /conduct|procedure|time|initiative|team|collab|coalition|negoti|strateg|leadership|rules|engagement|respect|impartial|adapt|support/.test(
      s
    )
  ) {
    return "process";
  }
  return null;
}

export function readNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

