import { z } from "zod";
import { clamp, cleanText } from "../ai/schemas";

/*
 * "My 1% coach": four check-ins after Take Pride 2026 on the delegate's
 * 1% pledge, at 7, 30, 60 and 90 days after the event ends (19 Dec 2026).
 *
 * No server imports here, so a node script can unit-check the dates, the
 * validator and the pledge themes, and client components can share limits.
 *
 * The production app NEVER calls an LLM. A delegate's check-in becomes a
 * 'pending' row in tp_coach_checkins; the claude.ai routine claims it,
 * writes the coach note off-platform and POSTs it back. Every person id it
 * returns must be in the row's pinned `allowed` list; anything else is
 * dropped. Text is clamped and scrubbed of phone numbers and emails.
 */

export const COACH_STEPS = [7, 30, 60, 90] as const;
export type CoachStep = (typeof COACH_STEPS)[number];

/** Take Pride 2026 ends on this day (IST). */
export const EVENT_END = "2026-12-19";

/**
 * Due dates (IST calendar days), fixed so a page never computes them
 * differently from the routine doc. The unit check asserts each one equals
 * EVENT_END + step days.
 */
export const COACH_DUE: Record<CoachStep, string> = {
  7: "2026-12-26",
  30: "2027-01-18",
  60: "2027-02-17",
  90: "2027-03-19",
};

export const COACH_MOODS = ["on_track", "slipping", "done"] as const;
export type CoachMood = (typeof COACH_MOODS)[number];
export const MOOD_LABEL: Record<CoachMood, string> = {
  on_track: "On track",
  slipping: "Slipping a bit",
  done: "Done it",
};

export type CoachStatus = "open" | "pending" | "generating" | "ready" | "failed";

/** What a delegate may type. */
export const UPDATE_MIN = 10;
export const UPDATE_MAX = 500;

/** What the routine may write back. */
export const REFLECTION_MAX = 300;
export const NEXT_STEP_MAX = 140;
export const PING_MAX = 3;
export const PING_REASON_MAX = 140;

export type CoachPing = { id: string; reason: string };
export type CoachNote = { reflection: string; next_step: string; ping: CoachPing[] };
export type CoachAllowed = { people?: string[] };

export function isCoachStep(n: unknown): n is CoachStep {
  return typeof n === "number" && (COACH_STEPS as readonly number[]).includes(n);
}

export function isCoachMood(s: unknown): s is CoachMood {
  return typeof s === "string" && (COACH_MOODS as readonly string[]).includes(s);
}

// ---------------------------------------------------------------------------
// Dates (IST)

const IST_MS = 330 * 60 * 1000;

/** Today's calendar date in India, "YYYY-MM-DD". */
export function istDate(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);
}

/** A step opens at 00:00 IST on its due date and stays open after. */
export function isStepDue(step: CoachStep, now: Date = new Date()): boolean {
  return istDate(now) >= COACH_DUE[step];
}

/**
 * Whether this delegate may write this step now. Sample (demo) delegates
 * may also try step 7 before its date, so the flow can be shown today.
 */
export function canCheckIn(step: CoachStep, isSample: boolean, now: Date = new Date()): boolean {
  return isStepDue(step, now) || (isSample && step === 7);
}

/** True before the first step's date: the coach has not started for real delegates. */
export function coachNotStarted(now: Date = new Date()): boolean {
  return !isStepDue(7, now);
}

/** "26 Dec 2026" style label for a due date. */
export function dueLabel(step: CoachStep): string {
  const [y, m, d] = COACH_DUE[step].split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

/** The step's due date plus `days`, computed (for the unit check against COACH_DUE). */
export function addDays(isoDate: string, days: number): string {
  const t = Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10));
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Validate the routine's coach note

const rawText = z.string().max(5000);
const RawNote = z.object({
  reflection: rawText,
  next_step: rawText,
  ping: z
    .array(z.object({ id: z.string().max(64), reason: rawText.optional().default("") }))
    .max(50)
    .optional()
    .default([]),
});

export type CoachValidateResult =
  | { ok: true; output: CoachNote; dropped: number }
  | { ok: false; error: string };

/**
 * Check one coach note against the ids the routine was shown. Structure
 * errors fail the check-in; foreign, repeated or extra ids are dropped and
 * counted; text is clamped with phones and emails replaced. Never throws.
 */
export function validateCoachNote(raw: unknown, allowed: CoachAllowed | null): CoachValidateResult {
  try {
    const p = RawNote.safeParse(raw);
    if (!p.success) return { ok: false, error: "coach: " + (p.error.issues[0]?.message ?? "bad shape") };
    const reflection = clamp(p.data.reflection, REFLECTION_MAX);
    const next_step = clamp(p.data.next_step, NEXT_STEP_MAX);
    if (!reflection || !next_step) return { ok: false, error: "coach: reflection and next_step are both needed" };
    const ok = new Set(allowed?.people ?? []);
    const seen = new Set<string>();
    const ping: CoachPing[] = [];
    let dropped = 0;
    for (const it of p.data.ping) {
      if (!ok.has(it.id) || seen.has(it.id) || ping.length >= PING_MAX) {
        dropped++;
        continue;
      }
      seen.add(it.id);
      ping.push({ id: it.id, reason: clamp(it.reason ?? "", PING_REASON_MAX) });
    }
    return { ok: true, output: { reflection, next_step, ping }, dropped };
  } catch {
    return { ok: false, error: "Output could not be checked" };
  }
}

