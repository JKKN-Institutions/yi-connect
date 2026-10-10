import type { TpDelegate, TpPartner } from "./types";

export type TpMatch = {
  delegate: TpDelegate;
  score: number;
  shared: string[];
  reason: string;
};

/**
 * Who a partner should meet. Deterministic, no AI: overlap between what the
 * partner offers and what the delegate needs (10 each), +5 when the delegate
 * works in an industry the partner targets, +2 for the same zone. A delegate
 * with no shared need never matches, and opted-out delegates are skipped.
 */
export function matchDelegates(partner: Pick<TpPartner, "offers" | "wants_industries" | "zone">, delegates: TpDelegate[]): TpMatch[] {
  const offers = new Set(partner.offers);
  const wants = new Set(partner.wants_industries);
  const out: TpMatch[] = [];
  for (const d of delegates) {
    if (!d.partner_meetings_opt_in) continue;
    const shared = d.needs.filter((n) => offers.has(n));
    if (shared.length === 0) continue;
    const industryHit = wants.has(d.industry);
    const zoneHit = !!partner.zone && partner.zone === d.zone;
    const score = shared.length * 10 + (industryHit ? 5 : 0) + (zoneHit ? 2 : 0);
    const bits = [`Needs ${shared.map((s) => s.toLowerCase()).join(" and ")}`];
    if (industryHit) bits.push(`works in ${d.industry.toLowerCase()}, an industry you target`);
    if (zoneHit) bits.push(`same zone`);
    out.push({ delegate: d, score, shared, reason: bits.join(" · ") });
  }
  return out.sort((a, b) => b.score - a.score || a.delegate.full_name.localeCompare(b.delegate.full_name));
}
