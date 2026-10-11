import { TP_EVENT } from "../constants";
import {
  BRIEF_AVOID_MAX,
  BRIEF_OPENING_MAX,
  BRIEF_POINT_MAX,
  BRIEF_POINTS,
  BRIEF_WHY_MAX,
  CHASER_MAX,
  FOLLOWUP_MAX,
  cleanLine,
  type PartnerAiAllowed,
} from "./schemas";

/*
 * Pure grounding builders for partner-side AI jobs. No server imports, so
 * node scripts test exactly what the routine is handed. The server loader
 * (./load.ts) reads rows with EXPLICIT column lists and calls these.
 *
 * Privacy rules enforced here (and checked by scripts):
 * - never phone, email, token, badge code / secret, payment reference
 * - a partner sees a delegate's profile only when that delegate is listed
 *   in the directory OR accepted a meeting with this partner, and only in
 *   the same sample / real world, and only while the partner is confirmed
 *   and not cancelled
 * - a lead the partner scanned who is NOT listed and has no accepted
 *   meeting gives only the badge-card fields the partner already sees
 * - a sales chaser (unpaid applicant) carries NO delegate name, business
 *   name or id: only counts and up to 3 anonymised examples built from
 *   controlled lists (tags, industry, chapter, a fixed role word)
 */

export type PartnerRow = {
  id: string;
  member_name: string;
  chapter: string;
  zone: string | null;
  business_name: string;
  industry: string;
  offers: string[] | null;
  wants_industries: string[] | null;
  pitch: string | null;
  tier: string;
  amount_due_inr: number;
  status: string;
  created_at: string;
  payment_submitted_at: string | null;
  cancelled_at: string | null;
  is_sample: boolean;
};

/** Columns the loader may read for a partner. No phone, email, token or payment reference. */
export const PARTNER_GROUND_COLS =
  "id, member_name, chapter, zone, business_name, industry, offers, wants_industries, pitch, tier, amount_due_inr, status, created_at, payment_submitted_at, cancelled_at, is_sample";

export type DelegateRow = {
  id: string;
  full_name: string;
  chapter: string;
  zone: string;
  business_name: string | null;
  industry: string;
  role_title: string | null;
  needs: string[] | null;
  offers: string[] | null;
  working_on: string | null;
  ask_me_about: string | null;
  pledge: string | null;
  directory_visible: boolean;
  partner_meetings_opt_in: boolean;
  is_sample: boolean;
};

/** Columns the loader may read for a delegate. No phone, email, token, badge or check-in data. */
export const DELEGATE_GROUND_COLS =
  "id, full_name, chapter, zone, business_name, industry, role_title, needs, offers, working_on, ask_me_about, pledge, directory_visible, partner_meetings_opt_in, is_sample";

/** How this partner knows this delegate. */
export type Relation = { acceptedMeeting: boolean; lead: boolean; leadNote?: string | null };

const arr = (x: string[] | null | undefined) => x ?? [];

export const partnerActive = (p: Pick<PartnerRow, "status" | "cancelled_at">) => p.status === "confirmed" && !p.cancelled_at;

/** May this partner get a meeting brief about this delegate? */
export function briefAllowed(
  p: Pick<PartnerRow, "status" | "cancelled_at" | "is_sample">,
  d: Pick<DelegateRow, "directory_visible" | "is_sample">,
  rel: Pick<Relation, "acceptedMeeting">
): boolean {
  return partnerActive(p) && d.is_sample === p.is_sample && (d.directory_visible || rel.acceptedMeeting);
}

/** May this partner get a follow-up draft for this delegate? (a lead or an accepted meeting) */
export function followupAllowed(
  p: Pick<PartnerRow, "status" | "cancelled_at" | "is_sample">,
  d: Pick<DelegateRow, "is_sample">,
  rel: Pick<Relation, "acceptedMeeting" | "lead">
): boolean {
  return partnerActive(p) && d.is_sample === p.is_sample && (rel.lead || rel.acceptedMeeting);
}

function partnerView(p: PartnerRow) {
  return {
    member_name: p.member_name,
    business_name: p.business_name,
    chapter: p.chapter,
    industry: p.industry,
    offers: arr(p.offers),
    wants_industries: arr(p.wants_industries),
    pitch: p.pitch ? cleanLine(p.pitch) : null,
  };
}