/** What a delegate typed for a check-in, scrubbed: whitespace folded, phones/emails removed. */
export function cleanUpdate(s: unknown): string {
  return typeof s === "string" ? cleanText(s) : "";
}

// ---------------------------------------------------------------------------
// Pledge themes for the organiser desk (anonymised: no names, no raw text)

/**
 * Fixed themes in the spirit of "The 1% Shift". A pledge can match several.
 * Matching is on word stems only, so the desk sees counts per theme and never
 * a pledge's words or who wrote it.
 */
export const PLEDGE_THEMES: { key: string; label: string; stems: string[] }[] = [
  { key: "local", label: "Buy local / local suppliers", stems: ["local", "msme", "vendor", "supplier", "sourc", "procure", "buy"] },
  { key: "women", label: "Women-led business and inclusion", stems: ["women", "woman", "female", "girl", "inclusi", "divers", "disab"] },
  { key: "green", label: "Climate, energy and waste", stems: ["solar", "energy", "carbon", "climate", "green", "plastic", "waste", "recycl", "water", "tree", "sustain"] },
  { key: "people", label: "Hiring, skills and mentoring", stems: ["hire", "hiring", "job", "intern", "skill", "train", "mentor", "apprentic", "employ"] },
  { key: "students", label: "Schools, students and youth", stems: ["school", "student", "college", "youth", "teach", "educat", "child"] },
  { key: "health", label: "Health and road safety", stems: ["health", "blood", "road", "safety", "fitness", "wellness", "hospital"] },
  { key: "giving", label: "Giving time or money", stems: ["donat", "volunteer", "giv", "csr", "charit", "fund"] },
  { key: "growth", label: "Business growth and exports", stems: ["export", "revenue", "sales", "customer", "digit", "grow", "market"] },
];

export type ThemeCount = { key: string; label: string; count: number };

/** Count pledges per theme. Pledges matching no theme are counted as "Other". */
export function pledgeThemes(pledges: (string | null | undefined)[]): { themes: ThemeCount[]; other: number; total: number } {
  const counts = new Map<string, number>(PLEDGE_THEMES.map((t) => [t.key, 0]));
  let other = 0;
  let total = 0;
  for (const raw of pledges) {
    const text = (raw ?? "").toLowerCase();
    if (!text.trim()) continue;
    total++;
    const words = text.split(/[^a-z0-9]+/).filter(Boolean);
    let hit = false;
    for (const t of PLEDGE_THEMES) {
      if (words.some((w) => t.stems.some((s) => w.startsWith(s)))) {
        counts.set(t.key, (counts.get(t.key) ?? 0) + 1);
        hit = true;
      }
    }
    if (!hit) other++;
  }
  const themes = PLEDGE_THEMES.map((t) => ({ key: t.key, label: t.label, count: counts.get(t.key) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { themes, other, total };
}

// ---------------------------------------------------------------------------
// Grounding assembly (pure: takes already-loaded rows, picks the safe fields)

export type CoachPersonIn = {
  id: string;
  full_name: string;
  chapter: string;
  business_name: string | null;
  role_title: string | null;
  [k: string]: unknown;
};

export type CoachPreviousIn = {
  step: number;
  update_text: string | null;
  mood: string | null;
  coach_note: unknown;
};

/**
 * Build the grounding object from loaded rows. Picks fields by name, so a
 * stray column (phone, email, token, badge code or secret) in the input can
 * never reach the routine. Pledge and update text are scrubbed again here.
 */
export function assembleCoachGrounding(input: {
  me: { full_name: string; chapter: string; pledge: string | null; [k: string]: unknown };
  step: CoachStep;
  update_text: string;
  mood: string | null;
  previous: CoachPreviousIn[];
  people: (CoachPersonIn & { met_by: "connection" | "meeting" | "both" })[];
}): { grounding: Record<string, unknown>; allowed: CoachAllowed } {
  const people = input.people.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    chapter: p.chapter,
    business_name: p.business_name,
    role_title: p.role_title,
    met_by: p.met_by,
  }));
  const previous = input.previous
    .filter((x) => x.step < input.step)
    .sort((a, b) => a.step - b.step)
    .map((x) => {
      const n = x.coach_note as Partial<CoachNote> | null;
      return {
        step: x.step,
        update_text: x.update_text ? cleanText(x.update_text) : null,
        mood: x.mood,
        coach_reflection: n && typeof n.reflection === "string" ? n.reflection : null,
        coach_next_step: n && typeof n.next_step === "string" ? n.next_step : null,
      };
    });
  return {
    grounding: {
      event: { name: "Take Pride 2026", theme: "The 1% Shift", ended_on: EVENT_END },
      me: { full_name: input.me.full_name, chapter: input.me.chapter },
      pledge: input.me.pledge ? cleanText(input.me.pledge) : null,
      step: input.step,
      days_after_event: input.step,
      due_on: COACH_DUE[input.step],
      update_text: cleanText(input.update_text),
      mood: input.mood,
      previous_steps: previous,
      people,
      output_limits: { reflection_chars: REFLECTION_MAX, next_step_chars: NEXT_STEP_MAX, ping: PING_MAX, ping_reason_chars: PING_REASON_MAX },
    },
    allowed: { people: people.map((p) => p.id) },
  };
}
