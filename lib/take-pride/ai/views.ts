import "server-only";

import { tpService } from "../supabase";
import type { RadarOutput, SummitPlanOutput } from "./schemas";

/*
 * Turn stored routine output into what a delegate's page shows. Every id is
 * looked up LIVE with the same privacy rules as the directory: a person
 * shows only while directory_visible and in the same sample / real world,
 * a table only while open, a partner only while confirmed. Anything that no
 * longer qualifies is silently left out. Card fields only: no contact data.
 *
 * Free text (summaries, reasons, deal and buy-together text) is the
 * routine's own words and is NOT regenerated when someone hides their
 * listing. Two guards cover it: the routine is told never to name people
 * in summaries or buy-together text (docs/take-pride-ai-routine.md), and
 * here the exact full name and business name of anyone the job was shown
 * who is no longer listed are masked in every text field. A buy-together
 * idea is dropped as a whole when any of its people is no longer listed.
 * A shortened name or nickname is not caught; that is the prompt's job.
 */

export type ViewPerson = {
  id: string;
  full_name: string;
  chapter: string;
  business_name: string | null;
  role_title: string | null;
  delegate_meetings_opt_in: boolean;
};

type Me = { id: string; is_sample: boolean };

export async function livePeople(me: Me, ids: string[]): Promise<Map<string, ViewPerson>> {
  const out = new Map<string, ViewPerson>();
  const want = [...new Set(ids)].filter((id) => id !== me.id);
  if (!want.length) return out;
  const { data, error } = await tpService()
    .from("tp_delegates")
    .select("id, full_name, chapter, business_name, role_title, delegate_meetings_opt_in")
    .in("id", want)
    .eq("directory_visible", true)
    .eq("is_sample", me.is_sample);
  if (error) return out;
  for (const p of (data ?? []) as ViewPerson[]) out.set(p.id, p);
  return out;
}

type Mask = { name: string; as: string };

/**
 * Names to mask: people the job referred to (pinned `allowed` ids plus ids
 * in the output) who are no longer listed now. Read with the service
 * client; the names never leave this module except as the mask target.
 */
async function hiddenNames(me: Me, ids: string[], live: Map<string, ViewPerson>): Promise<Mask[] | null> {
  const gone = [...new Set(ids)].filter((id) => id !== me.id && !live.has(id));
  if (!gone.length) return [];
  const { data, error } = await tpService()
    .from("tp_delegates")
    .select("full_name, business_name")
    .in("id", gone.slice(0, 200));
  // Fail closed: if the names cannot be read, the caller blanks free text.
  if (error) return null;
  const names = new Map<string, string>();
  for (const r of (data ?? []) as { full_name: string | null; business_name: string | null }[]) {
    const n = (r.full_name ?? "").trim();
    const b = (r.business_name ?? "").trim();
    if (n.length >= 3) names.set(n.toLowerCase(), "another delegate");
    if (b.length >= 3 && !names.has(b.toLowerCase())) names.set(b.toLowerCase(), "another business");
  }
  // Longest first, so "Lakshmi Foods Pvt Ltd" is masked before "Lakshmi Foods".
  return [...names.entries()].map(([name, as]) => ({ name, as })).sort((a, b) => b.name.length - a.name.length);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mask each hidden name in a text. Blank when the names could not be read. */
function mask(text: string, names: Mask[] | null): string {
  if (names === null) return "";
  if (!names.length) return text;
  let out = text;
  for (const n of names) {
    out = out.replace(new RegExp(escapeRe(n.name), "gi"), (_m, at: number, all: string) =>
      at === 0 || /[.!?]\s+$/.test(all.slice(0, at)) ? n.as[0].toUpperCase() + n.as.slice(1) : n.as
    );
  }
  return out;
}

export type PlanView = {
  summary: string;
  sessions: { id: string; reason: string; day: number; starts_at: string; title: string; hall: string }[];
  people: (ViewPerson & { reason: string })[];
  tables: { id: string; reason: string; title: string; day: number; starts_at: string; place: string }[];
  partners: { id: string; reason: string; business_name: string; industry: string }[];
};

export async function resolvePlan(me: Me, plan: SummitPlanOutput, allowedPeople: string[] = []): Promise<PlanView> {
  const db = tpService();
  const ids = (xs: { id: string }[]) => (xs.length ? xs.map((x) => x.id) : ["00000000-0000-0000-0000-000000000000"]);
  const [people, agenda, tables, partners] = await Promise.all([
    livePeople(me, plan.people.map((p) => p.id)),
    db.from("tp_agenda").select("id, day, starts_at, title, hall").in("id", ids(plan.sessions)),
    db
      .from("tp_circles")
      .select("id, title, day, starts_at, place")
      .in("id", ids(plan.tables))
      .eq("status", "open")
      .eq("is_sample", me.is_sample),
    db
      .from("tp_partners")
      .select("id, business_name, industry")
      .in("id", ids(plan.partners))
      .eq("status", "confirmed")
      .eq("is_sample", me.is_sample),
  ]);
  type A = { id: string; day: number; starts_at: string; title: string; hall: string };
  type T = { id: string; title: string; day: number; starts_at: string; place: string };
  type P = { id: string; business_name: string; industry: string };
  const aMap = new Map(((agenda.data ?? []) as A[]).map((x) => [x.id, x]));
  const tMap = new Map(((tables.data ?? []) as T[]).map((x) => [x.id, x]));
  const pMap = new Map(((partners.data ?? []) as P[]).map((x) => [x.id, x]));
  const names = await hiddenNames(me, [...allowedPeople, ...plan.people.map((p) => p.id)], people);
  const m = (t: string) => mask(t, names);
  return {
    summary: m(plan.summary),
    sessions: plan.sessions
      .filter((s) => aMap.has(s.id))
      .map((s) => ({ ...aMap.get(s.id)!, reason: m(s.reason) }))
      .sort((a, b) => a.day - b.day || a.starts_at.localeCompare(b.starts_at)),
    people: plan.people.filter((p) => people.has(p.id)).map((p) => ({ ...people.get(p.id)!, reason: m(p.reason) })),
    tables: plan.tables.filter((t) => tMap.has(t.id)).map((t) => ({ ...tMap.get(t.id)!, reason: m(t.reason) })),
    partners: plan.partners.filter((p) => pMap.has(p.id)).map((p) => ({ ...pMap.get(p.id)!, reason: m(p.reason) })),
  };
}

export type RadarView = {
  summary: string;
  deals: (ViewPerson & { text: string })[];
  groupBuys: { text: string; people: ViewPerson[] }[];
};

export async function resolveRadar(me: Me, r: RadarOutput, allowedPeople: string[] = []): Promise<RadarView> {
  const referenced = [...r.deals.map((d) => d.person_id), ...r.group_buys.flatMap((g) => g.person_ids)];
  const people = await livePeople(me, referenced);
  const names = await hiddenNames(me, [...allowedPeople, ...referenced], people);
  const m = (t: string) => mask(t, names);
  return {
    summary: m(r.summary),
    deals: r.deals
      .filter((d) => people.has(d.person_id))
      .map((d) => ({ ...people.get(d.person_id)!, text: m(d.text) })),
    // A buy-together idea names a group; if anyone in it is no longer
    // listed, the whole idea goes, text included.
    groupBuys: r.group_buys
      .filter((g) => g.person_ids.length > 0 && g.person_ids.every((id) => people.has(id)))
      .map((g) => ({ text: m(g.text), people: g.person_ids.map((id) => people.get(id)!) })),
  };
}
