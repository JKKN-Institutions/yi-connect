// YIP 2026 — Reconciled Master Scoring Framework
// ────────────────────────────────────────────────────────────────────────────
// Single source of truth that merges TWO documents that were previously argued
// about as competitors:
//
//   • The Excel "Scoring Summary" (Swapnil) — the 7-row /100 FINAL weightages.
//     This is the OUTPUT layer: how a delegate's total is composed.
//   • The Word "Day 1 / Day 2 Evaluation Framework" — the rich per-session
//     jury criteria (party formation, speaker, question hour, …).
//     This is the INPUT layer: what the jury actually rates in each session.
//
// They are summary + detail of the same system, NOT alternatives. So we keep
// the FINAL score at exactly 7 buckets = /100 (the "keep it simple" camp), and
// let each scored SESSION carry its own criteria that the jury sees one session
// at a time (Maria's richer evaluation). Every session rolls UP into one of the
// 7 buckets — nothing adds a separate /100, so totals can never exceed 100.
//
// `liveSessionKey` ties a framework session to its row in yip.session_parameters
// so the admin tab can show live config beside the target spec and flag drift.
//
// NOTE: this module is the artifact to CONFIRM with the National team before the
// scoring engine is re-wired to read buckets. It is presentation-only today —
// changing it does not change any live score until that wiring lands.

export type EvaluationBasis =
  | "individual"
  | "committee"
  | "individual+committee"
  | "merit";

export interface FrameworkSession {
  /** Stable key; matches yip.session_parameters.session_key when a live row exists. */
  liveSessionKey: string | null;
  name: string;
  day: 1 | 2 | "pre-event";
  basis: EvaluationBasis;
  /** Jury criteria for THIS session (the dropdown the jury sees when it is live). */
  criteria: string[];
  note?: string;
}

export interface FrameworkBucket {
  /** The /100 component key. */
  key: string;
  label: string;
  /** Share of the /100 final score. The 7 weightages sum to 100. */
  weightage: number;
  /** One or more sessions whose marks roll up into this bucket. */
  sessions: FrameworkSession[];
  note?: string;
}

