import "server-only";

import { tpService } from "../supabase";
import { TP_EVENT, TP_TAGS } from "../constants";
import { PROFILE_TAG_MAX, PROFILE_TEXT_MAX, YI_VERTICALS } from "../profile";
import { getMyAcceptedMeetings } from "../slots";
import type { AiJob } from "./queue";
import { ANSWER_MAX, REASON_MAX, SUMMARY_MAX, type AiAllowed } from "./schemas";

/*
 * Grounding = everything the routine needs to write one job, and nothing
 * more. Reached ONLY from the routine endpoint behind X-Cron-Secret.
 *
 * Privacy rules, enforced by the column lists below:
 * - other delegates appear only when directory_visible = true, and only
 *   from the same world (sample with sample, real with real)
 * - never phone, email, token, badge_code, badge_secret or check-in data
 * - partners: confirmed only, business name / industry / offers / pitch
 */

const ME_COLS =
  "id, full_name, chapter, zone, business_name, industry, role_title, needs, offers, working_on, ask_me_about, pledge, yi_vertical, chapter_strengths, chapter_wants, delegate_meetings_opt_in, is_sample";

const PERSON_COLS =
  "id, full_name, chapter, zone, business_name, industry, role_title, needs, offers, working_on, ask_me_about, pledge, yi_vertical, chapter_strengths, delegate_meetings_opt_in";

type Me = {
  id: string;
  full_name: string;
  chapter: string;
  zone: string;
  business_name: string | null;
  industry: string;
  role_title: string | null;
  needs: string[];
  offers: string[];
  working_on: string | null;
  ask_me_about: string | null;
  pledge: string | null;
  yi_vertical: string | null;
  chapter_strengths: string[];
  chapter_wants: string[];
  delegate_meetings_opt_in: boolean;
  is_sample: boolean;
};

export type GroundPerson = {
  id: string;
  full_name: string;
  chapter: string;
  zone: string;
  business_name: string | null;
  industry: string;
  role_title: string | null;
  needs: string[];
  offers: string[];
  working_on: string | null;
  ask_me_about: string | null;
  pledge: string | null;
  yi_vertical: string | null;
  chapter_strengths: string[];
  /** True when they accept delegate meeting requests. */
  delegate_meetings_opt_in: boolean;
};

const arr = (x: string[] | null | undefined) => x ?? [];

async function loadMe(id: string): Promise<Me | null> {
  const { data, error } = await tpService().from("tp_delegates").select(ME_COLS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const m = data as Me;
  return { ...m, needs: arr(m.needs), offers: arr(m.offers), chapter_strengths: arr(m.chapter_strengths), chapter_wants: arr(m.chapter_wants) };
}

function meView(me: Me) {
  return {
    id: me.id,
    full_name: me.full_name,
    chapter: me.chapter,
    zone: me.zone,
    business_name: me.business_name,
    industry: me.industry,
    role_title: me.role_title,
    needs: me.needs,
    offers: me.offers,
    working_on: me.working_on,
    ask_me_about: me.ask_me_about,
    pledge: me.pledge,
    yi_vertical: me.yi_vertical,
    chapter_strengths: me.chapter_strengths,
    chapter_wants: me.chapter_wants,
  };
}

/** Directory-visible delegates in my world, except me. */
async function loadPeople(me: Me): Promise<GroundPerson[]> {
  const { data, error } = await tpService()
    .from("tp_delegates")
    .select(PERSON_COLS)
    .eq("directory_visible", true)
    .eq("is_sample", me.is_sample)
    .neq("id", me.id)
    .limit(5000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as GroundPerson[]).map((p) => ({
    ...p,
    needs: arr(p.needs),
    offers: arr(p.offers),
    chapter_strengths: arr(p.chapter_strengths),
  }));
}

const STOP = new Set(
  "about after also been being both from have into just like looking more most need needs offer some than that their them then there these they this want wants what when where which while with would your yours take pride meet people find help".split(
    " "
  )
);

/** Words of 4+ letters from a delegate's goal, for a light keyword match. */
export function goalWords(goal: string): string[] {
  return [
    ...new Set(
      goal
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !STOP.has(w))
    ),
  ].slice(0, 20);
}

/**
 * Deterministic, no AI: 10 per tag they offer that I need, 10 per tag they
 * need that I offer, 3 per chapter want of mine they name as a strength,
 * 3 per goal word found in their work text (up to 3 words), 2 for the same
 * vertical, 2 for the same zone. Zone or vertical alone never makes a match.
 */
