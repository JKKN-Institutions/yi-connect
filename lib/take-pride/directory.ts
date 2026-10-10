import "server-only";

import { tpService } from "./supabase";
import { isToken } from "./auth";
import { TP_ZONES } from "./constants";
import { YI_VERTICALS, type TpDelegateProfile } from "./profile";

/*
 * Delegate profile reads + the delegate directory. Reached only after the
 * caller holds a delegate's secret pass token; "me" is ALWAYS resolved from
 * that token, never from an id the browser sends.
 *
 * Privacy: the directory lists ONLY delegates who switched on
 * directory_visible (default off), and only the card fields below. Tokens,
 * badge codes and check-in data are never selected for other people. The
 * table holds no phone or email, and none is ever shown here.
 */

const PROFILE_COLS =
  "id, token, full_name, chapter, zone, business_name, industry, role_title, needs, offers, partner_meetings_opt_in, delegate_meetings_opt_in, is_sample, working_on, ask_me_about, yi_vertical, pledge, chapter_strengths, chapter_wants, directory_visible";

/** What another delegate may see of someone listed in the directory. */
const CARD_COLS =
  "id, full_name, role_title, business_name, chapter, zone, industry, yi_vertical, working_on, ask_me_about, pledge, needs, offers, chapter_strengths, delegate_meetings_opt_in";

export type DirectoryPerson = {
  id: string;
  full_name: string;
  role_title: string | null;
  business_name: string | null;
  chapter: string;
  zone: string;
  industry: string;
  yi_vertical: string | null;
  working_on: string | null;
  ask_me_about: string | null;
  pledge: string | null;
  needs: string[];
  offers: string[];
  chapter_strengths: string[];
  delegate_meetings_opt_in: boolean;
};

export async function getDelegateProfileByToken(token: string): Promise<TpDelegateProfile | null> {
  if (!isToken(token)) return null;
  const { data, error } = await tpService().from("tp_delegates").select(PROFILE_COLS).eq("token", token).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TpDelegateProfile | null) ?? null;
}

/** My pledge for the pass page. Returns null rather than failing, so the pass always loads. */
export async function getMyPledge(delegateId: string): Promise<string | null> {
  const { data, error } = await tpService().from("tp_delegates").select("pledge").eq("id", delegateId).maybeSingle();
  if (error || !data) return null;
  return (data as { pledge: string | null }).pledge ?? null;
}

/**
 * Everyone listed in the directory except me. Sample delegates only see
 * sample delegates and real delegates only see real ones, so a real delegate
 * is never pointed at a demo person.
 */
