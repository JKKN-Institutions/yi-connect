/**
 * YIP Selection Questionnaire — the pure module.
 *
 * Everything here is synchronous: the post catalogue, the rubric, the scoring
 * arithmetic, validation and CSV assembly. It lives in lib/ rather than beside
 * the server actions because **a `"use server"` file may export ONLY async
 * functions** — a non-async export from an actions file breaks the Vercel build.
 * Same split as lib/yip/self-nomination.ts and lib/yip/formation.ts.
 *
 * WHAT THIS IS FOR. A student who self-nominates for Administrator, Speaker or
 * Party Leader answers a short set of scenario questions drawn from that post's
 * bank, inside a 30-minute window. An LLM scores each answer against the rubric
 * below and the organiser gets a ranked list — but the ranking only ADVISES; a
 * human confirms the shortlist (Director, 2026-08-15).
 *
 * The student NEVER sees a score. Not their own, not anyone's.
 */

import { toCsv } from "@/lib/yip/attendance-csv";

// ─── Posts ───────────────────────────────────────────────────────
//
// These keys are the SAME values as SELF_NOMINATION_ROLE_KEYS and the
// yip.parliament_role enum, so a questionnaire result needs no translation
// table to line up with a nomination or an eventual role assignment.

export const QUESTIONNAIRE_POST_KEYS = [
  "parliamentary_administrator",
  "speaker",
  "party_leader",
  "parliamentary_journalist",
  "prime_minister",
  "leader_of_opposition",
] as const;

export type QuestionnairePostKey = (typeof QUESTIONNAIRE_POST_KEYS)[number];

export type QuestionnairePostDef = {
  key: QuestionnairePostKey;
  label: string;
  /** How many of that post's bank a single candidate is asked. */
  questionsPerAttempt: number;
  /**
   * Length of that post's window, in minutes. Per-post since 2026-08-21: the
   * three original posts stay on the Director's flat 30, but Student
   * Journalist is a single long-form news report and was set to 60.
   */
  attemptMinutes: number;
};

/**
 * Draw sizes come from the reference build's QUESTIONS_PER_ATTEMPT. Each post
 * has a bank of 20; a candidate sees a random subset in random order, reshuffled
 * per candidate, so two candidates rarely get the same paper.
 */
export const QUESTIONNAIRE_POSTS: readonly QuestionnairePostDef[] = [
  { key: "parliamentary_administrator", label: "Administrator", questionsPerAttempt: 10, attemptMinutes: 30 },
  { key: "speaker", label: "Speaker", questionsPerAttempt: 6, attemptMinutes: 30 },
  { key: "party_leader", label: "Party Leader", questionsPerAttempt: 6, attemptMinutes: 30 },
  // Student Journalist is not a question paper: the bank holds ONE prompt (the
  // report brief) and the candidate writes a single news report against it, so
  // the draw is 1 and the window is 60 minutes (Director, 2026-08-21).
  { key: "parliamentary_journalist", label: "Student Journalist", questionsPerAttempt: 1, attemptMinutes: 60 },
  // Later-stage posts (after Government Formation). Banks of 20 each, drawn 6,
  // on the standard 30-minute window (Director, 2026-08-21). The source PDF's
  // header says "all 20 / max 200"; the Director's 6-of-20 ruling supersedes it.
  { key: "prime_minister", label: "Prime Minister", questionsPerAttempt: 6, attemptMinutes: 30 },
  { key: "leader_of_opposition", label: "Leader of Opposition", questionsPerAttempt: 6, attemptMinutes: 30 },
] as const;

const POST_BY_KEY = new Map<string, QuestionnairePostDef>(
  QUESTIONNAIRE_POSTS.map((p) => [p.key, p])
);

export function isQuestionnairePostKey(v: unknown): v is QuestionnairePostKey {
  return typeof v === "string" && POST_BY_KEY.has(v);
}

export function questionnairePostDef(key: string): QuestionnairePostDef | null {
  return POST_BY_KEY.get(key) ?? null;
}

export function questionnairePostLabel(key: string): string {
  return POST_BY_KEY.get(key)?.label ?? key;
}

export function questionsPerAttempt(key: string): number {
  return POST_BY_KEY.get(key)?.questionsPerAttempt ?? 0;
}

/**
 * Window length for a post, in minutes. Unknown keys fall back to the original
 * flat ATTEMPT_MINUTES so a bad key can never hand out an unbounded window.
 */
export function attemptMinutesFor(key: string): number {
  return POST_BY_KEY.get(key)?.attemptMinutes ?? ATTEMPT_MINUTES;
}

