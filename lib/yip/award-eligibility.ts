// Award eligibility — the ROLE/SIDE part of each award's eligibility rule.
//
// ONE copy, used by BOTH the results engine (computeResults → eligibilityFn in
// app/yip/actions/results.ts) and the chair's pin (setAwardWinner in
// app/yip/actions/award-overrides.ts), so a chair can never pin a winner the
// engine itself would refuse. Pure module (no "use server") — a "use server"
// file may only export async functions.

import type { RoundLevel } from "@/lib/yip/round-level";
import { HOUSE_OFFICIAL_ROLES } from "@/lib/yip/constants";

// ─── Role classification ─────────────────────────────────────────

export const RULING_ROLES = new Set([
  "prime_minister",
  "deputy_prime_minister",
  "cabinet_minister",
  // 2026 Regional Round: a Deputy Minister is an ordinary government-side
  // participant — eligible for Best Member — Ruling Bench like a minister.
  "deputy_minister",
  "mp",
  "bill_committee",
  // A deposed PM / Deputy PM stays on the ruling bench.
  "ex_prime_minister",
  "ex_deputy_prime_minister",
]);

export const OPPOSITION_ROLES = new Set([
  "leader_of_opposition",
  "shadow_minister",
  "mp",
  "bill_committee",
  // A deposed Leader of Opposition stays on the opposition bench.
  "ex_leader_of_opposition",
]);

export const LEADERSHIP_ROLES = new Set([
  "speaker",
  "deputy_speaker",
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
  "party_leader",
  "coalition_leader",
  "cabinet_minister",
  "shadow_minister",
  "committee_chair",
  // "Ex-" deposed leaders keep their leadership standing (and points). Note:
  // role-SPECIFIC awards (e.g. "Best Prime Minister") key off the exact role
  // string, so those still resolve to the CURRENT holder, not the Ex-.
  "ex_prime_minister",
  "ex_deputy_prime_minister",
  "ex_leader_of_opposition",
  "ex_speaker",
  "ex_deputy_speaker",
]);

export function isRulingMP(role: string | null, side: string | null): boolean {
  if (!role || !side) return false;
  if (side !== "ruling") return false;
  return RULING_ROLES.has(role);
}

export function isOppositionMP(
  role: string | null,
  side: string | null
): boolean {
  if (!role || !side) return false;
  if (side !== "opposition") return false;
  return OPPOSITION_ROLES.has(role);
}

/**
 * The role/side half of an award's eligibility (yip.award_definitions.eligibility).
 *
 *   true  → this participant's role/side qualifies
 *   false → it does not (an UNKNOWN eligibility value is false: fail closed —
 *           an empty pool, never a wrong winner)
 *   null  → this eligibility is not a role rule; it depends on result data
 *           (e.g. 'no_disciplinary') and can't be judged from the role alone
 */
export function roleEligibility(
  eligibility: string,
  role: string | null,
  side: string | null
): boolean | null {
  switch (eligibility) {
    case "all":
      return true;
    case "speaker":
      return role === "speaker";
    case "leadership":
      return !!role && LEADERSHIP_ROLES.has(role);
    case "ruling":
      return isRulingMP(role, side);
    case "opposition":
      return isOppositionMP(role, side);
    case "independent":
      return role === "independent_mp";
    // Competing MPs only (Director ruling 2026-10-28): excludes the officials
    // of the House (Speaker, Deputy, Nominated Speaker, their ex- forms,
    // Journalist, Administrator). No role = not a seated MP → not eligible.
    case "mps_only":
      return !!role && !HOUSE_OFFICIAL_ROLES.has(role);
    case "no_disciplinary":
      return null;
    default:
      return false;
  }
}

/** Plain-English "who this award is for", used when a chair's pick is refused. */
export const ELIGIBILITY_PLAIN: Record<string, string> = {
  all: "open to everyone",
  speaker: "for the Speaker only",
  leadership:
    "for leadership roles only — Speaker, Deputy Speaker, Prime Minister, Deputy PM, Leader of the Opposition, party and coalition leaders, ministers, shadow ministers and committee chairs",
  ruling: "for ruling-bench (government side) members only",
  opposition: "for opposition-bench members only",
  independent: "for Independent MPs only",
  mps_only:
    "for MPs only — not the Speaker, Deputy Speakers, Journalists or Administrators",
  no_disciplinary: "for students with no disciplinary flag",
};

// ─── Per-school award cap ────────────────────────────────────────

// Per-school award cap (Director ruling 2026-06-28): at most this many INDIVIDUAL
// awards per school. Team awards (Team Spirit) are a single collective committee
// prize and are EXEMPT. Blank/unknown school is exempt too (each blank is its own
// unknown school — grouping distinct unknown-school students would be wrong).
export const SCHOOL_AWARD_CAP = 3;

/**
 * CHAPTER ROUNDS ONLY (Director ruling 2026-08-29).
 *
 * At a chapter round students arrive in school blocks and the cap does real
 * work — 69 of 87 schools field 4+ students, and 11 of the 36 schools that have
 * ever won something sit exactly at the ceiling.
 *
 * At a REGIONAL round it is both near-useless and unfair. Chapters send a few
 * delegates each from many different schools, so only 4 of 124 schools could
 * ever reach the cap. Worse, the blank-school exemption above makes it apply
 * unevenly to rounds of the same competition: on the day this was scoped,
 * Ahmedabad had 163 of 163 delegates with no school recorded and Durg 115 of
 * 115 — the cap was entirely inert for both — while SRTN had only 9 of 196
 * blank, so it bound on 95% of that field. Three regional rounds, three
 * different rulebooks, decided by nothing but whether a school name was typed.
 *
 * School is not the unit of a regional round; the CHAPTER is (Director,
 * 2026-08-29). A spread rule at that level belongs on chapter, not school.
 *
 * This changes NOTHING already computed: no regional round has ever assigned an
 * individual award, and chapter rounds keep the cap exactly as before.
 *
 * A NULL level keeps the cap. The level can be unresolved (an event with none
 * set, or a lookup that failed), and an unknown must never silently RELAX a
 * fairness rule — before this change the cap applied everywhere, so an
 * unresolved round keeps behaving exactly as it did. The cap is lifted only
 * where we positively know the round is not a chapter one.
 */
export function schoolCapApplies(roundLevel: RoundLevel | null): boolean {
  return roundLevel !== "regional" && roundLevel !== "national";
}
