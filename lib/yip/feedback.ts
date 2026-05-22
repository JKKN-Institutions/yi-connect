// ─── Feedback question metadata & helpers ──────────────────────────────
// Handbook p.8 + p.46 — post-event feedback from participants & stakeholders.
// Questions are opinionated: we want signal, not filler.

export type FeedbackRespondentType =
  | "participant"
  | "organizer"
  | "volunteer"
  | "jury";

export type FeedbackFieldType = "rating" | "nps" | "text" | "longtext" | "boolean";

export type FeedbackQuestion = {
  /** Column in feedback_responses OR a key under `answers` JSONB */
  key: string;
  /** true if this maps to a dedicated column (overall_rating, nps_score, etc.) */
  column: boolean;
  label: string;
  helper?: string;
  type: FeedbackFieldType;
  required?: boolean;
  /** For longtext fields, soft char limit */
  maxLength?: number;
};

// Core columns shared across respondent types (maps 1:1 to schema columns)
const CORE_OVERALL: FeedbackQuestion = {
  key: "overall_rating",
  column: true,
  label: "Overall, how would you rate the YIP session?",
  helper: "1 = poor, 5 = excellent",
  type: "rating",
  required: true,
};

const CORE_ORG: FeedbackQuestion = {
  key: "organization_rating",
  column: true,
  label: "How well was the event organized?",
  helper: "Venue, timing, logistics, communication",
  type: "rating",
  required: true,
};

const CORE_CONTENT: FeedbackQuestion = {
  key: "content_rating",
  column: true,
  label: "How would you rate the content and discussions?",
  helper: "Agenda depth, debate quality, learning value",
  type: "rating",
  required: true,
};

const CORE_NPS: FeedbackQuestion = {
  key: "nps_score",
  column: true,
  label: "How likely are you to recommend YIP to a friend or colleague?",
  helper: "0 = not at all likely, 10 = extremely likely",
  type: "nps",
  required: true,
};

// ─── Participants (students) ───────────────────────────────────────────
// 7 questions. Strong signal on learning outcome + friction.
export const PARTICIPANT_QUESTIONS: FeedbackQuestion[] = [
  CORE_OVERALL,
  CORE_ORG,
  CORE_CONTENT,
  CORE_NPS,
  {
    key: "biggest_takeaway",
    column: true,
    label: "What's the single biggest thing you're taking away?",
    helper: "One sentence — be specific",
    type: "longtext",
    required: true,
    maxLength: 500,
  },
  {
    key: "learned_something",
    column: true,
    label: "What did you learn about Indian Parliament or civic life?",
    type: "longtext",
    maxLength: 500,
  },
  {
    key: "suggestions",
    column: true,
    label: "What would make the next YIP better for students like you?",
    type: "longtext",
    maxLength: 500,
  },
];

// ─── Organizers ────────────────────────────────────────────────────────
// 7 questions. Focused on execution + process improvement.
export const ORGANIZER_QUESTIONS: FeedbackQuestion[] = [
  CORE_OVERALL,
  CORE_ORG,
  CORE_CONTENT,
  CORE_NPS,
  {
    key: "what_worked",
    column: true,
    label: "What worked well and should be repeated?",
    helper: "Concrete practices, not generalities",
    type: "longtext",
    required: true,
    maxLength: 600,
  },
  {
    key: "what_didnt_work",
    column: true,
    label: "What broke or nearly broke?",
    helper: "Tell the truth — this is how the next chapter avoids it",
    type: "longtext",
    required: true,
    maxLength: 600,
  },
  {
    key: "suggestions",
    column: true,
    label: "One change you'd make for the next event",
    type: "longtext",
    maxLength: 500,
  },
];

// ─── Volunteers ────────────────────────────────────────────────────────
// 6 questions. Logistics & onboarding focus.
export const VOLUNTEER_QUESTIONS: FeedbackQuestion[] = [
  CORE_OVERALL,
  CORE_ORG,
  CORE_NPS,
  {
    key: "role_clarity",
    column: false,
    label: "Did you know what to do at your station?",
    helper: "1 = completely lost, 5 = crystal clear",
    type: "rating",
    required: true,
  },
  {
    key: "what_didnt_work",
    column: true,
    label: "Where did you get stuck or see things slip?",
    type: "longtext",
    required: true,
    maxLength: 500,
  },
  {
    key: "suggestions",
    column: true,
    label: "What would make volunteering here easier next time?",
    type: "longtext",
    maxLength: 400,
  },
];