export function rankPeople(me: Pick<Me, "needs" | "offers" | "zone" | "yi_vertical" | "chapter_wants">, people: GroundPerson[], words: string[] = []) {
  const myNeeds = new Set(me.needs);
  const myOffers = new Set(me.offers);
  const scored: { p: GroundPerson; score: number }[] = [];
  for (const p of people) {
    const tags = p.offers.filter((o) => myNeeds.has(o)).length + p.needs.filter((n) => myOffers.has(n)).length;
    const chap = me.chapter_wants.filter((w) => p.chapter_strengths.includes(w)).length;
    const hay = [p.working_on, p.ask_me_about, p.business_name, p.industry, p.role_title, p.pledge]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const wordHits = Math.min(3, words.filter((w) => hay.includes(w)).length);
    const core = tags * 10 + chap * 3 + wordHits * 3;
    if (core === 0) continue;
    const score =
      core + (me.yi_vertical && p.yi_vertical === me.yi_vertical ? 2 : 0) + (me.zone && p.zone === me.zone ? 2 : 0);
    scored.push({ p, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.p.full_name.localeCompare(b.p.full_name)).map((x) => x.p);
}

async function loadAgenda() {
  const { data, error } = await tpService()
    .from("tp_agenda")
    .select("id, day, starts_at, title, hall, kind")
    .order("day")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; day: number; starts_at: string; title: string; hall: string; kind: string }[];
}

/** Open topic tables in my world, with seats left. No host or member names. */
async function loadTables(me: Pick<Me, "is_sample">) {
  const db = tpService();
  const { data, error } = await db
    .from("tp_circles")
    .select("id, title, about, day, starts_at, place, seats")
    .eq("status", "open")
    .eq("is_sample", me.is_sample)
    .order("day")
    .order("starts_at")
    .limit(500);
  if (error) throw new Error(error.message);
  const circles = (data ?? []) as { id: string; title: string; about: string | null; day: number; starts_at: string; place: string; seats: number }[];
  if (!circles.length) return [];
  const { data: mem, error: mErr } = await db
    .from("tp_circle_members")
    .select("circle_id")
    .in("circle_id", circles.map((c) => c.id))
    .limit(10000);
  if (mErr) throw new Error(mErr.message);
  const taken = new Map<string, number>();
  for (const m of (mem ?? []) as { circle_id: string }[]) taken.set(m.circle_id, (taken.get(m.circle_id) ?? 0) + 1);
  return circles.map((c) => ({ ...c, seats_left: Math.max(0, c.seats - (taken.get(c.id) ?? 0)) }));
}

async function loadPartners(me: Pick<Me, "is_sample">) {
  const { data, error } = await tpService()
    .from("tp_partners")
    .select("id, business_name, industry, offers, pitch")
    .eq("status", "confirmed")
    .eq("is_sample", me.is_sample)
    .order("business_name")
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; business_name: string; industry: string; offers: string[] | null; pitch: string | null }[]).map(
    (p) => ({ ...p, offers: arr(p.offers) })
  );
}

const EVENT_FACTS = {
  name: TP_EVENT.name,
  theme: TP_EVENT.theme,
  tagline: TP_EVENT.tagline,
  dates: TP_EVENT.dates,
  city: TP_EVENT.city,
  venue: "To be announced",
  delegates_expected: TP_EVENT.delegatesExpected,
};

/** Plain facts the "Ask the desk" answers may use, all true of this app today. */
const FAQ = [
  `Take Pride 2026 is on ${TP_EVENT.dates} in ${TP_EVENT.city}. The venue will be announced.`,
  "Your pass page shows your QR badge. Show it at the gate to check in.",
  "Catalyst Partner meetings and delegate meetings happen in the Partner lounge during the lunch and morning-brief meeting times on the agenda.",
  "Topic tables are small group meet-ups at the lounge tables during the networking times. Join one from Topic tables on your pass.",
  "You can ask a fellow delegate to meet from Who to meet or the Delegate directory. They accept or decline.",
  "You choose on your profile whether Catalyst Partners can ask to meet you and whether you are listed in the delegate directory.",
  "For anything not covered here, ask the Take Pride help desk at the venue.",
];

const pick = <T extends { id: string }>(xs: T[]) => xs.map((x) => x.id);

export type BuiltGrounding = { grounding: Record<string, unknown>; allowed: AiAllowed };

/**
 * Build one job's grounding and the ids it pins. Returns null when the
 * delegate no longer exists (the job is then failed by the caller).
 */
