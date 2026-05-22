/**
 * Mentor incubation rubric — Future 6.0
 *
 * Used by mentors to score teams during the 90-day incubation across phase events
 * (orientation, policy workshop, expert talk, mentorship clinic, midpoint review,
 * mock jury, etc.). Mirrors the official Yi Judging Kit format.
 *
 * Handbook ref: [PRD §4.2 — "We have to define this rubric now"]
 * Total: 100 points across 5 criteria.
 */

export interface MentorRubricCriterion {
  key:
    | "participation"
    | "submission_quality"
    | "progress"
    | "engagement"
    | "growth";
  label: string;
  max: number;
  description: string;
}

export interface MentorScores {
  participation: number;
  submission_quality: number;
  progress: number;
  engagement: number;
  growth: number;
}

export const MENTOR_RUBRIC = {
  name: "Future 6.0 Mentor Incubation Rubric",
  criteria: [
    {
      key: "participation",
      label: "Participation & Attendance",
      max: 25,
      description:
        "How consistently the team showed up across phase events and clinics. " +
        "High (20–25): all members present at every session, active in the room. " +
        "Mid (12–19): most members attend; one or two absences. " +
        "Low (0–11): repeated absences, sessions skipped, captain attending alone.",
    },
    {
      key: "submission_quality",
      label: "Submission Quality",
      max: 25,
      description:
        "Quality of weekly check-ins, problem framing, draft solution, and final whitepaper inputs. " +
        "High (20–25): well-cited, original, evidence-backed, clearly written. " +
        "Mid (12–19): on-topic but thin on data or narrative. " +
        "Low (0–11): late, vague, copy-pasted, or missing.",
    },
    {
      key: "progress",
      label: "Progress",
      max: 25,
      description:
        "Week-on-week movement — does the team make visible progress between mentor sessions? " +
        "High (20–25): clear deltas every week, prototypes or research evolving. " +
        "Mid (12–19): some weeks strong, others stalled. " +
        "Low (0–11): same artifact reshown for weeks, no real iteration.",
    },
    {
      key: "engagement",
      label: "Engagement",
      max: 15,
      description:
        "Initiative shown — questions asked, follow-ups, ownership beyond what mentor prompts. " +
        "High (12–15): team drives the agenda, asks sharp questions, brings new sources. " +
        "Mid (7–11): responsive but reactive — answers when asked. " +
        "Low (0–6): passive, silent, mentor doing all the work.",
    },
    {
      key: "growth",
      label: "Growth",
      max: 10,
      description:
        "Clarity gain over time — has the team's understanding of the problem and solution sharpened? " +
        "High (8–10): visible jump in articulation, framing, and confidence from start to end. " +
        "Mid (4–7): some growth, but stuck on a few core ambiguities. " +
        "Low (0–3): no measurable improvement; team ends where it started.",
    },
  ],
  total_max: 100,
} as const;

export const MENTOR_CRITERION_KEYS = [
  "participation",
  "submission_quality",
  "progress",
  "engagement",
  "growth",
] as const;

/**
 * Sum and validate mentor scores against criterion maxima.
 * Throws if any score is out of range.
 */
export function computeMentorTotal(scores: MentorScores): number {
  let total = 0;
  for (const c of MENTOR_RUBRIC.criteria) {
    const v = scores[c.key];
    if (v === undefined || v === null || Number.isNaN(v)) {
      throw new Error(`Missing score for ${c.key}`);
    }
    if (v < 0 || v > c.max) {
      throw new Error(
        `Invalid score for ${c.key}: ${v} (expected 0..${c.max})`
      );
    }
    total += v;
  }
  return Number(total.toFixed(2));
}