export async function getDirectoryPeople(me: Pick<TpDelegateProfile, "id" | "is_sample">): Promise<DirectoryPerson[]> {
  const { data, error } = await tpService()
    .from("tp_delegates")
    .select(CARD_COLS)
    .eq("directory_visible", true)
    .eq("is_sample", me.is_sample)
    .neq("id", me.id)
    .order("full_name")
    .limit(5000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DirectoryPerson[]).map((p) => ({
    ...p,
    needs: p.needs ?? [],
    offers: p.offers ?? [],
    chapter_strengths: p.chapter_strengths ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Filters (pure)

export const SEARCH_MAX = 60;

export type DirectoryFilters = {
  q: string;
  zone: string;
  industry: string;
  vertical: string;
  /** They need something I offer. */
  theyNeed: boolean;
  /** They offer something I need. */
  theyOffer: boolean;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Read filters from the URL. Anything not on a known list is ignored. */
export function parseDirectoryFilters(sp: Params, industries: readonly string[]): DirectoryFilters {
  const zone = one(sp.zone);
  const industry = one(sp.industry);
  const vertical = one(sp.vertical);
  return {
    q: one(sp.q).replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX),
    zone: (TP_ZONES as readonly string[]).includes(zone) ? zone : "",
    industry: industries.includes(industry) ? industry : "",
    vertical: (YI_VERTICALS as readonly string[]).includes(vertical) ? vertical : "",
    theyNeed: one(sp.theyneed) === "1",
    theyOffer: one(sp.theyoffer) === "1",
  };
}

export function hasFilters(f: DirectoryFilters): boolean {
  return !!(f.q || f.zone || f.industry || f.vertical || f.theyNeed || f.theyOffer);
}

const lower = (xs: string[]) => xs.map((s) => s.toLowerCase()).join(", ");

/** Why this person is a fit for me, from needs / offers. Empty when there is no overlap. */
export function fitLine(p: DirectoryPerson, me: Pick<TpDelegateProfile, "needs" | "offers">): string {
  const theyHelpMe = p.offers.filter((o) => me.needs.includes(o));
  const iHelpThem = p.needs.filter((n) => me.offers.includes(n));
  const bits: string[] = [];
  if (theyHelpMe.length) bits.push(`Offers ${lower(theyHelpMe)}, which you need`);
  if (iHelpThem.length) bits.push(`Needs ${lower(iHelpThem)}, which you offer`);
  return bits.join(" · ");
}

export function filterDirectory(
  people: DirectoryPerson[],
  me: Pick<TpDelegateProfile, "needs" | "offers">,
  f: DirectoryFilters
): DirectoryPerson[] {
  const q = f.q.toLowerCase();
  return people.filter((p) => {
    if (f.zone && p.zone !== f.zone) return false;
    if (f.industry && p.industry !== f.industry) return false;
    if (f.vertical && p.yi_vertical !== f.vertical) return false;
    if (f.theyNeed && !p.needs.some((n) => me.offers.includes(n))) return false;
    if (f.theyOffer && !p.offers.some((o) => me.needs.includes(o))) return false;
    if (q) {
      const hay = [p.full_name, p.chapter, p.business_name ?? "", p.working_on ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Chapter twins (pure)

export type ChapterTwin = {
  chapter: string;
  zone: string;
  /** My chapter's wants that this chapter says it does well. */
  matched: string[];
  people: Pick<DirectoryPerson, "id" | "full_name" | "role_title" | "delegate_meetings_opt_in">[];
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Chapters that do well what my chapter wants help with. A chapter's
 * strengths are everything its listed delegates named. Ranked by how many
 * of my wants it covers, then by how many of its delegates named them.
 * Deterministic, no AI.
 */
export function chapterTwins(
  people: DirectoryPerson[],
  me: Pick<TpDelegateProfile, "chapter" | "chapter_wants">,
  limit = 5
): ChapterTwin[] {
  const wants = [...new Set(me.chapter_wants)];
  if (!wants.length) return [];
  const mine = norm(me.chapter);
  const byChapter = new Map<string, DirectoryPerson[]>();
  for (const p of people) {
    if (norm(p.chapter) === mine) continue;
    byChapter.set(p.chapter, [...(byChapter.get(p.chapter) ?? []), p]);
  }
  const out: (ChapterTwin & { score: number })[] = [];
  for (const [chapter, ps] of byChapter) {
    const votes = new Map<string, number>();
    for (const p of ps) for (const s of new Set(p.chapter_strengths)) votes.set(s, (votes.get(s) ?? 0) + 1);
    const matched = wants.filter((w) => votes.has(w));
    if (!matched.length) continue;
    const covers = (p: DirectoryPerson) => matched.filter((m) => p.chapter_strengths.includes(m)).length;
    const picked = [...ps]
      .filter((p) => covers(p) > 0)
      .sort((a, b) => covers(b) - covers(a) || a.full_name.localeCompare(b.full_name))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role_title: p.role_title,
        delegate_meetings_opt_in: p.delegate_meetings_opt_in,
      }));
    out.push({
      chapter,
      zone: ps[0].zone,
      matched,
      people: picked,
      score: matched.length * 1000 + matched.reduce((n, m) => n + (votes.get(m) ?? 0), 0),
    });
  }
  return out
    .sort((a, b) => b.score - a.score || a.chapter.localeCompare(b.chapter))
    .slice(0, limit)
    .map((t) => ({ chapter: t.chapter, zone: t.zone, matched: t.matched, people: t.people }));
}
