export const EVENT_LEVELS = ["chapter", "regional", "national"] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];

export const EVENT_STATUSES = [
  "draft",
  "registration_open",
  "registration_closed",
  "day1_live",
  "day1_complete",
  "day2_live",
  "completed",
  "results_published",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const PARTY_SIDES = ["ruling", "opposition"] as const;
export type PartySide = (typeof PARTY_SIDES)[number];

// Aligned with YIP 2026 Handbook pages 16–18.
// Adds: deputy_prime_minister (page 16), independent_mp (page 18), party_leader (page 17).
// Adds (2026-06-24): coalition_leader + committee_chair — these already carried
// position bonuses (4 / 2) in yip.position_bonus_config but were absent from the
// parliament_role enum, so no participant could hold them. Now assignable so each
// can be given to a distinct student (Director: "1 person 1 role, more opportunity").
export const PARLIAMENT_ROLES = [
  "speaker",
  "nominated_speaker",
  "deputy_speaker",
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
  "cabinet_minister",
  "shadow_minister",
  "party_leader",
  "coalition_leader",
  "bill_committee",
  "committee_chair",
  "mp",
  "independent_mp",
] as const;

// "Ex-" roles — a single-seat leader deposed mid-event (no-confidence, impeach,
// or organiser depose). They keep their base role's leadership points, but are
// SYSTEM-ASSIGNED only: kept OUT of PARLIAMENT_ROLES so they never appear in the
// manual allocation / rubric dropdowns, while remaining part of the
// ParliamentRole type and the DB `parliament_role` enum.
export const EX_PARLIAMENT_ROLES = [
  "ex_prime_minister",
  "ex_deputy_prime_minister",
  "ex_leader_of_opposition",
  "ex_speaker",
  "ex_deputy_speaker",
] as const;

export type ParliamentRole =
  | (typeof PARLIAMENT_ROLES)[number]
  | (typeof EX_PARLIAMENT_ROLES)[number];

export const MINISTRIES = [
  { key: "home", label: "Home Affairs" },
  { key: "finance", label: "Finance & Planning" },
  { key: "education", label: "Education & Skill Development" },
  { key: "health", label: "Health & Family Welfare" },
  { key: "women_child", label: "Women & Child Development" },
  { key: "disaster_management", label: "Disaster Management" },
  { key: "youth_sports", label: "Youth & Sports" },
  { key: "it_digital", label: "IT & Digital Innovation" },
] as const;
export type Ministry = (typeof MINISTRIES)[number]["key"];

// The 15 official YIP committees (= the ministry committees). The canonical
// source is the DB catalog `yip.topics` (category='committee'); this constant
// is the offline fallback used by allocation/participants/yuva when an event
// has no committee_topics selection. Keep in sync with the catalog.
export const COMMITTEES = [
  "Ministry of Education",
  "Ministry of Finance",
  "Ministry of Youth Affairs & Sports",
  "Ministry of Health & Family Welfare",
  "Ministry of Electronics & IT",
  "Ministry of Environment",
  "Ministry of Agriculture",
  "Ministry of Road Transport",
  "Ministry of Housing & Urban Affairs",
  "Ministry of Skill Development",
  "Ministry of Women & Child Development",
  "Ministry of Labour & Employment",
  "Ministry of Tourism & Culture",
  "Ministry of Jal Shakti",
  "Ministry of MSME",
] as const;

export const ROLE_LABELS: Record<string, string> = {
  speaker: "Speaker",
  nominated_speaker: "Nominated for Speaker",
  deputy_speaker: "Deputy Speaker",
  prime_minister: "Prime Minister",
  deputy_prime_minister: "Deputy Prime Minister",
  leader_of_opposition: "Leader of Opposition",
  cabinet_minister: "Cabinet Minister",
  shadow_minister: "Shadow Minister",
  party_leader: "Party Leader",
  coalition_leader: "Coalition Leader",
  bill_committee: "Bill Committee Member",
  committee_chair: "Committee Chairperson",
  committee_drafter: "Committee Drafter",
  committee_presenter: "Committee Presenter",
  mp: "Member of Parliament",
  independent_mp: "Independent MP",
  ex_prime_minister: "Ex-Prime Minister",
  ex_deputy_prime_minister: "Ex-Deputy Prime Minister",
  ex_leader_of_opposition: "Ex-Leader of Opposition",
  ex_speaker: "Ex-Speaker",
  ex_deputy_speaker: "Ex-Deputy Speaker",
};

export const ROLE_COLORS: Record<string, string> = {
  speaker: "bg-amber-500 text-white",
  nominated_speaker: "bg-amber-200 text-amber-900",
  deputy_speaker: "bg-amber-400 text-white",
  prime_minister: "bg-blue-600 text-white",
  deputy_prime_minister: "bg-blue-500 text-white",
  leader_of_opposition: "bg-red-600 text-white",
  cabinet_minister: "bg-blue-500 text-white",
  shadow_minister: "bg-red-500 text-white",
  party_leader: "bg-indigo-600 text-white",
  coalition_leader: "bg-teal-600 text-white",
  bill_committee: "bg-purple-500 text-white",
  committee_chair: "bg-purple-700 text-white",
  committee_drafter: "bg-purple-600 text-white",
  committee_presenter: "bg-purple-400 text-white",
  mp: "bg-gray-500 text-white",
  independent_mp: "bg-emerald-600 text-white",
  // Ex- roles use a faded variant of their base color so they read as "former".
  ex_prime_minister: "bg-blue-200 text-blue-900",
  ex_deputy_prime_minister: "bg-blue-100 text-blue-900",
  ex_leader_of_opposition: "bg-red-200 text-red-900",
  ex_speaker: "bg-amber-200 text-amber-900",
  ex_deputy_speaker: "bg-amber-100 text-amber-900",
};

export const PARTY_COLORS = {
  ruling: { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700", badge: "bg-blue-600 text-white" },
  opposition: { bg: "bg-red-50", border: "border-red-500", text: "text-red-700", badge: "bg-red-600 text-white" },
} as const;

// Scoring rubrics — verbatim from YIP 2026 Handbook page 20.
// MP totals 110 points (A:30 + B:25 + C:30 + D:15 + E:10).
// The MP rubric carries 17 sub-criteria nested inside the 5 parent criteria —
// jurors score each sub-criterion independently; parent totals are derived.
// Speaker + Deputy Speaker rubrics stay flat (no sub_criteria) — the UI supports
// both shapes so legacy rubrics continue to work unchanged.
export const DEFAULT_RUBRICS = {
  speaker: {
    name: "Speaker Evaluation",
    criteria: [
      { key: "impartiality", label: "Impartiality", max_score: 30, description: "Fair treatment of all parties, neutral conduct" },
      { key: "leadership", label: "Leadership & Control", max_score: 25, description: "Maintaining order, commanding presence" },
      { key: "knowledge", label: "Knowledge of Rules", max_score: 20, description: "Understanding parliamentary procedures" },
      { key: "communication", label: "Clarity of Communication", max_score: 15, description: "Clear instructions, articulate speech" },
      { key: "time_management", label: "Time Management", max_score: 10, description: "Keeping sessions on schedule" },
    ],
  },
  deputy_speaker: {
    name: "Deputy Speaker Evaluation",
    criteria: [
      { key: "support", label: "Support to the Speaker", max_score: 30, description: "Assisting Speaker effectively" },
      { key: "impartiality", label: "Impartiality", max_score: 25, description: "Fair treatment when presiding" },
      { key: "leadership", label: "Leadership", max_score: 20, description: "Taking charge when needed" },
      { key: "communication", label: "Communication Skills", max_score: 15, description: "Clear and effective communication" },
      { key: "adaptability", label: "Adaptability", max_score: 10, description: "Adapting to changing situations" },
    ],
  },
  mp: {
    name: "MP Evaluation (Handbook 2026, /110)",
    criteria: [
      {
        key: "content",
        label: "A. Content and Substance",
        max_score: 30,
        description: "Relevance, originality, depth of research",
        sub_criteria: [
          { key: "content.relevance", label: "Relevance to topic", max_score: 10 },
          { key: "content.originality", label: "Originality and creativity", max_score: 10 },
          { key: "content.research", label: "Depth of Research", max_score: 10 },
        ],
      },
      {
        key: "communication",
        label: "B. Communication & Delivery",
        max_score: 25,
        description: "Clarity, confidence, fluency",
        sub_criteria: [
          { key: "communication.clarity", label: "Clarity and articulation", max_score: 10 },
          { key: "communication.confidence", label: "Confidence and poise", max_score: 10 },
          { key: "communication.fluency", label: "Fluency and Language", max_score: 5 },
        ],
      },
      {
        key: "conduct",
        label: "C. Parliamentary Conduct and Decorum",
        max_score: 30,
        description: "Respect for rules, engagement, respect for others",
        sub_criteria: [
          { key: "conduct.rules", label: "Respect for rules and procedures", max_score: 10 },
          { key: "conduct.engagement", label: "Engagement and responsibility", max_score: 10 },
          { key: "conduct.respect", label: "Respect for others", max_score: 10 },
        ],
      },
      {
        key: "argumentation",
        label: "D. Argumentation & Persuasion",
        max_score: 15,
        description: "Strength of arguments, emotional and logical appeal",
        sub_criteria: [
          { key: "argumentation.strength", label: "Strength of arguments", max_score: 10 },
          { key: "argumentation.emotional", label: "Emotional and logical appeal", max_score: 5 },
        ],
      },
      {
        key: "teamwork",
        label: "E. Teamwork & Collaboration",
        max_score: 10,
        description: "Coordination, active listening",
        sub_criteria: [
          { key: "teamwork.coordination", label: "Coordination with team members", max_score: 5 },
          { key: "teamwork.listening", label: "Active listening", max_score: 5 },
        ],
      },
    ],
  },
};

// Constitutional Oath — YIP 2026 Handbook page 44.
// Rendered on projector during oath_taking agenda items.
export const OATH_TEXT =
  '"I, <Name>, having been elected (or nominated) a member of the Council of States ' +
  "(or the House of the People) do solemnly and sincerely promise and declare that I will " +
  "bear true faith and allegiance to the Constitution of India as by law established and " +
  'that I will faithfully discharge the duty upon which I am about to enter."';

// Agenda mode — handbook page 19: Party mode for House proceedings,
// Committee mode for bill drafting. Mixed for neutral items (breaks, ceremonies).
export type AgendaMode = "party" | "committee" | "mixed";

/** Derive the correct mode from an agenda_type. */
export function modeForAgendaType(agendaType: string): AgendaMode {
  if (agendaType === "committee_discussion" || agendaType === "bill_drafting") {
    return "committee";
  }
  if (
    agendaType === "break" ||
    agendaType === "inaugural" ||
    agendaType === "valedictory" ||
    agendaType === "adjournment" ||
    agendaType === "registration"
  ) {
    return "mixed";
  }
  return "party";
}

// Default 2-day agenda template based on YIP 2026 Handbook pages 14–15.
// Day 2 closing renamed closing_ceremony → valedictory to match handbook terminology.
// Each item carries a mode so the projector + /me view can reorient seating context.
export const DEFAULT_AGENDA_TEMPLATE = {
  day1: [
    { sequence: 1, title: "Registration Opens", duration: 30, type: "registration", mode: "mixed" as AgendaMode },
    { sequence: 2, title: "Delegates Seated", duration: 10, type: "inaugural", mode: "mixed" as AgendaMode },
    { sequence: 3, title: "National Anthem", duration: 5, type: "inaugural", mode: "mixed" as AgendaMode },
    { sequence: 4, title: "Welcome Address", duration: 5, type: "inaugural", mode: "mixed" as AgendaMode },
    { sequence: 5, title: "About Young Indians", duration: 5, type: "inaugural", mode: "mixed" as AgendaMode },
    { sequence: 6, title: "Chief Guest Address", duration: 20, type: "inaugural", mode: "mixed" as AgendaMode },
    { sequence: 7, title: "Event Overview & Instructions", duration: 5, type: "inaugural", mode: "mixed" as AgendaMode },
    { sequence: 8, title: "Speaker Candidates' Speeches", duration: 10, type: "speaker_election", mode: "party" as AgendaMode },
    { sequence: 9, title: "Speaker Election", duration: 10, type: "speaker_election", mode: "party" as AgendaMode },
    { sequence: 10, title: "Government & Opposition Formation", duration: 10, type: "party_formation", mode: "party" as AgendaMode },
    { sequence: 11, title: "Seating of Speaker", duration: 5, type: "oath_taking", mode: "party" as AgendaMode },
    { sequence: 12, title: "Oath Taking Ceremony", duration: 5, type: "oath_taking", mode: "party" as AgendaMode },
    { sequence: 13, title: "Party Leader Selections", duration: 25, type: "cabinet_intro", mode: "party" as AgendaMode },
    { sequence: 14, title: "Break", duration: 15, type: "break", mode: "mixed" as AgendaMode },
    { sequence: 15, title: "Discussion on Matters of Urgent Public Importance (Part 1)", duration: 90, type: "opening_speech", mode: "party" as AgendaMode },
    { sequence: 16, title: "Lunch Break", duration: 45, type: "break", mode: "mixed" as AgendaMode },
    { sequence: 17, title: "Short Duration Discussion / Debate", duration: 60, type: "debate", mode: "party" as AgendaMode },
    { sequence: 18, title: "Committee Discussions (Bill Drafting)", duration: 60, type: "committee_discussion", mode: "committee" as AgendaMode },
    { sequence: 19, title: "Instructions for Day 2", duration: 15, type: "inaugural", mode: "mixed" as AgendaMode },
    { sequence: 20, title: "House Adjourned by Speaker", duration: 5, type: "adjournment", mode: "mixed" as AgendaMode },
  ],
  day2: [
    { sequence: 1, title: "Opening Speeches (Part 2)", duration: 60, type: "opening_speech", mode: "party" as AgendaMode },
    { sequence: 2, title: "Question Hour", duration: 60, type: "question_hour", mode: "party" as AgendaMode },
    { sequence: 3, title: "Zero Hour", duration: 60, type: "zero_hour", mode: "party" as AgendaMode },
    { sequence: 4, title: "Debate on Central Agenda", duration: 45, type: "debate", mode: "party" as AgendaMode },
    { sequence: 5, title: "Lunch Break", duration: 45, type: "break", mode: "mixed" as AgendaMode },
    { sequence: 6, title: "Bill Presentation & Voting", duration: 105, type: "bill_presentation", mode: "party" as AgendaMode },
    { sequence: 7, title: "Closing Statements & Adjournment", duration: 15, type: "valedictory", mode: "mixed" as AgendaMode },
    { sequence: 8, title: "Valedictory: Chief Guest Address", duration: 20, type: "valedictory", mode: "mixed" as AgendaMode },
    { sequence: 9, title: "Declaration of Awards", duration: 15, type: "valedictory", mode: "mixed" as AgendaMode },
    { sequence: 10, title: "Felicitation Ceremony", duration: 10, type: "valedictory", mode: "mixed" as AgendaMode },
    { sequence: 11, title: "National Anthem", duration: 5, type: "valedictory", mode: "mixed" as AgendaMode },
  ],
};

/** Human labels for the 3 agenda modes — used in badges on projector + /me. */
export const AGENDA_MODE_LABELS: Record<AgendaMode, string> = {
  party: "Party Mode — seated by bench (Ruling / Opposition)",
  committee: "Committee Mode — seated by committee for bill drafting",
  mixed: "",
};

export const AGENDA_MODE_SHORT: Record<AgendaMode, string> = {
  party: "Party Mode",
  committee: "Committee Mode",
  mixed: "",
};

// 15 awards from YIP 2026 Handbook page 21.
// Each award has a deterministic derivation rule used by computeResults().
// "subjective" awards use jury proxies (highest sub-criterion average) and may be overridden manually.
export const HANDBOOK_AWARDS = [
  { key: "best_parliamentarian", label: "Best Parliamentarian", source: "overall_top" },
  { key: "best_speaker", label: "Best Speaker", source: "role:speaker" },
  { key: "leadership_excellence", label: "Leadership Excellence", source: "leadership_top" },
  { key: "best_member_ruling", label: "Best Member — Ruling Bench", source: "ruling_mp_top" },
  { key: "best_member_opposition", label: "Best Member — Opposition Bench", source: "opposition_mp_top" },
  { key: "best_debater", label: "Best Debater", source: "criterion:argumentation" },
  { key: "most_persuasive_policy_advocate", label: "Most Persuasive Policy Advocate", source: "criterion:content+argumentation" },
  { key: "best_research_presentation", label: "Best Research & Presentation", source: "criterion:content" },
  { key: "innovative_ideas", label: "Innovative Ideas", source: "criterion:content" },
  { key: "community_impact", label: "Community Impact", source: "constituency_top" },
  { key: "mvp", label: "Most Valuable Participant (MVP)", source: "consistency_top" },
  { key: "team_spirit", label: "Team Spirit", source: "criterion:teamwork" },
  { key: "exemplary_decorum", label: "Exemplary Parliamentary Decorum", source: "criterion:conduct" },
  { key: "independent_voice", label: "Independent Voice of the House", source: "role:independent_mp" },
  { key: "best_constituency_rep", label: "Best Constituency Representative", source: "constituency_mp_top" },
] as const;
export type HandbookAwardKey = (typeof HANDBOOK_AWARDS)[number]["key"];
