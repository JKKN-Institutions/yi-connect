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
  "cabinet_minister",
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
  // ONE post serves both benches: the portfolio questions are identical whether
  // you are shadowing Finance or running it, so a Shadow Minister nominee sits
  // the same paper. The bench only decides the LABEL on their nomination.
  // 6 questions from each of the candidate's two portfolios = 12, in 60
  // minutes (Director, 2026-08-21). questionsPerAttempt is the TOTAL; the
  // per-portfolio split is CABINET_QUESTIONS_PER_MINISTRY.
  { key: "cabinet_minister", label: "Cabinet / Shadow Minister", questionsPerAttempt: 12, attemptMinutes: 60 },
] as const;

/** Questions drawn from EACH of a Cabinet candidate's two portfolios. */
export const CABINET_QUESTIONS_PER_MINISTRY = 6;

// ─── Handing in a FILE instead of typing ─────────────────────────
//
// WHY: the Student Journalist paper is one 300–500 word news report inside a
// 60-minute window. On 2026-08-22, 32 candidates submitted and only 5 had typed
// anything — 27 handed in blank. Typing a full report on a phone is the obvious
// suspect, so a candidate may hand in a document, or a PHOTO of a handwritten
// report, as well as or instead of typing.

/**
 * Posts whose answer screen offers the file control.
 *
 * Only the journalist report today. The COLUMN and the server actions are
 * general — an answer anywhere counts as given if it has text OR a file — but
 * no other paper's screen changes.
 */
export const QUESTIONNAIRE_UPLOAD_POST_KEYS: readonly QuestionnairePostKey[] = [
  "parliamentary_journalist",
] as const;

export function questionnaireAllowsFileUpload(key: string): boolean {
  return (QUESTIONNAIRE_UPLOAD_POST_KEYS as readonly string[]).includes(key);
}

/**
 * EXACTLY the `yip-questionnaire-uploads` bucket's allowed_mime_types, mapped
 * to the extension the stored object gets.
 *
 * The extension is derived from the VALIDATED mime and never from the
 * user-supplied filename — a filename is attacker-controlled text and has no
 * business deciding a storage path. The original name survives only as display
 * text inside the jsonb.
 */
export const QUESTIONNAIRE_UPLOAD_MIME_EXT: ReadonlyMap<string, string> = new Map([
  ["application/pdf", "pdf"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["text/plain", "txt"],
]);

/** The bucket's own file_size_limit. Enforced here too — never trust the client. */
export const QUESTIONNAIRE_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** A photographed report is a page or two, not an album. */
export const QUESTIONNAIRE_MAX_FILES_PER_ANSWER = 3;

/** Signed-URL lifetime for an organiser opening a handed-in file. */
export const QUESTIONNAIRE_FILE_URL_SECONDS = 300;

/** `accept` for the file input — the same list, in the form a browser wants. */
export const QUESTIONNAIRE_UPLOAD_ACCEPT = [...QUESTIONNAIRE_UPLOAD_MIME_EXT.keys()].join(",");

/** One handed-in file, as stored in `yip.questionnaire_answers.files`. */
export type QuestionnaireAnswerFile = {
  /** Object path inside the PRIVATE yip-questionnaire-uploads bucket. */
  path: string;
  /** The candidate's own filename — display text only. */
  name: string;
  size: number;
  mime: string;
  uploaded_at: string;
};

/**
 * Read the `files` jsonb defensively.
 *
 * The column is `jsonb NOT NULL DEFAULT '[]'`, but every row written before the
 * migration and anything hand-edited could be shaped differently, and this
 * value decides whether a candidate's paper counts as blank. Anything that is
 * not a well-formed entry is dropped rather than rendered.
 */
export function parseAnswerFiles(v: unknown): QuestionnaireAnswerFile[] {
  if (!Array.isArray(v)) return [];
  const out: QuestionnaireAnswerFile[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.path !== "string" || f.path === "") continue;
    out.push({
      path: f.path,
      name: typeof f.name === "string" && f.name !== "" ? f.name : "Attachment",
      size: typeof f.size === "number" && Number.isFinite(f.size) ? f.size : 0,
      mime: typeof f.mime === "string" ? f.mime : "application/octet-stream",
      uploaded_at: typeof f.uploaded_at === "string" ? f.uploaded_at : "",
    });
  }
  return out;
}

