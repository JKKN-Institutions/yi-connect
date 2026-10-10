import { z } from "zod";
import { TP_TAGS } from "../constants";
import { PROFILE_TAG_MAX, PROFILE_TEXT_MAX, YI_VERTICALS } from "../profile";

/*
 * Take Pride AI helpers: job kinds, daily limits, input limits and the
 * validators for what the out-of-band routine POSTs back.
 *
 * No server imports here, so a node script can unit-check the validators
 * and client components can share the same limits.
 *
 * The production app NEVER calls an LLM. It queues a job, the claude.ai
 * routine claims it, writes the text off-platform and POSTs it back. Every
 * id the routine returns must be in the job's `allowed` set (pinned when the
 * job was claimed); anything else is dropped. Text is clamped, never trusted.
 */

export const AI_KINDS = ["summit_plan", "profile_helper", "radar", "why_meet", "ask"] as const;
export type AiKind = (typeof AI_KINDS)[number];
export type AiStatus = "pending" | "generating" | "ready" | "failed";

/** Requests per delegate per day (IST calendar day). Radar counts only on-demand requests. */
export const AI_DAILY_LIMIT: Record<AiKind, number> = {
  summit_plan: 3,
  profile_helper: 10,
  ask: 20,
  radar: 1,
  why_meet: 1,
};

/** What a delegate may type. */
export const GOAL_MAX = 500;
export const ABOUT_MAX = 400;
export const QUESTION_MAX = 300;
export const QUESTION_MIN = 5;

/** What the routine may write back. */
export const REASON_MAX = 160;
export const SUMMARY_MAX = 400;
export const RADAR_SUMMARY_MAX = 600;
export const ANSWER_MAX = 600;
export const DEAL_TEXT_MAX = 200;

/** Ids the routine was shown for one job. Anything outside is dropped. */
export type AiAllowed = {
  people?: string[];
  sessions?: string[];
  tables?: string[];
  partners?: string[];
};

export type PlanItem = { id: string; reason: string };
export type SummitPlanOutput = {
  summary: string;
  sessions: PlanItem[];
  people: PlanItem[];
  tables: PlanItem[];
  partners: PlanItem[];
};
export type ProfileHelperOutput = {
  needs: string[];
  offers: string[];
  yi_vertical: string | null;
  pledge: string | null;
};
export type RadarOutput = {
  summary: string;
  deals: { person_id: string; text: string }[];
  group_buys: { text: string; person_ids: string[] }[];
};
export type WhyMeetOutput = { people: PlanItem[] };
export type AskOutput = { answer: string };

export type AiOutput = SummitPlanOutput | ProfileHelperOutput | RadarOutput | WhyMeetOutput | AskOutput;

// ---------------------------------------------------------------------------
// Text hygiene

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Indian mobile / landline shapes: 10+ digits, optionally with +91, spaces or dashes.
const PHONE = /(?:\+?\d[\d\s-]{8,}\d)/g;

/** Fold whitespace, strip control characters, remove anything that looks like a phone or email. */
export function cleanText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(EMAIL, "[removed]")
    .replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 10 ? "[removed]" : m))
    .replace(/\s+/g, " ")
    .trim();
}