export const SCORING_FRAMEWORK: FrameworkBucket[] = [
  {
    key: "leadership_positions",
    label: "Leadership & Positions",
    weightage: 10,
    note:
      "Merit for securing a position (Speaker, Deputy, PM, LoP, Cabinet) is auto-awarded per role from Role bonuses (Scoring Rules) and capped at this bucket's weightage. The speaker/party-leadership sessions add the jury-scored portion.",
    sessions: [
      {
        liveSessionKey: "speaker_candidates_speeches",
        name: "Speaker Nomination & Candidate Speech",
        day: "pre-event",
        basis: "merit",
        criteria: [
          "Willingness to take responsibility",
          "Initiative shown",
          "Leadership potential",
          "Confidence",
          "Clarity of vision",
          "Understanding of parliamentary procedure",
          "Communication skills",
        ],
        note:
          "Speaker/Deputy chosen pre-event by video + vote. Elected officers receive additional merit points.",
      },
      {
        liveSessionKey: "speaker_election",
        name: "Speaker / Deputy Election",
        day: "pre-event",
        basis: "merit",
        criteria: ["Conduct & poise during election", "Leadership potential demonstrated"],
      },
      {
        liveSessionKey: null,
        name: "Government & Party Leadership Formation (PM, LoP, Cabinet, Party/Coalition leaders)",
        day: 1,
        basis: "merit",
        criteria: [
          "Leadership ability",
          "Team organisation",
          "Responsibility undertaken",
          "Participation in party formation",
          "Strategic planning",
        ],
      },
    ],
  },
  {
    key: "mupi_opening_speech",
    label: "Matters of Urgent Public Importance / Opening Speech",
    weightage: 15,
    note: "Both the Day 1 constituency speech and the Day 2 opening speech roll into this one bucket.",
    sessions: [
      {
        liveSessionKey: "urgent_public_importance",
        name: "Matters of Urgent Public Importance — 90-second Constituency Speech",
        day: 1,
        basis: "individual",
        criteria: [
          "Research & constituency understanding",
          "Content quality (facts, policy, recommendations)",
          "Communication & delivery (clarity, structure)",
          "Parliamentary conduct (decorum, poise)",
          "Originality (independent prep — not reading from notes)",
          "Time management (within 90 seconds)",
        ],
      },
      {
        liveSessionKey: "opening_speeches",
        name: "Opening Speech — Central Agenda",
        day: 2,
        basis: "individual",
        criteria: [
          "Content quality (relevance, policy understanding, coherence)",
          "Communication skills (clarity, confidence, voice modulation, persuasiveness)",
          "Parliamentary conduct (procedure, appropriate language)",
          "Research & preparation (subject knowledge, facts)",
          "Time management",
        ],
      },
    ],
  },
  {
    key: "question_hour",
    label: "Question Hour Participation & Relevance",
    weightage: 20,
    sessions: [
      {
        liveSessionKey: "question_hour",
        name: "Question Hour",
        day: 2,
        basis: "individual",
        note:
          "Two roles scored. Selected questioners receive additional merit. A delegate may participate multiple times — scores are averaged.",
        criteria: [
          "Questioner — Quality of question (relevance, clarity, policy significance)",
          "Questioner — Research (subject matter, data grounding)",
          "Questioner — Parliamentary procedure (through the Speaker, correct format)",
          "Questioner — Supplementary questions (follow-up, analytical thinking)",
          "Minister — Subject knowledge (portfolio familiarity)",
          "Minister — Quality of response (relevance, clarity, completeness)",
          "Minister — Handling supplementaries (think on feet, consistency)",
          "Minister — Parliamentary conduct (decorum, no confrontation)",
        ],
      },
    ],
  },
  {
    key: "zero_hour",
    label: "Zero Hour Participation & Understanding",
    weightage: 15,
    sessions: [
      {
        liveSessionKey: "zero_hour",
        name: "Zero Hour",
        day: 2,
        basis: "individual",
        note: "Spontaneous, scenario-based. Chapters may run it device-free to reward original thinking.",
        criteria: [
          "Critical thinking (analyse the situation, identify key issues)",
          "Problem solving (practical, policy-oriented solutions)",
          "Creativity (innovative ideas, unique perspectives)",
          "Responsiveness (under time pressure)",
          "Communication (clarity and structure of thought)",
        ],
      },
    ],
  },
  {
    key: "political_acumen",
    label: "Political Acumen & Legislative Strategy",
    weightage: 10,
    note:
      "Party formation (Day 1) and the central-agenda debate (Day 2) feed this bucket — parliamentary strategy, influence and negotiation (per National team mapping).",
    sessions: [
      {
        liveSessionKey: "cabinet_party_intros",
        name: "Party Formation & Presentation (Name / Symbol / Logo / Manifesto / Introduction)",
        day: 1,
        basis: "individual+committee",
        criteria: [
          "Creativity",
          "Relevance",
          "Ideological consistency",
          "Team participation",
          "Presentation quality",
        ],
      },
      {
        liveSessionKey: "debate_central_agenda",
        name: "Debate on Central Agenda",
        day: 2,
        basis: "individual",
        criteria: [
          "Relevance (staying focused on the agenda)",
          "Quality of arguments (logic, policy, evidence)",
          "Rebuttal skills (constructive response)",
          "Questioning ability (meaningful interventions)",
          "Parliamentary decorum",
          "Leadership in discussion (influencing debate positively)",
        ],
      },
    ],
  },
  {
    key: "committee_bill_drafting",
    label: "Committee Discussions & Bill Drafting",
    weightage: 15,
    note: "Day 1 committee work — scored both individually and at committee level.",
    sessions: [
      {
        liveSessionKey: "committee_bill_drafting",
        name: "Committee Discussion & Bill Drafting",
        day: 1,
        basis: "individual+committee",
        criteria: [
          "Individual — Initiative (participation, contribution, leadership in committee)",
          "Individual — Research contribution (subject knowledge, facts, recommendations)",
          "Individual — Bill drafting contribution (clauses, policy inputs)",
          "Individual — Problem solving (practicality, consensus building)",
          "Committee — Quality of bill draft (clarity, structure, policy relevance)",
          "Committee — Innovation (original, forward-looking solutions)",
          "Committee — Feasibility (implementation, governance viability)",
          "Committee — Team collaboration (inclusive participation)",
          "Committee — Committee presentation (final presentation & defence)",
        ],
      },
    ],
  },
  {
    key: "bill_presentation_defence",
    label: "Bill Presentation & Defence",
    weightage: 15,
    note: "Day 2 — the culmination of the committee process. Team and individual evaluation.",
    sessions: [
      {
        liveSessionKey: "bill_presentation_voting",
        name: "Bill Presentation & Voting",
        day: 2,
        basis: "individual+committee",
        criteria: [
          "Committee — Quality of bill (clarity, structure, legislative intent)",
          "Committee — Policy relevance (alignment with topic, national significance)",
          "Committee — Feasibility (implementation, administrative viability)",
          "Committee — Innovation (original recommendations)",
          "Committee — Team collaboration (collective contribution)",
          "Presentation — Presentation quality (clarity, confidence, structure)",
          "Presentation — Understanding of bill (provisions, legislative reasoning)",
          "Presentation — Communication (persuasiveness, professionalism)",
          "Defence — Response to cross-questions (accuracy, consistency)",
          "Defence — Defence of recommendations (justifying provisions)",
          "Defence — Adaptability (handling unexpected questions)",
          "Defence — Parliamentary conduct (decorum under scrutiny)",
        ],
      },
    ],
  },
];

export const FRAMEWORK_TOTAL = 100;

/** Sum of the 7 bucket weightages — should equal FRAMEWORK_TOTAL (100). */
export function frameworkWeightTotal(): number {
  return SCORING_FRAMEWORK.reduce((s, b) => s + b.weightage, 0);
}

/** All live session_keys referenced by the framework (for cross-checking against yip.session_parameters). */
export function frameworkLiveSessionKeys(): string[] {
  return SCORING_FRAMEWORK.flatMap((b) =>
    b.sessions.map((s) => s.liveSessionKey).filter((k): k is string => !!k)
  );
}