export async function buildGrounding(job: AiJob): Promise<BuiltGrounding | null> {
  const me = await loadMe(job.delegate_id);
  if (!me) return null;
  const input = job.input ?? {};

  switch (job.kind) {
    case "summit_plan": {
      const goal = typeof input.goal === "string" ? input.goal : "";
      const [people, agenda, tables, partners] = await Promise.all([loadPeople(me), loadAgenda(), loadTables(me), loadPartners(me)]);
      const top = rankPeople(me, people, goalWords(goal)).slice(0, 30);
      return {
        grounding: {
          event: EVENT_FACTS,
          goal,
          me: meView(me),
          agenda,
          tables,
          people: top,
          partners,
          output_limits: { people: 10, sessions: 8, tables: 5, partners: 5, reason_chars: REASON_MAX, summary_chars: SUMMARY_MAX },
        },
        allowed: { people: pick(top), sessions: pick(agenda), tables: pick(tables), partners: pick(partners) },
      };
    }
    case "profile_helper": {
      const about = typeof input.about === "string" ? input.about : "";
      return {
        grounding: {
          about,
          allowed_tags: TP_TAGS,
          allowed_verticals: YI_VERTICALS,
          output_limits: { needs: PROFILE_TAG_MAX, offers: PROFILE_TAG_MAX, pledge_chars: PROFILE_TEXT_MAX },
        },
        allowed: {},
      };
    }
    case "radar": {
      const people = await loadPeople(me);
      const needs = new Map<string, number>();
      const offers = new Map<string, number>();
      for (const p of people) {
        for (const n of new Set(p.needs)) needs.set(n, (needs.get(n) ?? 0) + 1);
        for (const o of new Set(p.offers)) offers.set(o, (offers.get(o) ?? 0) + 1);
      }
      const tally = (m: Map<string, number>) =>
        [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
      const myOffers = new Set(me.offers);
      const myNeeds = new Set(me.needs);
      const needMine = people.filter((p) => p.needs.some((n) => myOffers.has(n)));
      const offerMine = people.filter((p) => p.offers.some((o) => myNeeds.has(o)));
      const byOverlap = (xs: GroundPerson[], f: (p: GroundPerson) => number) =>
        [...xs].sort((a, b) => f(b) - f(a) || a.full_name.localeCompare(b.full_name)).slice(0, 20);
      const needYou = byOverlap(needMine, (p) => p.needs.filter((n) => myOffers.has(n)).length);
      const offerYou = byOverlap(offerMine, (p) => p.offers.filter((o) => myNeeds.has(o)).length);
      // Group-buy hint: people who share one of MY needs (they could buy together).
      const sameNeed = byOverlap(
        people.filter((p) => p.needs.some((n) => myNeeds.has(n))),
        (p) => p.needs.filter((n) => myNeeds.has(n)).length
      );
      const all = new Map<string, GroundPerson>();
      for (const p of [...needYou, ...offerYou, ...sameNeed]) all.set(p.id, p);
      return {
        grounding: {
          event: EVENT_FACTS,
          me: meView(me),
          directory_size: people.length,
          needs_across_directory: tally(needs),
          offers_across_directory: tally(offers),
          people_who_need_what_you_offer: needYou.map((p) => p.id),
          people_who_offer_what_you_need: offerYou.map((p) => p.id),
          people_who_share_your_needs: sameNeed.map((p) => p.id),
          people: [...all.values()],
          output_limits: { deals: 8, group_buys: 4, people_per_group_buy: 6, text_chars: 200, summary_chars: 600 },
        },
        allowed: { people: [...all.keys()] },
      };
    }
    case "why_meet": {
      const people = await loadPeople(me);
      const top = rankPeople(me, people).slice(0, 15);
      return {
        grounding: {
          me: meView(me),
          people: top,
          output_limits: { people: 15, reason_chars: REASON_MAX },
        },
        allowed: { people: pick(top) },
      };
    }
    case "ask": {
      const question = typeof input.question === "string" ? input.question : "";
      const [agenda, tables, meetings, people, myCircles] = await Promise.all([
        loadAgenda(),
        loadTables(me),
        getMyAcceptedMeetings(me.id),
        loadPeople(me),
        tpService()
          .from("tp_circle_members")
          .select("circle:tp_circles!inner(title, day, starts_at, place, status)")
          .eq("delegate_id", me.id)
          .eq("circle.status", "open"),
      ]);
      const listed = new Set(people.map((p) => p.id));
      const schedule = meetings.map((m) => {
        // A delegate's name appears only when they are in the directory.
        const otherId = m.other.startsWith("d:") ? m.other.slice(2) : null;
        const shown = m.kind === "partner" || (otherId !== null && listed.has(otherId));
        return {
          kind: m.kind === "partner" ? "Catalyst Partner meeting" : "Delegate meeting",
          with: shown ? m.title : "A fellow delegate",
          slot_key: m.slot_key,
          table_no: m.table_no,
        };
      });
      const circles = ((myCircles.data ?? []) as unknown as { circle: { title: string; day: number; starts_at: string; place: string } }[]).map(
        (r) => r.circle
      );
      return {
        grounding: {
          question,
          event: EVENT_FACTS,
          faq: FAQ,
          me: { full_name: me.full_name, chapter: me.chapter },
          agenda,
          tables,
          my_meetings: schedule,
          my_tables: circles,
          output_limits: { answer_chars: ANSWER_MAX },
        },
        allowed: { sessions: pick(agenda), tables: pick(tables) },
      };
    }
  }
  return null;
}
