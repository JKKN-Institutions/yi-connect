/**
 * Future 6.0 canonical constants.
 * Handbook-sourced enums and defaults. Do not duplicate — import from here.
 */

import type { Database } from "@/types/yi-future/database";

// ─── TRACK (Project) CODES [CPB §3.1.2] ─────────────────────────────
export const TRACK_SLUGS = [
  "climate_change",
  "road_safety",
  "accessibility",
  "public_health",
] as const;
export type TrackSlug = (typeof TRACK_SLUGS)[number];

export const TRACK_LABELS: Record<TrackSlug, string> = {
  climate_change: "Climate Change",
  road_safety: "Road Safety",
  accessibility: "Accessibility",
  public_health: "Health",
};

// ─── 90-DAY JOURNEY PHASES [CPB §4] ─────────────────────────────────
export const PHASES = ["phase_a", "phase_b", "phase_c"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABELS: Record<Phase, string> = {
  phase_a: "Phase A — Understanding the Problem",
  phase_b: "Phase B — Solution Development",
  phase_c: "Phase C — Refinement & Presentation",
};

export const PHASE_MONTHS: Record<Phase, string> = {
  phase_a: "Month 1",
  phase_b: "Month 2",
  phase_c: "Month 3",
};

export type ProgrammeDuration = 30 | 60 | 90;

export const PHASE_DURATION_LABELS: Record<ProgrammeDuration, Record<Phase, string>> = {
  30: { phase_a: "Week 1–2", phase_b: "Week 2–3", phase_c: "Week 3–4" },
  60: { phase_a: "Month 1", phase_b: "Month 1–2", phase_c: "Month 2" },
  90: { phase_a: "Month 1", phase_b: "Month 2", phase_c: "Month 3" },
};

export const PROGRAMME_PLAN_TEMPLATES: Record<ProgrammeDuration, {
  label: string;
  description: string;
  eventsPerPhase: number;
  suggestedEvents: Record<Phase, string[]>;
}> = {
  30: {
    label: "30-Day Sprint",
    description: "Compressed 4-week programme — fewer events, faster pace. Best for experienced chapters.",
    eventsPerPhase: 2,
    suggestedEvents: {
      phase_a: ["Orientation + Problem Workshop (combined)", "Expert Talk"],
      phase_b: ["Mentorship Clinic", "Midpoint Review"],
      phase_c: ["Mock Jury", "Documentation Support"],
    },
  },
  60: {
    label: "60-Day Standard",
    description: "Balanced 2-month programme with 2–3 events per phase.",
    eventsPerPhase: 2,
    suggestedEvents: {
      phase_a: ["Orientation Session", "Policy Workshop + Expert Talk"],
      phase_b: ["Mentorship Clinic", "Execution Planning + Midpoint Review"],
      phase_c: ["Refinement Workshop + Mock Jury", "Documentation Support"],
    },
  },
  90: {
    label: "90-Day Full Journey",
    description: "Complete 3-month programme — all 9 events, maximum mentorship depth.",
    eventsPerPhase: 3,
    suggestedEvents: {
      phase_a: ["Orientation Session", "Policy / Solution Framework Workshop", "Expert Talk"],
      phase_b: ["Mentorship Clinic", "Execution Planning Workshop", "Midpoint Review Session"],
      phase_c: ["Refinement Workshop", "Mock Jury Round", "Documentation Support Session"],
    },
  },
};

// ─── PHASE EVENT TYPES [CPB §4.A, §4.B, §4.C] ──────────────────────
export const PHASE_EVENT_TYPES_BY_PHASE: Record<
  Phase,
  ReadonlyArray<Database["future"]["Enums"]["phase_event_type"]>
> = {
  phase_a: ["orientation", "policy_workshop", "expert_talk"],
  phase_b: ["mentorship_clinic", "execution_planning", "midpoint_review"],
  phase_c: ["refinement_workshop", "mock_jury", "doc_support"],
};

export const PHASE_EVENT_LABELS: Record<
  Database["future"]["Enums"]["phase_event_type"],
  string
> = {
  orientation: "Orientation Session",
  policy_workshop: "Policy / Solution Framework Workshop",
  expert_talk: "Expert Talk",
  mentorship_clinic: "Mentorship Clinic",
  execution_planning: "Execution Planning Workshop",
  midpoint_review: "Midpoint Review Session",
  refinement_workshop: "Refinement Workshop",
  mock_jury: "Mock Jury Round",
  doc_support: "Documentation Support Session",
};

// ─── CHAPTER CORE TEAM ROLES [CPB §3.1.1] ───────────────────────────
// Operational core-team — used by the /chapter/setup form (4 mandatory roles).
export const CORE_TEAM_ROLES = [
  "chapter_event_lead",
  "college_outreach_lead",
  "mentorship_content_lead",
  "ops_documentation_lead",
] as const;

// All roles that may appear on chapter_core_team (chair + co-chair + 4 operational).
// Use this for label lookups / display; use CORE_TEAM_ROLES for assignment UI.
export const CHAPTER_TEAM_ROLES = [
  "chapter_chair",
  "chapter_co_chair",
  ...CORE_TEAM_ROLES,
] as const;

export const CORE_TEAM_ROLE_LABELS: Record<
  (typeof CHAPTER_TEAM_ROLES)[number],
  string
> = {
  chapter_chair: "Chapter Chair",
  chapter_co_chair: "Chapter Co-Chair",
  chapter_event_lead: "Chapter Event Lead",
  college_outreach_lead: "College Outreach Lead",
  mentorship_content_lead: "Mentorship & Content Lead",
  ops_documentation_lead: "Operations & Documentation Lead",
};

// ─── JURY ARCHETYPES [CPB §5, HPB §4 Day 2 B] ──────────────────────
export const JURY_ARCHETYPES = [
  "policy",
  "industry",
  "senior_yi",
  "academic",
] as const;

export const JURY_ARCHETYPE_LABELS: Record<
  (typeof JURY_ARCHETYPES)[number],
  string
> = {
  policy: "Policy Expert",
  industry: "Industry Representative",
  senior_yi: "Senior Yi Member",
  academic: "Academic Representative",
};

// ─── TEAM SIZE CONSTRAINTS [PRD v1.0 §1.1 — relaxed from CPB §2.2 3-5 to 1-5] ──
export const TEAM_SIZE_MIN = 1;
export const TEAM_SIZE_MAX = 5;
export const MIN_TEAMS_PER_PROBLEM = 5; // [CPB §8]

// ─── CHAPTER FINAL SECTIONS [CPB §5] ───────────────────────────────
export const CHAPTER_FINAL_SECTIONS = [
  "opening",
  "team_presentations",
  "jury_qa",
  "govt_industry",
  "announcement",
] as const;

export const CHAPTER_FINAL_SECTION_LABELS: Record<
  (typeof CHAPTER_FINAL_SECTIONS)[number],
  string
> = {
  opening: "Opening & Context Setting",
  team_presentations: "Team Presentations",
  jury_qa: "Jury Q&A",
  govt_industry: "Government / Industry Interaction",
  announcement: "Announcement of National Finalists",
};

// ─── NATIONAL DAY 1 SECTIONS [HPB §4 Day 1] ─────────────────────────
export const NATIONAL_DAY1_SECTIONS = [
  "opening",
  "keynote",
  "masterclass",
  "townhall",
  "networking",
] as const;

export const NATIONAL_DAY1_SECTION_LABELS: Record<
  (typeof NATIONAL_DAY1_SECTIONS)[number],
  string
> = {
  opening: "Opening Ceremony",
  keynote: "Keynote Address",
  masterclass: "Masterclass Sessions",
  townhall: "Youth-Policy Dialogue",
  networking: "Networking & Opportunity Zone",
};

// ─── NATIONAL DAY 2 SECTIONS [HPB §4 Day 2] ─────────────────────────
export const NATIONAL_DAY2_SECTIONS = [
  "semi_final",
  "grand_final",
  "opportunity_interviews",
  "recognition",
] as const;

export const NATIONAL_DAY2_SECTION_LABELS: Record<
  (typeof NATIONAL_DAY2_SECTIONS)[number],
  string
> = {
  semi_final: "Semi-Final Presentations",
  grand_final: "Grand National Stage Presentations",
  opportunity_interviews: "Opportunity Interviews",
  recognition: "Recognition Ceremony",
};

// ─── AWARD CATEGORIES [HPB §4 Day 2 D] ──────────────────────────────
export const AWARD_CATEGORIES = [
  "track_champion",
  "best_policy_framework",
  "most_scalable",
  "best_implementation",
  "jury_special_mention",
  "chapter_local_award",
] as const;

export const AWARD_CATEGORY_LABELS: Record<
  (typeof AWARD_CATEGORIES)[number],
  string
> = {
  track_champion: "National Winner — Track Champion",
  best_policy_framework: "Best Policy Framework",
  most_scalable: "Most Scalable Solution",
  best_implementation: "Best Implementation Model",
  jury_special_mention: "Jury Special Mention",
  chapter_local_award: "Chapter Award",
};

// ─── DEFAULT RUBRIC — Yi National Student Competition Judging Kit (May 2026)
// Source: Yi_Judging_Kit.pdf received from Yuva National Chair, Piyush Garg.
// Total 100, threshold 70/100 for national advancement.
export const DEFAULT_RUBRIC = {
  name: "Future 6.0 Default Rubric",
  criteria: [
    {
      key: "problem_understanding",
      label: "Problem Understanding",
      max: 15,
      description:
        "Depth, clarity, India-context relevance. High (12-15): clearly defines problem in Indian context, uses data/examples, identifies root causes. Mid (7-11): understands but lacks depth. Low (0-6): vague or misunderstood.",
    },
    {
      key: "solution_quality",
      label: "Solution Quality",
      max: 25,
      description:
        "Strength and structure of the idea. High (20-25): clear, well-structured, logical problem→solution flow, addresses root cause. Mid (10-19): relevant but partially thought through. Low (0-9): generic, unrealistic or unclear.",
    },
    {
      key: "feasibility_scalability",
      label: "Feasibility & Scalability",
      max: 20,
      description:
        "Can this actually work in India? High (16-20): practical plan, considers cost/infra/stakeholders, scalable across cities. Mid (8-15): some feasibility but execution unclear. Low (0-7): not practical.",
    },
    {
      key: "innovation",
      label: "Innovation & Differentiation",
      max: 15,
      description:
        "Fresh thinking. High (12-15): unique approach or creative model, not commonly discussed. Mid (7-11): some innovation, largely known ideas. Low (0-6): very generic or copied.",
    },
    {
      key: "impact_potential",
      label: "Impact Potential",
      max: 15,
      description:
        "Real-world change potential. High (12-15): large-scale impact, defined beneficiaries, measurable outcomes. Mid (7-11): impact present but not quantified. Low (0-6): limited or unclear.",
    },
    {
      key: "presentation",
      label: "Presentation & Clarity",
      max: 10,
      description:
        "Communication. High (8-10): clear, structured, strong storytelling. Mid (4-7): understandable but lacks polish. Low (0-3): confusing or poorly structured.",
    },
  ],
  total_max: 100,
  threshold_for_national: 70,
} as const;

// ─── JUDGE RECOMMENDATION (Yi Judging Kit) ──────────────────────────
export const JUDGE_RECOMMENDATIONS = [
  "strongly_recommend",
  "recommend",
  "not_recommended",
] as const;
export type JudgeRecommendation = (typeof JUDGE_RECOMMENDATIONS)[number];

export const JUDGE_RECOMMENDATION_LABELS: Record<JudgeRecommendation, string> = {
  strongly_recommend: "Strongly Recommend",
  recommend: "Recommend",
  not_recommended: "Not Recommended",
};

// ─── OPPORTUNITY MODULE TARGETS [HPB §5] ────────────────────────────
export const OPPORTUNITY_TARGETS = {
  minPartners: 3,
  maxPartnersTarget: 5,
  minInternshipSlots: 10,
  maxInternshipSlotsTarget: 20,
};

// ─── NATIONAL SUCCESS TARGETS [HPB §9] ──────────────────────────────
export const NATIONAL_SUCCESS_TARGETS = {
  minParticipants: 1000,
  mandatoryGovernmentEngagement: true,
  internshipOutcomes: true,
  whitepaper: true,
  mediaVisibility: true,
};

// ─── SESSION COOKIE ─────────────────────────────────────────────────
export const SESSION_COOKIE_NAME = "yifuture_session";

// ─── YI / YUVA / CII BRANDING PLACEHOLDERS (Q5 pending) ─────────────
export const BRAND = {
  program: "Future 6.0",
  programFull: "Yi YUVA Future 6.0 (2026)",
  tagline: "From Opinions to Impact",
  colors: {
    navy: "#1a1a3e",
    yiGold: "#F5A623",
    yiSaffron: "#FF9933",
    yiGreen: "#138808",
    ivory: "#FEFCF6",
  },
  organizations: ["Yi (Young Indians)", "Yi YUVA", "CII"],
};