// ─── Jury ──────────────────────────────────────────────────────────────
// 7 questions. Rubric + process + fairness focus.
export const JURY_QUESTIONS: FeedbackQuestion[] = [
  CORE_OVERALL,
  CORE_CONTENT,
  CORE_NPS,
  {
    key: "rubric_clarity",
    column: false,
    label: "Was the scoring rubric clear and usable?",
    helper: "1 = confusing, 5 = unambiguous",
    type: "rating",
    required: true,
  },
  {
    key: "scoring_time_adequate",
    column: false,
    label: "Did you have enough time to score fairly?",
    type: "boolean",
  },
  {
    key: "what_didnt_work",
    column: true,
    label: "What made scoring harder than it needed to be?",
    type: "longtext",
    required: true,
    maxLength: 500,
  },
  {
    key: "suggestions",
    column: true,
    label: "One change to the evaluation process you'd recommend",
    type: "longtext",
    maxLength: 500,
  },
];

// ─── Lookup by respondent type ─────────────────────────────────────────
export function getQuestionsFor(
  type: FeedbackRespondentType
): FeedbackQuestion[] {
  switch (type) {
    case "participant":
      return PARTICIPANT_QUESTIONS;
    case "organizer":
      return ORGANIZER_QUESTIONS;
    case "volunteer":
      return VOLUNTEER_QUESTIONS;
    case "jury":
      return JURY_QUESTIONS;
  }
}

// ─── NPS buckets ───────────────────────────────────────────────────────
export type NpsBucket = "detractor" | "passive" | "promoter";

export function npsBucket(score: number): NpsBucket {
  if (score <= 6) return "detractor";
  if (score <= 8) return "passive";
  return "promoter";
}

/** Net Promoter Score = %promoters − %detractors. Returns integer in [-100, 100]. */
export function computeNps(scores: number[]): number {
  if (scores.length === 0) return 0;
  let promoters = 0;
  let detractors = 0;
  for (const s of scores) {
    const b = npsBucket(s);
    if (b === "promoter") promoters++;
    else if (b === "detractor") detractors++;
  }
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

// ─── Display labels ────────────────────────────────────────────────────
export const RESPONDENT_LABELS: Record<FeedbackRespondentType, string> = {
  participant: "Student Participant",
  organizer: "Organizer",
  volunteer: "Volunteer",
  jury: "Jury Member",
};

export const RESPONDENT_COLORS: Record<FeedbackRespondentType, string> = {
  participant: "bg-blue-100 text-blue-700 border-blue-200",
  organizer: "bg-[#FF9933]/15 text-[#b2661f] border-[#FF9933]/30",
  volunteer: "bg-emerald-100 text-emerald-700 border-emerald-200",
  jury: "bg-purple-100 text-purple-700 border-purple-200",
};

export const NPS_BUCKET_LABELS: Record<NpsBucket, string> = {
  detractor: "Detractor",
  passive: "Passive",
  promoter: "Promoter",
};

export const NPS_BUCKET_COLORS: Record<NpsBucket, string> = {
  detractor: "bg-red-100 text-red-700",
  passive: "bg-amber-100 text-amber-700",
  promoter: "bg-emerald-100 text-emerald-700",
};

// ─── Shared submit payload shape ───────────────────────────────────────
export type FeedbackPayload = {
  overall_rating?: number | null;
  organization_rating?: number | null;
  content_rating?: number | null;
  learned_something?: string | null;
  would_recommend?: boolean | null;
  nps_score?: number | null;
  biggest_takeaway?: string | null;
  what_worked?: string | null;
  what_didnt_work?: string | null;
  suggestions?: string | null;
  answers?: Record<string, unknown>;
};

export type FeedbackResponseRow = {
  id: string;
  event_id: string;
  respondent_type: FeedbackRespondentType;
  respondent_participant_id: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  overall_rating: number | null;
  organization_rating: number | null;
  content_rating: number | null;
  learned_something: string | null;
  would_recommend: boolean | null;
  nps_score: number | null;
  biggest_takeaway: string | null;
  what_worked: string | null;
  what_didnt_work: string | null;
  suggestions: string | null;
  answers: Record<string, unknown> | null;
  submitted_at: string;
};
