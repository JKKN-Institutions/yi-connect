import "server-only";

import { tpService } from "./supabase";
import { isToken } from "./auth";
import type { TpDelegate } from "./types";

/*
 * Delegate-to-delegate "who to meet". Everything here is reached only after
 * the caller holds a delegate's secret pass token; "me" is ALWAYS resolved
 * from that token, never from an id the browser sends.
 *
 * Privacy: other delegates are shown by full name only (they are at the same
 * event). Business and chapter appear only once a meeting is accepted. No
 * phone or email exists in these tables and none is ever selected.
 */

export const DELEGATE_MEET_CAP = 20;
export const DELEGATE_NOTE_MAX = 140;
const SUGGESTION_LIMIT = 30;

export type TpDelegateMe = TpDelegate & { delegate_meetings_opt_in: boolean };

/** The fields of another delegate the matcher needs. Never shown raw. */
type Candidate = {
  id: string;
  full_name: string;
  zone: string;
  needs: string[];
  offers: string[];
  delegate_meetings_opt_in: boolean;
};

export type DelegateSuggestion = { id: string; full_name: string; reason: string; score: number };

export type DelegateMeetStatus = "requested" | "accepted" | "declined";

export type DelegateMeetRow = {
  id: string;
  status: DelegateMeetStatus;
  note: string | null;
  created_at: string;
  responded_at: string | null;
  other: {
    full_name: string;
    /** Only filled in when status is "accepted". */
    business_name: string | null;
    chapter: string | null;
  };
};

const ME_COLS =
  "id, token, badge_code, full_name, chapter, zone, business_name, industry, role_title, needs, offers, partner_meetings_opt_in, delegate_meetings_opt_in, checked_in_at, is_sample";

export async function getDelegateMeByToken(token: string): Promise<TpDelegateMe | null> {
  if (!isToken(token)) return null;
  const { data } = await tpService().from("tp_delegates").select(ME_COLS).eq("token", token).maybeSingle();
  return (data as TpDelegateMe | null) ?? null;
}

const lower = (xs: string[]) => xs.map((s) => s.toLowerCase()).join(" and ");

/**
 * Deterministic, no AI. 10 points for each thing they offer that I need,
 * 10 for each thing they need that I offer, +2 for the same zone. At least
 * one shared tag is required: zone alone never makes a match.
 */
export function suggestDelegates(
  me: Pick<TpDelegateMe, "id" | "zone" | "needs" | "offers">,
  others: Candidate[],
  exclude: Set<string> = new Set()
): DelegateSuggestion[] {
  const myNeeds = new Set(me.needs);
  const myOffers = new Set(me.offers);
  const out: DelegateSuggestion[] = [];
  for (const d of others) {
    if (d.id === me.id || !d.delegate_meetings_opt_in || exclude.has(d.id)) continue;
    const theyHelpMe = d.offers.filter((o) => myNeeds.has(o));
    const iHelpThem = d.needs.filter((n) => myOffers.has(n));
    if (theyHelpMe.length + iHelpThem.length === 0) continue;
    const sameZone = !!me.zone && me.zone === d.zone;
    const bits: string[] = [];
    if (theyHelpMe.length) bits.push(`Offers ${lower(theyHelpMe)}, which you need`);
    if (iHelpThem.length) bits.push(`Needs ${lower(iHelpThem)}, which you offer`);
    if (sameZone) bits.push(`Same zone (${d.zone})`);
    out.push({
      id: d.id,
      full_name: d.full_name,
      reason: bits.join(" · "),
      score: (theyHelpMe.length + iHelpThem.length) * 10 + (sameZone ? 2 : 0),
    });
  }
  return out
    .sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name))
    .slice(0, SUGGESTION_LIMIT);
}

type RawMeet = {
  id: string;
  from_delegate_id: string;
  to_delegate_id: string;
  status: DelegateMeetStatus;
  note: string | null;
  created_at: string;
  responded_at: string | null;
};

export type DelegateMeetBoard = {
  suggestions: DelegateSuggestion[];
  incoming: DelegateMeetRow[];
  outgoing: DelegateMeetRow[];
  openOutgoing: number;
};

/** Everything the /meet page needs for one delegate. */
export async function getDelegateMeetBoard(me: TpDelegateMe): Promise<DelegateMeetBoard> {
  const db = tpService();
  const [c, m] = await Promise.all([
    db
      .from("tp_delegates")
      .select("id, full_name, zone, needs, offers, delegate_meetings_opt_in")
      .neq("id", me.id)
      .limit(5000),
    db
      .from("tp_delegate_meetings")
      .select("id, from_delegate_id, to_delegate_id, status, note, created_at, responded_at")
      .or(`from_delegate_id.eq.${me.id},to_delegate_id.eq.${me.id}`)
      .order("created_at", { ascending: false }),
  ]);
  if (c.error) throw new Error(c.error.message);
  if (m.error) throw new Error(m.error.message);
  const meets = (m.data ?? []) as RawMeet[];
  const otherIds = [...new Set(meets.map((x) => (x.from_delegate_id === me.id ? x.to_delegate_id : x.from_delegate_id)))];

  // Business + chapter are fetched only for people I have an ACCEPTED meeting with.
  const acceptedIds = new Set(
    meets
      .filter((x) => x.status === "accepted")
      .map((x) => (x.from_delegate_id === me.id ? x.to_delegate_id : x.from_delegate_id))
  );
  const names = new Map<string, string>();
  for (const d of (c.data ?? []) as Candidate[]) names.set(d.id, d.full_name);
  const details = new Map<string, { business_name: string | null; chapter: string }>();
  if (acceptedIds.size) {
    const { data, error } = await db
      .from("tp_delegates")
      .select("id, business_name, chapter")
      .in("id", [...acceptedIds]);
    if (error) throw new Error(error.message);
    for (const d of (data ?? []) as { id: string; business_name: string | null; chapter: string }[]) details.set(d.id, d);
  }

  const toRow = (x: RawMeet): DelegateMeetRow => {
    const otherId = x.from_delegate_id === me.id ? x.to_delegate_id : x.from_delegate_id;
    const det = x.status === "accepted" ? details.get(otherId) : undefined;
    return {
      id: x.id,
      status: x.status,
      note: x.note,
      created_at: x.created_at,
      responded_at: x.responded_at,
      other: {
        full_name: names.get(otherId) ?? "A delegate",
        business_name: det?.business_name ?? null,
        chapter: det?.chapter ?? null,
      },
    };
  };

  const outgoing = meets.filter((x) => x.from_delegate_id === me.id);
  return {
    suggestions: suggestDelegates(me, (c.data ?? []) as Candidate[], new Set(otherIds)),
    incoming: meets.filter((x) => x.to_delegate_id === me.id).map(toRow),
    outgoing: outgoing.map(toRow),
    openOutgoing: outgoing.filter((x) => x.status === "requested").length,
  };
}

/**
 * Incoming requests still waiting for my answer. Used for the badge on the
 * pass page; returns 0 rather than failing so the pass itself always loads.
 */
export async function countIncomingPending(delegateId: string): Promise<number> {
  const { count, error } = await tpService()
    .from("tp_delegate_meetings")
    .select("id", { count: "exact", head: true })
    .eq("to_delegate_id", delegateId)
    .eq("status", "requested");
  if (error) return 0;
  return count ?? 0;
}
