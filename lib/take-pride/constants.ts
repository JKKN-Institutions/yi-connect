/** Take Pride 2026: fixed facts from the Catalyst Partner deck (Oct 2026). */
export const TP_EVENT = {
  name: "Take Pride 2026",
  theme: "The 1% Shift",
  tagline: "Small moves. Seismic outcomes.",
  dates: "18–19 December 2026",
  city: "Bengaluru",
  delegatesExpected: "1,200+",
  chapters: 71,
} as const;

/**
 * One shared vocabulary: what a delegate NEEDS and what a business OFFERS.
 * Matching is the overlap between a partner's offers and a delegate's needs,
 * so both sides must pick from this list.
 */
export const TP_TAGS = [
  "Manufacturing supplies",
  "IT services",
  "Marketing and branding",
  "Finance and funding",
  "Legal and compliance",
  "Logistics",
  "Food and beverage",
  "Hospitality",
  "Healthcare",
  "Education and training",
  "Real estate",
  "Renewable energy",
  "HR and hiring",
  "Exports",
  "Packaging",
  "Corporate gifting",
] as const;

export const TP_INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Energy", "Finance", "Food processing",
  "Healthcare", "Hospitality", "IT and software", "Logistics", "Manufacturing", "Media",
  "Pharma", "Real estate", "Retail", "Textiles",
] as const;

export const TP_ZONES = ["South", "West", "North", "East"] as const;

export const TP_PARTNER_STATUS_LABEL: Record<string, string> = {
  applied: "Waiting for payment",
  payment_submitted: "Payment sent, being confirmed",
  confirmed: "Confirmed Catalyst Partner",
  rejected: "Not confirmed",
};

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

/** Fee incl. GST, rounded to the rupee. */
export function withGst(amount: number, gstPct: number): number {
  return Math.round(amount * (1 + gstPct / 100));
}
