import "server-only";

import { tpService } from "../supabase";
import type { RadarOutput, SummitPlanOutput } from "./schemas";

/*
 * Turn stored routine output into what a delegate's page shows. Every id is
 * looked up LIVE with the same privacy rules as the directory: a person
 * shows only while directory_visible and in the same sample / real world,
 * a table only while open, a partner only while confirmed. Anything that no
 * longer qualifies is silently left out. Card fields only: no contact data.
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

export type PlanView = {
  summary: string;
  sessions: { id: string; reason: string; day: number; starts_at: string; title: string; hall: string }[];
  people: (ViewPerson & { reason: string })[];
  tables: { id: string; reason: string; title: string; day: number; starts_at: string; place: string }[];
  partners: { id: string; reason: string; business_name: string; industry: string }[];
};

export async function resolvePlan(me: Me, plan: SummitPlanOutput): Promise<PlanView> {
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
  return {
    summary: plan.summary,
    sessions: plan.sessions
      .filter((s) => aMap.has(s.id))
      .map((s) => ({ ...aMap.get(s.id)!, reason: s.reason }))
      .sort((a, b) => a.day - b.day || a.starts_at.localeCompare(b.starts_at)),
    people: plan.people.filter((p) => people.has(p.id)).map((p) => ({ ...people.get(p.id)!, reason: p.reason })),
    tables: plan.tables.filter((t) => tMap.has(t.id)).map((t) => ({ ...tMap.get(t.id)!, reason: t.reason })),
    partners: plan.partners.filter((p) => pMap.has(p.id)).map((p) => ({ ...pMap.get(p.id)!, reason: p.reason })),
  };
}

export type RadarView = {
  summary: string;
  deals: (ViewPerson & { text: string })[];
  groupBuys: { text: string; people: ViewPerson[] }[];
};

export async function resolveRadar(me: Me, r: RadarOutput): Promise<RadarView> {
  const people = await livePeople(me, [...r.deals.map((d) => d.person_id), ...r.group_buys.flatMap((g) => g.person_ids)]);
  return {
    summary: r.summary,
    deals: r.deals.filter((d) => people.has(d.person_id)).map((d) => ({ ...people.get(d.person_id)!, text: d.text })),
    groupBuys: r.group_buys.map((g) => ({
      text: g.text,
      people: g.person_ids.filter((id) => people.has(id)).map((id) => people.get(id)!),
    })),
  };
}