/** Clean, then cut at a word boundary so the result is at most `max` characters. */
export function clamp(s: string, max: number): string {
  const t = cleanText(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

/** Fold what a delegate typed: whitespace runs to one space, trimmed. */
export function foldInput(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

// ---------------------------------------------------------------------------
// Raw shapes (lenient: unknown keys ignored, lengths clamped after parse)

const rawText = z.string().max(5000);
const rawItem = z.object({ id: z.string().max(64), reason: rawText.optional().default("") });
const rawItems = z.array(rawItem).max(50).optional().default([]);

const RawSummitPlan = z.object({
  summary: rawText.optional().default(""),
  sessions: rawItems,
  people: rawItems,
  tables: rawItems,
  partners: rawItems,
});

const RawProfileHelper = z.object({
  needs: z.array(z.string().max(100)).max(50).optional().default([]),
  offers: z.array(z.string().max(100)).max(50).optional().default([]),
  yi_vertical: z.string().max(100).nullable().optional().default(null),
  pledge: rawText.nullable().optional().default(null),
});

const RawRadar = z.object({
  summary: rawText,
  deals: z
    .array(z.object({ person_id: z.string().max(64), text: rawText }))
    .max(50)
    .optional()
    .default([]),
  group_buys: z
    .array(z.object({ text: rawText, person_ids: z.array(z.string().max(64)).max(50).optional().default([]) }))
    .max(20)
    .optional()
    .default([]),
});

const RawWhyMeet = z.object({ people: z.array(rawItem).max(50) });
const RawAsk = z.object({ answer: rawText });

// ---------------------------------------------------------------------------
// Validate + clamp + drop

export type ValidateResult =
  | { ok: true; output: AiOutput; dropped: number }
  | { ok: false; error: string };

function pickItems(items: { id: string; reason: string }[], allowed: string[] | undefined, max: number) {
  const ok = new Set(allowed ?? []);
  const seen = new Set<string>();
  const out: PlanItem[] = [];
  let dropped = 0;
  for (const it of items) {
    if (!ok.has(it.id) || seen.has(it.id)) {
      dropped++;
      continue;
    }
    if (out.length >= max) {
      dropped++;
      continue;
    }
    seen.add(it.id);
    out.push({ id: it.id, reason: clamp(it.reason ?? "", REASON_MAX) });
  }
  return { out, dropped };
}

const onTagList = (xs: string[]) =>
  [...new Set(xs.filter((x) => (TP_TAGS as readonly string[]).includes(x)))].slice(0, PROFILE_TAG_MAX);

/**
 * Check one routine output against its kind and the ids it was shown.
 * Structure errors fail the job; stale or invented ids are dropped and
 * counted; text is clamped. Never throws.
 */
export function validateOutput(kind: AiKind, raw: unknown, allowed: AiAllowed | null): ValidateResult {
  const a = allowed ?? {};
  try {
    switch (kind) {
      case "summit_plan": {
        const p = RawSummitPlan.safeParse(raw);
        if (!p.success) return { ok: false, error: "summit_plan: " + (p.error.issues[0]?.message ?? "bad shape") };
        const s = pickItems(p.data.sessions, a.sessions, 8);
        const pe = pickItems(p.data.people, a.people, 10);
        const t = pickItems(p.data.tables, a.tables, 5);
        const pa = pickItems(p.data.partners, a.partners, 5);
        const output: SummitPlanOutput = {
          summary: clamp(p.data.summary, SUMMARY_MAX),
          sessions: s.out,
          people: pe.out,
          tables: t.out,
          partners: pa.out,
        };
        if (!output.summary && !s.out.length && !pe.out.length && !t.out.length && !pa.out.length) {
          return { ok: false, error: "summit_plan: nothing usable after checks" };
        }
        return { ok: true, output, dropped: s.dropped + pe.dropped + t.dropped + pa.dropped };
      }
      case "profile_helper": {
        const p = RawProfileHelper.safeParse(raw);
        if (!p.success) return { ok: false, error: "profile_helper: " + (p.error.issues[0]?.message ?? "bad shape") };
        const needs = onTagList(p.data.needs);
        const offers = onTagList(p.data.offers);
        const v = p.data.yi_vertical;
        const yi_vertical = v && (YI_VERTICALS as readonly string[]).includes(v) ? v : null;
        const pledgeRaw = p.data.pledge ? cleanText(p.data.pledge) : "";
        // A pledge is the delegate's own words: drop it rather than cut it mid-sentence.
        const pledge = pledgeRaw && pledgeRaw.length <= PROFILE_TEXT_MAX && !pledgeRaw.includes("[removed]") ? pledgeRaw : null;
        const dropped =
          p.data.needs.length - needs.length +
          (p.data.offers.length - offers.length) +
          (v && !yi_vertical ? 1 : 0) +
          (p.data.pledge && !pledge ? 1 : 0);
        if (!needs.length && !offers.length && !yi_vertical && !pledge) {
          return { ok: false, error: "profile_helper: nothing usable after checks" };
        }
        return { ok: true, output: { needs, offers, yi_vertical, pledge }, dropped: Math.max(0, dropped) };
      }
      case "radar": {
        const p = RawRadar.safeParse(raw);
        if (!p.success) return { ok: false, error: "radar: " + (p.error.issues[0]?.message ?? "bad shape") };
        const people = new Set(a.people ?? []);
        let dropped = 0;
        const deals: RadarOutput["deals"] = [];
        const dealSeen = new Set<string>();
        for (const d of p.data.deals) {
          if (!people.has(d.person_id) || dealSeen.has(d.person_id) || deals.length >= 8) {
            dropped++;
            continue;
          }
          dealSeen.add(d.person_id);
          deals.push({ person_id: d.person_id, text: clamp(d.text, DEAL_TEXT_MAX) });
        }
        const group_buys: RadarOutput["group_buys"] = [];
        for (const g of p.data.group_buys) {
          if (group_buys.length >= 4) {
            dropped++;
            continue;
          }
          const ids = [...new Set(g.person_ids)];
          const kept = ids.filter((id) => people.has(id)).slice(0, 6);
          dropped += ids.length - kept.length;
          const text = clamp(g.text, DEAL_TEXT_MAX);
          if (text) group_buys.push({ text, person_ids: kept });
        }
        const summary = clamp(p.data.summary, RADAR_SUMMARY_MAX);
        if (!summary && !deals.length && !group_buys.length) return { ok: false, error: "radar: nothing usable after checks" };
        return { ok: true, output: { summary, deals, group_buys }, dropped };
      }
      case "why_meet": {
        const p = RawWhyMeet.safeParse(raw);
        if (!p.success) return { ok: false, error: "why_meet: " + (p.error.issues[0]?.message ?? "bad shape") };
        const pe = pickItems(p.data.people, a.people, 15);
        if (!pe.out.length) return { ok: false, error: "why_meet: no person from the list" };
        return { ok: true, output: { people: pe.out }, dropped: pe.dropped };
      }
      case "ask": {
        const p = RawAsk.safeParse(raw);
        if (!p.success) return { ok: false, error: "ask: " + (p.error.issues[0]?.message ?? "bad shape") };
        const answer = clamp(p.data.answer, ANSWER_MAX);
        if (!answer) return { ok: false, error: "ask: empty answer" };
        return { ok: true, output: { answer }, dropped: 0 };
      }
    }
  } catch {
    return { ok: false, error: "Output could not be checked" };
  }
  return { ok: false, error: "Unknown kind" };
}

export function isAiKind(s: unknown): s is AiKind {
  return typeof s === "string" && (AI_KINDS as readonly string[]).includes(s);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID.test(s);
}

/** Start of today in India (IST, UTC+5:30), as an ISO string. Daily limits reset here. */
export function istDayStart(now: Date = new Date()): string {
  const IST = 330 * 60 * 1000;
  const shifted = new Date(now.getTime() + IST);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST).toISOString();
}

/** Hour of the day in India, 0-23. */
export function istHour(now: Date = new Date()): number {
  return new Date(now.getTime() + 330 * 60 * 1000).getUTCHours();
}
