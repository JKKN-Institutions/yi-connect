import { z } from "zod";
import { cleanText } from "../ai/schemas";

/*
 * Take Pride partner-side AI: job kinds, daily limits and the validators for
 * what the out-of-band routine POSTs back to /take-pride/api/ai-partners.
 *
 * No server imports here, so node scripts can unit-check the validators and
 * client components can share the limits.
 *
 * The production app NEVER calls an LLM. A partner (or an organiser, for a
 * sales chaser) queues a job in tp_partner_ai_jobs; the claude.ai routine
 * claims it, writes the text off-platform and POSTs it back. Text is clamped
 * and scrubbed of phone numbers, emails and links, never trusted.
 */

export const PARTNER_AI_KINDS = ["partner_brief", "lead_followup", "sales_chaser"] as const;
export type PartnerAiKind = (typeof PARTNER_AI_KINDS)[number];
export type PartnerAiStatus = "pending" | "generating" | "ready" | "failed";

/**
 * Jobs per day (IST calendar day). partner_brief and lead_followup count per
 * Catalyst Partner; sales_chaser counts per applicant (any organiser).
 * Every job started counts, failed ones included.
 */
export const PARTNER_AI_DAILY_LIMIT: Record<PartnerAiKind, number> = {
  partner_brief: 30,
  lead_followup: 60,
  sales_chaser: 5,
};

/** What the routine may write back. */
export const BRIEF_WHY_MAX = 200;
export const BRIEF_POINT_MAX = 160;
export const BRIEF_POINTS = 3;
export const BRIEF_OPENING_MAX = 200;
export const BRIEF_AVOID_MAX = 160;
export const FOLLOWUP_MAX = 500;
export const CHASER_MAX = 600;

/** The one delegate a brief or follow-up was written about (pinned at claim time). */
export type PartnerAiAllowed = { subject?: string | null };

export type PartnerBriefOutput = {
  why: string;
  talking_points: string[];
  opening_line: string;
  avoid: string;
};
export type LeadFollowupOutput = { message: string };
export type SalesChaserOutput = { message: string };
export type PartnerAiOutput = PartnerBriefOutput | LeadFollowupOutput | SalesChaserOutput;

/** What a page shows for one brief / one draft. */
export type BriefState = { status: "none" } | { status: "waiting" } | { status: "failed" } | ({ status: "ready" } & PartnerBriefOutput);
export type DraftState = { status: "none" } | { status: "waiting" } | { status: "failed" } | { status: "ready"; message: string };

// ---------------------------------------------------------------------------
// Text hygiene (on top of cleanText: phones and emails -> [removed])

const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;

/** One line: control characters out, phones / emails / links -> [removed], whitespace folded. */
export function cleanLine(s: string): string {
  return cleanText(s.replace(LINK, "[removed]"));
}