/** Everything a listed (or meeting-accepted) delegate shows. Free text is scrubbed of contact details. */
function personFull(d: DelegateRow) {
  const t = (s: string | null) => (s ? cleanLine(s) : null);
  return {
    id: d.id,
    full_name: d.full_name,
    role_title: d.role_title,
    business_name: d.business_name,
    chapter: d.chapter,
    zone: d.zone,
    industry: d.industry,
    needs: arr(d.needs),
    offers: arr(d.offers),
    working_on: t(d.working_on),
    ask_me_about: t(d.ask_me_about),
    pledge: t(d.pledge),
  };
}

/** Badge-card fields only: what the partner already saw on the scanned badge. */
function personCard(d: DelegateRow) {
  return {
    id: d.id,
    full_name: d.full_name,
    role_title: d.role_title,
    business_name: d.business_name,
    chapter: d.chapter,
    industry: d.industry,
  };
}

const EVENT = { name: TP_EVENT.name, theme: TP_EVENT.theme, dates: TP_EVENT.dates, city: TP_EVENT.city };

export type Built = { grounding: Record<string, unknown>; allowed: PartnerAiAllowed };

export function buildBriefGrounding(p: PartnerRow, d: DelegateRow, rel: Relation): Built | null {
  if (!briefAllowed(p, d, rel)) return null;
  const offers = new Set(arr(p.offers));
  return {
    grounding: {
      event: EVENT,
      partner: partnerView(p),
      person: personFull(d),
      shared_needs: arr(d.needs).filter((n) => offers.has(n)),
      meeting: rel.acceptedMeeting ? "accepted" : "not yet requested or accepted",
      output_limits: {
        why_chars: BRIEF_WHY_MAX,
        talking_points: BRIEF_POINTS,
        talking_point_chars: BRIEF_POINT_MAX,
        opening_line_chars: BRIEF_OPENING_MAX,
        avoid_chars: BRIEF_AVOID_MAX,
      },
    },
    allowed: { subject: d.id },
  };
}

export function buildFollowupGrounding(p: PartnerRow, d: DelegateRow, rel: Relation): Built | null {
  if (!followupAllowed(p, d, rel)) return null;
  const full = d.directory_visible || rel.acceptedMeeting;
  const offers = new Set(arr(p.offers));
  const note = rel.lead && rel.leadNote ? cleanLine(rel.leadNote).slice(0, 300) : null;
  return {
    grounding: {
      event: EVENT,
      partner: partnerView(p),
      person: full ? personFull(d) : personCard(d),
      shared_needs: full ? arr(d.needs).filter((n) => offers.has(n)) : [],
      how_you_met: [rel.lead ? "you scanned them as a lead at the event" : null, rel.acceptedMeeting ? "they accepted a meeting with you" : null].filter(
        Boolean
      ),
      your_note: note,
      output_limits: { message_chars: FOLLOWUP_MAX },
    },
    allowed: { subject: d.id },
  };
}

// ------------------------------------------------------------ sales ----

/** The sales chaser goes to applicants who have not paid (or whose payment is still unconfirmed). */
export const CHASE_AFTER_HOURS = 48;

export function isChaseable(
  p: Pick<PartnerRow, "status" | "cancelled_at" | "created_at" | "payment_submitted_at">,
  now: Date = new Date()
): boolean {
  if (p.cancelled_at) return false;
  const cutoff = now.getTime() - CHASE_AFTER_HOURS * 3600 * 1000;
  if (p.status === "applied") return new Date(p.created_at).getTime() < cutoff;
  if (p.status === "payment_submitted") return new Date(p.payment_submitted_at ?? p.created_at).getTime() < cutoff;
  return false;
}