/**
 * A flat 30 minutes for every post — Director's choice on 2026-08-15, taken
 * over scaling the clock to the question count. Note the consequence: an
 * Administrator candidate has 3 minutes per question where Speaker and Party
 * Leader candidates have 5.
 */
export const ATTEMPT_MINUTES = 30;

// ─── Status vocabularies ─────────────────────────────────────────

export const WINDOW_STATUSES = ["pending", "open", "closed"] as const;
export type WindowStatus = (typeof WINDOW_STATUSES)[number];

export const SCORING_STATUSES = ["pending", "scoring", "scored", "failed"] as const;
export type ScoringStatus = (typeof SCORING_STATUSES)[number];

export function isWindowStatus(v: unknown): v is WindowStatus {
  return typeof v === "string" && (WINDOW_STATUSES as readonly string[]).includes(v);
}

// ─── The rubric ──────────────────────────────────────────────────
//
// Reproduced from "YiP 2026 – Regional Round Selection Questionnaires"
// (AI Scoring & Selection Criteria). The reference build's instruction is that
// this text is handed to the model VERBATIM as its system instructions, so edit
// it only against the source document — not to make a prompt read better.

export type RubricCriterion = {
  key: "grounding" | "depth" | "voice";
  label: string;
  max: number;
  instruction: string;
};

export const RUBRIC_CRITERIA: readonly RubricCriterion[] = [
  {
    key: "grounding",
    label: "Event-specific grounding",
    max: 3,
    instruction:
      "0 if generic/could apply anywhere. 3 only for a correct, specific YiP Regional Round detail. 1–2 for partial/slightly incorrect use.",
  },
  {
    key: "depth",
    label: "Depth & originality of reasoning",
    max: 4,
    instruction:
      '0–1 for filler or an unresolved "it depends." 2–3 for a real position with reasoning. 4 only for a clear, specific, defended stance with a concrete example (and an actual pick on forced-choice questions).',
  },
  {
    key: "voice",
    label: "Role-appropriate voice & clarity",
    max: 3,
    instruction:
      "3 if it reads like something this person would actually say out loud (first person, decisive, on-topic). Deduct for third-person essay style, drift, or restating the question.",
  },
] as const;

export const RED_FLAGS: readonly string[] = [
  "Perfectly balanced/neutral tone with no personal stance, even when forced to choose",
  "No correct YiP-specific detail anywhere, despite the question asking for one",
  "Unnaturally uniform structure/length across this candidate's answers",
  "Third-person, textbook-formal language instead of first-person, in-character voice",
  "Vocabulary/polish inconsistent with how a student this age typically writes",
] as const;

/** Rubric points available per answer before any deduction: 3 + 4 + 3. */
export const MAX_PER_ANSWER = RUBRIC_CRITERIA.reduce((sum, c) => sum + c.max, 0);

/**
 * The red-flag deduction is stored and transported as a POSITIVE 0–3 and
 * subtracted at aggregation.
 *
 * Why: lib/yip/rubric.ts's validateScoresAgainstRubric rejects every negative
 * value ("must be a non-negative number"), and there is no deduction concept
 * anywhere in the jury scoring model. Keeping the penalty positive means this
 * rubric never has to fork that validator — and the two engines stay unentangled,
 * which matters because the jury one is keyed to ParliamentRole and per-session
 * weights that have nothing to do with selection.
 */
export const MAX_RED_FLAG_PENALTY = 3;

/** Handed to the scoring model as its system instructions, verbatim. */
export const RUBRIC_SYSTEM_INSTRUCTIONS = [
  "Score each answer against this rubric.",
  "",
  ...RUBRIC_CRITERIA.map((c) => `${c.label} (0–${c.max}): ${c.instruction}`),
  "",
  `Red-flag deduction: subtract up to ${MAX_RED_FLAG_PENALTY} points from that answer if it shows two or more of:`,
  ...RED_FLAGS.map((f) => `- ${f}`),
  "",
  `Per-question score = ${MAX_PER_ANSWER}-point rubric total, minus ${MAX_RED_FLAG_PENALTY} if 2+ flags apply, floored at 0.`,
].join("\n");

// ─── Scoring arithmetic ──────────────────────────────────────────

export type AnswerScoreParts = {
  grounding: number | null;
  depth: number | null;
  voice: number | null;
  redFlagPenalty: number | null;
};