/**
 * THE definition of "this answer was given".
 *
 * Typed text OR at least one handed-in file. Every count of answered/blank —
 * the student's progress line, the ranking, the missing list, both CSVs —
 * routes through this so a file-only submission can never be reported as blank
 * in one place while counting in another.
 */
export function answerIsGiven(
  answerText: string | null | undefined,
  files: unknown
): boolean {
  if ((answerText ?? "").trim() !== "") return true;
  return parseAnswerFiles(files).length > 0;
}

/** "1.4 MB" — for a 15-year-old checking the right page uploaded. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const POST_BY_KEY = new Map<string, QuestionnairePostDef>(
  QUESTIONNAIRE_POSTS.map((p) => [p.key, p])
);

export function isQuestionnairePostKey(v: unknown): v is QuestionnairePostKey {
  return typeof v === "string" && POST_BY_KEY.has(v);
}

/**
 * Nomination roles that are not themselves a post, and the post they sit.
 *
 * `shadow_minister` is the only one: QUESTIONNAIRE_POSTS above states that one
 * post serves both benches, because the portfolio questions are identical
 * whether you shadow Finance or run it. But the role is not a post key, so
 * filtering roles through `isQuestionnairePostKey` silently drops it — and on
 * 2026-08-23 that left all 49 Shadow Minister nominees of the SRTN round with
 * no paper at all, each having already chosen their two portfolios.
 */
const ROLE_TO_POST: Readonly<Record<string, QuestionnairePostKey>> = {
  shadow_minister: "cabinet_minister",
};

/** The post a nomination role sits, or null if the role has no paper. */
export function postKeyForRole(role: unknown): QuestionnairePostKey | null {
  if (typeof role !== "string") return null;
  const mapped = ROLE_TO_POST[role];
  if (mapped) return mapped;
  return isQuestionnairePostKey(role) ? role : null;
}

/**
 * Every paper a set of nominated roles entitles someone to sit, de-duplicated.
 * Use this anywhere roles are matched to posts — never `filter(isQuestionnairePostKey)`,
 * which drops the roles that share another post's paper.
 */