/** A fixed role word from free-text role titles, so no free text ever reaches a sales chaser. */
export function roleWord(title: string | null): string {
  const t = (title ?? "").toLowerCase();
  if (/co-?founder|founder/.test(t)) return "founder";
  if (/\bceo\b|chief executive/.test(t)) return "CEO";
  if (/managing director|\bmd\b|director/.test(t)) return "director";
  if (/owner|proprietor/.test(t)) return "owner";
  if (/partner/.test(t)) return "partner";
  return "business leader";
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");

export type Audience = {
  world: "sample" | "real";
  total_delegates: number;
  /** Delegates who take partner meetings and need at least one thing this applicant offers. */
  matching_delegates: number;
  in_target_industries: number;
  by_offer: { tag: string; count: number }[];
  by_zone: { zone: string; count: number }[];
  by_industry: { industry: string; count: number }[];
};

type AudienceDelegate = Pick<
  DelegateRow,
  "needs" | "zone" | "industry" | "chapter" | "role_title" | "partner_meetings_opt_in" | "directory_visible" | "is_sample"
>;

/**
 * Aggregate counts for one applicant over the delegates of the applicant's
 * own world. Counts only; no person-level data leaves this function.
 */
export function audienceFor(
  p: Pick<PartnerRow, "offers" | "wants_industries" | "is_sample">,
  delegates: AudienceDelegate[]
): { audience: Audience; matching: AudienceDelegate[] } {
  const world = delegates.filter((d) => d.is_sample === p.is_sample);
  const offers = new Set(arr(p.offers));
  const wants = new Set(arr(p.wants_industries));
  const matching = world.filter((d) => d.partner_meetings_opt_in && arr(d.needs).some((n) => offers.has(n)));
  const tally = <K extends string>(keys: string[], key: K) => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([v, count]) => ({ [key]: v, count }) as Record<K, string> & { count: number });
  };
  return {
    audience: {
      world: p.is_sample ? "sample" : "real",
      total_delegates: world.length,
      matching_delegates: matching.length,
      in_target_industries: matching.filter((d) => wants.has(d.industry)).length,
      by_offer: tally(matching.flatMap((d) => arr(d.needs).filter((n) => offers.has(n))), "tag"),
      by_zone: tally(matching.map((d) => d.zone), "zone"),
      by_industry: tally(matching.map((d) => d.industry), "industry"),
    },
    matching,
  };
}

/**
 * Up to 3 anonymised examples ("a founder in hospitality from Yi Coimbatore
 * who needs packaging"). Only delegates who are listed in the directory and
 * take partner meetings; one per chapter; built only from controlled values.
 */
export function anonymisedExamples(p: Pick<PartnerRow, "offers">, matching: AudienceDelegate[]): string[] {
  const offers = new Set(arr(p.offers));
  const seen = new Set<string>();
  const out: string[] = [];
  const pool = [...matching]
    .filter((d) => d.directory_visible && d.partner_meetings_opt_in)
    .sort((a, b) => arr(b.needs).filter((n) => offers.has(n)).length - arr(a.needs).filter((n) => offers.has(n)).length);
  for (const d of pool) {
    if (out.length >= 3) break;
    if (seen.has(d.chapter)) continue;
    seen.add(d.chapter);
    const role = roleWord(d.role_title);
    const needs = arr(d.needs)
      .filter((n) => offers.has(n))
      .slice(0, 2)
      .map((n) => n.toLowerCase());
    out.push(`${article(role)} ${role} in ${d.industry} from ${d.chapter} who needs ${needs.join(" and ")}`);
  }
  return out;
}

export function buildSalesGrounding(p: PartnerRow, delegates: AudienceDelegate[], now: Date = new Date()): Built | null {
  if (p.cancelled_at || (p.status !== "applied" && p.status !== "payment_submitted")) return null;
  const { audience, matching } = audienceFor(p, delegates);
  const since = new Date(p.status === "payment_submitted" ? p.payment_submitted_at ?? p.created_at : p.created_at).getTime();
  return {
    grounding: {
      event: EVENT,
      applicant: {
        member_name: p.member_name,
        business_name: p.business_name,
        chapter: p.chapter,
        zone: p.zone,
        industry: p.industry,
        offers: arr(p.offers),
        wants_industries: arr(p.wants_industries),
        pitch: p.pitch ? cleanLine(p.pitch) : null,
        price: p.tier === "member" ? "Yi member price" : "standard price",
        amount_due_inr: p.amount_due_inr,
        stage: p.status === "applied" ? "signed up, payment not sent yet" : "sent a payment reference that is not confirmed yet",
        days_waiting: Math.max(0, Math.floor((now.getTime() - since) / 86_400_000)),
      },
      audience: {
        ...audience,
        note:
          audience.world === "sample"
            ? "These counts come from SAMPLE (demo) delegates. Say 'in the demo list', never present them as real registrations."
            : audience.total_delegates === 0
              ? "The real delegate list is not loaded yet. Do not quote numbers."
              : "Counts from registered delegates who take Catalyst Partner meetings.",
      },
      examples: anonymisedExamples(p, matching),
      output_limits: { message_chars: CHASER_MAX },
    },
    allowed: {},
  };
}