/** One answer's final score: rubric total minus the penalty, floored at 0. */
export function answerScore(parts: AnswerScoreParts): number {
  const g = clampInt(parts.grounding, 0, 3);
  const d = clampInt(parts.depth, 0, 4);
  const v = clampInt(parts.voice, 0, 3);
  const p = clampInt(parts.redFlagPenalty, 0, MAX_RED_FLAG_PENALTY);
  return Math.max(0, g + d + v - p);
}

function clampInt(v: number | null | undefined, lo: number, hi: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

export type AttemptTotals = { total: number; max: number; pct: number };

/**
 * An attempt's totals. `max` is the number of questions DRAWN times the
 * per-answer maximum — not the bank size — so a candidate is never penalised
 * for the draw being short, and percentages stay comparable across posts even
 * though Administrator answers 10 questions and the others 6.
 */
export function attemptTotals(scores: readonly number[]): AttemptTotals {
  const total = scores.reduce((s, n) => s + n, 0);
  const max = scores.length * MAX_PER_ANSWER;
  const pct = max > 0 ? Math.round((total / max) * 10000) / 100 : 0;
  return { total, max, pct };
}

/**
 * Shortlist size, from the source document: top 10 if 15 or more candidates
 * were scored for that post, otherwise top 5.
 *
 * This is a MARKER on a ranked list, never an action. A human confirms the
 * shortlist (Director, 2026-08-15) — nothing in this codebase may promote,
 * assign a role, or drop a candidate on the strength of it.
 */
export function shortlistCutoff(scoredCandidates: number): number {
  return scoredCandidates >= 15 ? 10 : 5;
}

// ─── The draw ────────────────────────────────────────────────────

/**
 * Fisher–Yates over a copy. Used once, server-side, when a student presses
 * Start; the drawn questions are then written as answer rows so a reload or a
 * dropped connection returns exactly the same paper.
 */
export function drawQuestions<T>(bank: readonly T[], count: number): T[] {
  const pool = [...bank];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

// ─── Answer input ────────────────────────────────────────────────

/** Generous but bounded — a 30-minute handwritten-length answer, not an essay dump. */
export const MAX_ANSWER_CHARS = 4000;

export function normalizeAnswerText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n").trim().slice(0, MAX_ANSWER_CHARS);
}

export function wordCount(v: string): number {
  const t = v.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

// ─── Row shapes ──────────────────────────────────────────────────

export type QuestionnaireQuestion = {
  id: string;
  event_id: string | null;
  post_key: QuestionnairePostKey;
  body: string;
  display_order: number;
  is_active: boolean;
};

export type QuestionnaireWindow = {
  id: string;
  event_id: string;
  post_key: QuestionnairePostKey;
  status: WindowStatus;
  opened_at: string | null;
  closed_at: string | null;
};

export type QuestionnaireAnswer = {
  id: string;
  attempt_id: string;
  question_id: string | null;
  question_text: string;
  position: number;
  answer_text: string | null;
  answered_at: string | null;
  grounding: number | null;
  depth: number | null;
  voice: number | null;
  red_flag_penalty: number | null;
  score: number | null;
  flags: string[];
  scored_at: string | null;
};

export type QuestionnaireAttempt = {
  id: string;
  event_id: string;
  participant_id: string;
  post_key: QuestionnairePostKey;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  scoring_status: ScoringStatus;
  total_score: number | null;
  max_score: number | null;
  pct: number | null;
  scored_at: string | null;
  score_error: string | null;
};

/** One row of the organiser's ranked list. */
export type QuestionnaireResultRow = {
  attemptId: string;
  participantId: string;
  fullName: string;
  constituencyNumber: number | null;
  postKey: QuestionnairePostKey;
  submittedAt: string | null;
  scoringStatus: ScoringStatus;
  pct: number | null;
  totalScore: number | null;
  maxScore: number | null;
  redFlagCount: number;
  answered: number;
  drawn: number;
};

/**
 * A student who nominated for a post and has no answers to show for it.
 *
 * The ranking only ever contained students who handed something in, so a
 * nominee who never opened the paper was simply absent — an organiser could not
 * tell "nobody is missing" from "eight people are missing" (Director,
 * 2026-08-15). `startedButBlank` separates the two cases worth acting on: a
 * student who never opened it may just need telling, while one who opened it
 * and wrote nothing may have hit a problem.
 */
export type QuestionnaireMissingRow = {
  participantId: string;
  fullName: string;
  constituencyNumber: number | null;
  postKey: QuestionnairePostKey;
  startedButBlank: boolean;
};

export type QuestionnaireActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Deadline ────────────────────────────────────────────────────

/**
 * The authoritative check. `expires_at` is set once, server-side, when the
 * attempt starts; the client countdown is display only and is never trusted.
 */
export function attemptExpired(
  attempt: Pick<QuestionnaireAttempt, "expires_at">,
  now: Date = new Date()
): boolean {
  const t = Date.parse(attempt.expires_at);
  if (Number.isNaN(t)) return false;
  return now.getTime() > t;
}

export function expiryFor(
  startedAt: Date = new Date(),
  postKey?: string
): string {
  const minutes = postKey ? attemptMinutesFor(postKey) : ATTEMPT_MINUTES;
  return new Date(startedAt.getTime() + minutes * 60_000).toISOString();
}

// ─── Display ─────────────────────────────────────────────────────

/** IST, because every YIP event runs in India. */
export function formatQuestionnaireTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
}

// ─── CSV ─────────────────────────────────────────────────────────

/**
 * One row per QUESTION, not per candidate — the shape you want if the file is
 * going into a spreadsheet or another model for analysis.
 *
 * Carries the student's NAME (Director, 2026-08-15, having been shown the
 * alternative). Note this is a deliberately different posture from the in-app
 * scorer, which is sent answers with no name and no id attached because these
 * are minors — so this file identifies children by name alongside their written
 * work, and wherever it is uploaded, it goes with them. Organiser-gated for
 * that reason.
 *
 * Every drawn question appears even when the answer is blank: "they skipped
 * question 4" is a finding, and a file that silently omits it reads as a
 * shorter paper rather than an unfinished one.
 */
export type QuestionnaireResponseRow = {
  postKey: QuestionnairePostKey;
  fullName: string;
  constituencyNumber: number | null;
  submittedAt: string | null;
  position: number;
  question: string;
  answer: string;
  score: number | null;
  grounding: number | null;
  depth: number | null;
  voice: number | null;
  redFlagPenalty: number | null;
  flags: readonly string[];
};

export const QUESTIONNAIRE_RESPONSES_CSV_HEADERS = [
  "Post",
  "Const. No.",
  "Student",
  "Submitted (IST)",
  "Q No.",
  "Question",
  "Answer",
  "Words",
  "Score",
  "Grounding",
  "Depth",
  "Voice",
  "Penalty",
  "Flags",
];

export function buildQuestionnaireResponsesCsv(
  rows: readonly QuestionnaireResponseRow[]
): string {
  const body = rows.map((r) => [
    questionnairePostLabel(r.postKey),
    r.constituencyNumber ?? "",
    r.fullName,
    formatQuestionnaireTime(r.submittedAt),
    r.position,
    r.question,
    r.answer,
    r.answer.trim() === "" ? 0 : wordCount(r.answer),
    r.score ?? "",
    r.grounding ?? "",
    r.depth ?? "",
    r.voice ?? "",
    r.redFlagPenalty ?? "",
    r.flags.join("; "),
  ]);
  return toCsv(QUESTIONNAIRE_RESPONSES_CSV_HEADERS, body);
}

export const QUESTIONNAIRE_CSV_HEADERS = [
  "Rank",
  "Const. No.",
  "Student",
  "Post",
  "Submitted (IST)",
  "Scoring",
  "Score",
  "Out of",
  "Percent",
  "Red flags",
  "Answered",
  "Questions",
  "Shortlist marker",
];

export function buildQuestionnaireCsv(rows: readonly QuestionnaireResultRow[]): string {
  // Rank and the shortlist marker are computed per post over SCORED rows only,
  // so an unscored attempt never silently occupies a shortlist place.
  const scoredByPost = new Map<string, number>();
  for (const r of rows) {
    if (r.scoringStatus === "scored") {
      scoredByPost.set(r.postKey, (scoredByPost.get(r.postKey) ?? 0) + 1);
    }
  }
  const seen = new Map<string, number>();

  const body = rows.map((r) => {
    let rank: number | "" = "";
    let marker = "";
    if (r.scoringStatus === "scored") {
      const n = (seen.get(r.postKey) ?? 0) + 1;
      seen.set(r.postKey, n);
      rank = n;
      marker = n <= shortlistCutoff(scoredByPost.get(r.postKey) ?? 0) ? "Shortlist" : "";
    }
    return [
      rank,
      r.constituencyNumber ?? "",
      r.fullName,
      questionnairePostLabel(r.postKey),
      formatQuestionnaireTime(r.submittedAt),
      r.scoringStatus,
      r.totalScore ?? "",
      r.maxScore ?? "",
      r.pct ?? "",
      r.redFlagCount,
      r.answered,
      r.drawn,
      marker,
    ];
  });

  return toCsv(QUESTIONNAIRE_CSV_HEADERS, body);
}