function cutAtWord(t: string, max: number): string {
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

/** One-line text, cleaned and cut at a word boundary to at most `max` characters. */
export function clampLine(s: string, max: number): string {
  return cutAtWord(cleanLine(s), max);
}

/**
 * A message the user will paste into WhatsApp: line breaks are kept (at most
 * one blank line in a row), every line is cleaned, then cut to `max`.
 */
export function clampMessage(s: string, max: number): string {
  const lines = s.replace(/\r\n?/g, "\n").split("\n").map(cleanLine);
  const out: string[] = [];
  for (const l of lines) {
    if (!l && (!out.length || !out[out.length - 1])) continue;
    out.push(l);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return cutAtWord(out.join("\n"), max);
}

// ---------------------------------------------------------------------------
// Raw shapes (lenient: unknown keys ignored, lengths clamped after parse)

const rawText = z.string().max(5000);
const rawSubject = z.string().max(64).nullable().optional();

const RawBrief = z.object({
  subject_id: rawSubject,
  why: rawText,
  talking_points: z.array(rawText).max(10),
  opening_line: rawText,
  avoid: rawText.optional().default(""),
});
const RawFollowup = z.object({ subject_id: rawSubject, message: rawText });
const RawChaser = z.object({ message: rawText });

export type PartnerValidateResult =
  | { ok: true; output: PartnerAiOutput; dropped: number }
  | { ok: false; error: string };

/**
 * A brief or follow-up is about ONE person. If the routine names a
 * subject_id, it must be the one this job was about; a mismatch means the
 * routine mixed jobs up, so the job fails rather than store text about
 * someone else.
 */
function wrongSubject(given: string | null | undefined, allowed: PartnerAiAllowed | null): boolean {
  if (given === undefined || given === null || given === "") return false;
  return !allowed?.subject || given !== allowed.subject;
}

/** Check one routine output against its kind. Never throws. */
export function validatePartnerOutput(kind: PartnerAiKind, raw: unknown, allowed: PartnerAiAllowed | null): PartnerValidateResult {
  try {
    switch (kind) {
      case "partner_brief": {
        const p = RawBrief.safeParse(raw);
        if (!p.success) return { ok: false, error: "partner_brief: " + (p.error.issues[0]?.message ?? "bad shape") };
        if (wrongSubject(p.data.subject_id, allowed)) return { ok: false, error: "partner_brief: subject_id is not this job's person" };
        const points = p.data.talking_points.map((t) => clampLine(t, BRIEF_POINT_MAX)).filter(Boolean);
        const kept = points.slice(0, BRIEF_POINTS);
        const output: PartnerBriefOutput = {
          why: clampLine(p.data.why, BRIEF_WHY_MAX),
          talking_points: kept,
          opening_line: clampLine(p.data.opening_line, BRIEF_OPENING_MAX),
          avoid: clampLine(p.data.avoid, BRIEF_AVOID_MAX),
        };
        if (!output.why || !output.opening_line || !kept.length) {
          return { ok: false, error: "partner_brief: why, opening_line and at least one talking point are required" };
        }
        return { ok: true, output, dropped: p.data.talking_points.length - kept.length };
      }
      case "lead_followup": {
        const p = RawFollowup.safeParse(raw);
        if (!p.success) return { ok: false, error: "lead_followup: " + (p.error.issues[0]?.message ?? "bad shape") };
        if (wrongSubject(p.data.subject_id, allowed)) return { ok: false, error: "lead_followup: subject_id is not this job's person" };
        const message = clampMessage(p.data.message, FOLLOWUP_MAX);
        if (!message) return { ok: false, error: "lead_followup: empty message" };
        return { ok: true, output: { message }, dropped: 0 };
      }
      case "sales_chaser": {
        const p = RawChaser.safeParse(raw);
        if (!p.success) return { ok: false, error: "sales_chaser: " + (p.error.issues[0]?.message ?? "bad shape") };
        const message = clampMessage(p.data.message, CHASER_MAX);
        if (!message) return { ok: false, error: "sales_chaser: empty message" };
        return { ok: true, output: { message }, dropped: 0 };
      }
    }
  } catch {
    return { ok: false, error: "Output could not be checked" };
  }
  return { ok: false, error: "Unknown kind" };
}

export function isPartnerAiKind(s: unknown): s is PartnerAiKind {
  return typeof s === "string" && (PARTNER_AI_KINDS as readonly string[]).includes(s);
}

/**
 * wa.me link. With a phone (organiser chaser to the applicant's OWN number):
 * digits only, a 10-digit Indian mobile gets 91 in front. Without one, or
 * when the number does not look usable, the link opens WhatsApp with the
 * text and lets the user pick the chat. Partner follow-ups never pass a
 * phone: the app does not share delegates' numbers.
 */
export function waLink(text: string, phone?: string | null): string {
  const t = encodeURIComponent(text);
  if (!phone) return `https://wa.me/?text=${t}`;
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  if (d.length < 11 || d.length > 15) return `https://wa.me/?text=${t}`;
  return `https://wa.me/${d}?text=${t}`;
}