export function nominatedPostKeys(
  roles: readonly unknown[] | null | undefined
): QuestionnairePostKey[] {
  const out = new Set<QuestionnairePostKey>();
  for (const r of roles ?? []) {
    const k = postKeyForRole(r);
    if (k) out.add(k);
  }
  return [...out];
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

/**
 * `needs_human` is a resting state, not an error. The external scorer is sent
 * answer TEXT only and cannot read an uploaded file — least of all a photograph
 * of handwriting. A paper handed in as a file therefore stops here, complete,
 * waiting for a person to open the pages and enter marks. It must never be
 * re-queued to the scorer: doing so marks real work as blank.
 */
export const SCORING_STATUSES = [
  "pending",
  "scoring",
  "scored",
  "failed",
  "needs_human",
] as const;
export type ScoringStatus = (typeof SCORING_STATUSES)[number];

export function isWindowStatus(v: unknown): v is WindowStatus {
  return typeof v === "string" && (WINDOW_STATUSES as readonly string[]).includes(v);
}

// ─── Is the marking still moving? ────────────────────────────────
//
// Marking happens outside this app: papers are queued here and drained by the
// external routine (see docs/yip-ai-routine.md). Nothing in the database times
// a claim out — claimScoringWork flips an attempt to 'scoring' BEFORE the
// routine reads it, so if the routine dies mid-batch those papers sit in
// 'scoring' for ever and no scheduled run ever picks them up again.
//
// That is not hypothetical. On 16 Aug 2026 papers sat claimed for fifteen hours
// and it was noticed by chance. The organiser's screen showed a count that had
// simply stopped rising, which looks exactly like "still working".
//
// So the counts below are paired with two independent stall tests, and an
// organiser is told in words what has gone wrong. Deliberately NO estimate of
// when marking will finish: the papers queue behind work this app cannot see,
// and a guess printed as a time is a guess an organiser will plan around.

/** How long a stalled queue is tolerated before the screen says so. */
export const MARKING_STALL_MINUTES = 30;

/**
 * Live state of the marking queue for one event.
 *
 * The elapsed figures are computed SERVER-side and shipped as minutes rather
 * than being derived from `lastMovedAt` on the client, so a phone with a wrong
 * clock cannot invent — or hide — a stall.
 */
export type QuestionnaireMarkingProgress = {
  /** Papers handed in. The denominator of "N of M marked". */
  submitted: number;
  pending: number;
  scoring: number;
  scored: number;
  failed: number;
  /** Most recent change to any attempt of this event, or null if none yet. */
  lastMovedAt: string | null;
  /** Minutes since `lastMovedAt`, server-measured. Null when nothing has moved. */
  stalledMinutes: number | null;
  /** Papers claimed for marking that have not moved for MARKING_STALL_MINUTES+. */
  stuckScoring: number;
  /** Minutes since the LONGEST-stuck claimed paper last moved. */
  oldestStuckMinutes: number | null;
  checkedAt: string;
};

/** "45 minutes" / "3 hours" — the way an organiser would say it out loud. */
export function describeMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * What to tell the organiser, in plain English, or nothing at all.
 *
 * Two separate tests, because they fail differently:
 *   1. Papers claimed and abandoned — the routine took them and died. Nothing
 *      requeues these, so this is the one that needs a human.
 *   2. A queue that has simply stopped draining.
 *
 * Both are gated on there being unfinished work. A finished event whose last
 * paper was marked yesterday is not stalled, it is done, and saying otherwise
 * would train organisers to ignore the banner.
 */
export function markingStallWarnings(p: QuestionnaireMarkingProgress): string[] {
  const out: string[] = [];

  if (p.stuckScoring > 0 && p.oldestStuckMinutes != null) {
    out.push(
      `${p.stuckScoring} paper${p.stuckScoring === 1 ? " has" : "s have"} been stuck being marked for ${describeMinutes(
        p.oldestStuckMinutes
      )} — the marking service may have stopped. Clearing that post's marks puts them back in the queue.`
    );
  }

  const waiting = p.pending + p.scoring;
  if (
    waiting > 0 &&
    p.stalledMinutes != null &&
    p.stalledMinutes >= MARKING_STALL_MINUTES &&
    p.stuckScoring === 0
  ) {
    out.push(
      `Nothing has been marked for ${describeMinutes(p.stalledMinutes)} and ${waiting} paper${
        waiting === 1 ? " is" : "s are"
      } still waiting — the marking service may have stopped.`
    );
  }

  return out;
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
/**
 * The Cabinet paper: a separate draw per portfolio, concatenated in the
 * candidate's own portfolio order.
 *
 * Deliberately NOT one draw over the merged bank — that would let luck hand a
 * candidate ten Finance questions and two Health ones, and they are being
 * judged on both. Each portfolio contributes exactly `perMinistry`, so the
 * paper is balanced however the shuffle falls.
 *
 * A portfolio with no questions contributes nothing rather than throwing: the
 * caller reports the short paper, which is a far better failure than a student
 * facing a blank screen mid-window.
 */
export function drawCabinetPaper<T extends { ministry: string | null }>(
  bank: readonly T[],
  ministries: readonly string[],
  perMinistry: number = CABINET_QUESTIONS_PER_MINISTRY
): T[] {
  const paper: T[] = [];
  for (const ministry of ministries) {
    const want = ministryMatchKey(ministry);
    const sub = bank.filter((q) => ministryMatchKey(q.ministry) === want);
    paper.push(...drawQuestions(sub, perMinistry));
  }
  return paper;
}

/**
 * The comparison key for a portfolio name.
 *
 * A question's `ministry` and a candidate's nominated portfolio are two
 * independently-typed strings, so they drift. On 2026-08-22 the SRTN round's
 * bank held "Education" while every candidate held "Ministry of Education";
 * an exact `===` matched nothing, so all 77 candidates drew an empty paper and
 * the window was closed 41 seconds after it opened. Comparing on a normalised
 * key survives that class of drift: the leading "Ministry of", case, and
 * whitespace stop mattering.
 *
 * It deliberately does NOT try to equate genuinely different portfolios —
 * "Skill Development" and "Skill Development & Entrepreneurship" stay distinct,
 * because treating them as one would hand a candidate a paper for a portfolio
 * they did not nominate for. That case is caught before the window opens, by
 * the coverage check in `setQuestionnaireWindow`.
 */
export function ministryMatchKey(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^\s*ministry\s+of\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
  /** Files handed in for this answer. An answer counts as given if it has text OR one of these. */
  files: QuestionnaireAnswerFile[];
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
  /**
   * Files handed in across this paper. Shown so an organiser reading a low
   * word count does not conclude the candidate wrote nothing — the report may
   * be a photographed page rather than typed text.
   */
  fileCount: number;
  /**
   * Which bench this candidate sits on, or null if they hold no side.
   *
   * Load-bearing for the Cabinet paper. ONE post serves both benches, so a
   * single `cabinet_minister` list mixes people competing for entirely
   * different seats — 12 Cabinet places across the ruling parties and 12
   * Shadow places across the opposition. Ranked together, the top of the list
   * is not a shortlist for either contest: on the SRTN round that was 70
   * ruling and 46 opposition papers in one league table. Rank WITHIN a bench,
   * and label every row so nobody reads across the two.
   */
  bench: "ruling" | "opposition" | null;
};

/**
 * The contest a paper belongs to — the post, split by bench where one post
 * serves both. Use this as the ranking key, never `postKey` alone.
 */
export function questionnaireContestKey(
  postKey: string,
  bench: "ruling" | "opposition" | null
): string {
  return postKey === "cabinet_minister" && bench ? `${postKey}:${bench}` : postKey;
}

/** What to call the contest on screen. */
export function questionnaireContestLabel(
  postKey: string,
  bench: "ruling" | "opposition" | null
): string {
  if (postKey === "cabinet_minister") {
    if (bench === "ruling") return "Cabinet Minister";
    if (bench === "opposition") return "Shadow Minister";
    return "Cabinet / Shadow Minister — no bench";
  }
  return questionnairePostLabel(postKey);
}

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

// ─── Worth a look before the shortlist ───────────────────────────
//
// NOT a gate. The Director was explicit that a blanket "are you sure?" over the
// whole ranking is the wrong shape (2026-08-16): it fires on every candidate,
// so it teaches an organiser to click through without reading, and it slows the
// one moment where thinking matters.
//
// So this surfaces exactly two things and nothing else — the two cases where
// the ranked list, read straight down, hides something an organiser would want
// to know before they confirm:
//
//   (a) a candidate the ranking wants to shortlist whose paper carries red
//       flags. The flags are already on the answers (RED_FLAGS above, written
//       by the routine via applyAttemptScores and counted into redFlagCount) —
//       this reads that same field, it does not invent a second signal.
//   (b) candidates LEVEL ON POINTS across the cut line. The list shows one of
//       them above and one below with nothing separating them, and only the
//       ordering of equal numbers decides which is which.
//
// It informs. It blocks nothing, and it changes no ranking.

export type QuestionnaireFlaggedHigh = {
  attemptId: string;
  participantId: string;
  fullName: string;
  constituencyNumber: number | null;
  postKey: QuestionnairePostKey;
  rank: number;
  pct: number | null;
  redFlagCount: number;
};

export type QuestionnaireTiedCandidate = {
  attemptId: string;
  participantId: string;
  fullName: string;
  constituencyNumber: number | null;
  rank: number;
  /** Above the suggested cut on the strength of the ordering alone. */
  insideCut: boolean;
};

export type QuestionnaireCutTie = {
  postKey: QuestionnairePostKey;
  cutoff: number;
  pct: number;
  candidates: QuestionnaireTiedCandidate[];
};

export type QuestionnaireWatchList = {
  flaggedHigh: QuestionnaireFlaggedHigh[];
  cutTies: QuestionnaireCutTie[];
};

/**
 * Read the ranked list the way the screen draws it and pull out the two odd
 * cases. Pure and synchronous: same input, same output, no reads of its own.
 *
 * Only SCORED papers are considered, and for the same reason the CSV does it —
 * an unscored attempt has no rank, so it can neither be shortlisted nor be
 * level with anybody.
 */
export function buildQuestionnaireWatchList(
  rows: readonly QuestionnaireResultRow[]
): QuestionnaireWatchList {
  const byPost = new Map<QuestionnairePostKey, QuestionnaireResultRow[]>();
  for (const r of rows) {
    if (r.scoringStatus !== "scored") continue;
    const list = byPost.get(r.postKey) ?? [];
    list.push(r);
    byPost.set(r.postKey, list);
  }

  const flaggedHigh: QuestionnaireFlaggedHigh[] = [];
  const cutTies: QuestionnaireCutTie[] = [];

  for (const [postKey, unsorted] of byPost) {
    // Best first — the same order the table ranks in, sorted here rather than
    // assumed so this cannot quietly disagree with the screen.
    const ranked = [...unsorted].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    const cutoff = shortlistCutoff(ranked.length);

    ranked.forEach((r, i) => {
      if (i < cutoff && r.redFlagCount > 0) {
        flaggedHigh.push({
          attemptId: r.attemptId,
          participantId: r.participantId,
          fullName: r.fullName,
          constituencyNumber: r.constituencyNumber,
          postKey,
          rank: i + 1,
          pct: r.pct,
          redFlagCount: r.redFlagCount,
        });
      }
    });

    // A tie only matters when there is a line for it to straddle: if everyone
    // scored is inside the cut, nobody is being separated by anything.
    if (ranked.length <= cutoff) continue;
    const pctAtCut = ranked[cutoff - 1]?.pct;
    if (pctAtCut == null) continue;

    const tied = ranked
      .map((r, i) => ({ r, rank: i + 1 }))
      .filter(({ r }) => r.pct === pctAtCut);
    const spansCut =
      tied.some(({ rank }) => rank <= cutoff) && tied.some(({ rank }) => rank > cutoff);
    if (!spansCut) continue;

    cutTies.push({
      postKey,
      cutoff,
      pct: pctAtCut,
      candidates: tied.map(({ r, rank }) => ({
        attemptId: r.attemptId,
        participantId: r.participantId,
        fullName: r.fullName,
        constituencyNumber: r.constituencyNumber,
        rank,
        insideCut: rank <= cutoff,
      })),
    });
  }

  flaggedHigh.sort((a, b) => a.postKey.localeCompare(b.postKey) || a.rank - b.rank);
  cutTies.sort((a, b) => a.postKey.localeCompare(b.postKey));
  return { flaggedHigh, cutTies };
}

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
  /**
   * Files handed in for THIS answer. A file-only answer has 0 words, so
   * without this column the row reads as a blank the candidate skipped.
   */
  fileCount: number;
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
  "Files",
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
    r.fileCount,
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
  "Files",
  "Shortlist marker",
];

export function buildQuestionnaireCsv(rows: readonly QuestionnaireResultRow[]): string {
  // Rank and the shortlist marker are computed per CONTEST over SCORED rows
  // only, so an unscored attempt never silently occupies a shortlist place —
  // and so Cabinet and Shadow candidates, who sit the same paper for different
  // seats, are never ranked against each other or counted into one cutoff.
  const scoredByPost = new Map<string, number>();
  for (const r of rows) {
    if (r.scoringStatus === "scored") {
      const k = questionnaireContestKey(r.postKey, r.bench);
      scoredByPost.set(k, (scoredByPost.get(k) ?? 0) + 1);
    }
  }
  const seen = new Map<string, number>();

  const body = rows.map((r) => {
    let rank: number | "" = "";
    let marker = "";
    const contest = questionnaireContestKey(r.postKey, r.bench);
    if (r.scoringStatus === "scored") {
      const n = (seen.get(contest) ?? 0) + 1;
      seen.set(contest, n);
      rank = n;
      marker = n <= shortlistCutoff(scoredByPost.get(contest) ?? 0) ? "Shortlist" : "";
    }
    return [
      rank,
      r.constituencyNumber ?? "",
      r.fullName,
      questionnaireContestLabel(r.postKey, r.bench),
      formatQuestionnaireTime(r.submittedAt),
      r.scoringStatus,
      r.totalScore ?? "",
      r.maxScore ?? "",
      r.pct ?? "",
      r.redFlagCount,
      r.answered,
      r.drawn,
      r.fileCount,
      marker,
    ];
  });

  return toCsv(QUESTIONNAIRE_CSV_HEADERS, body);
}
