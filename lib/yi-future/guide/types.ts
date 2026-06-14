/**
 * Yi Future 6.0 — in-app guide shared contract.
 *
 * One guide system, six lanes (national / chapter / delegate / mentor / jury /
 * partner). Each persona's lane is authored as plain-language sections
 * (12th-grade reading level). The content is PURE DATA (strings only — no JSX,
 * no I/O) so the SAME model drives every renderer without drift:
 *   - full page:   app/yi-future/guide/page.tsx + app/yi-future/_components/GuideView.tsx
 *   - in-app drawer: components/yi-future/guide/guide-drawer.tsx
 *
 * Model mirrors lib/yip/guide/types.ts, adapted for Yi Future:
 *   - links are PER-STEP (`step.link`) so every step can carry its own
 *     "Take me there →" deep-link button — the durable launchpad;
 *   - a short `journey` per lane shows the whole arc at a glance;
 *   - a single shared `glossary` kills the jargon once, up front.
 *
 * Yi Future routes are static (no event-scoped organiser tabs like YIP), so
 * there is no `:eventId` token to resolve — a link's `href` is used as-is.
 *
 * Plain types module — NO "use server". Safe to import from client + server.
 */

export type GuidePersona =
  | "national"
  | "chapter"
  | "delegate"
  | "mentor"
  | "jury"
  | "partner";

/** A "Take me there →" deep link for a single step. */
export interface GuideLink {
  /** Button label, e.g. "Open Editions". */
  label: string;
  /** App route, e.g. "/yi-future/national/admin/editions". */
  href: string;
}

export interface GuideStep {
  /** Imperative one-liner — the single thing to do. May contain `**bold**`. */
  action: string;
  /** One sentence of plain-language help (optional). May contain `**bold**`. */
  detail?: string;
  /** A highlighted tip / watch-out (optional). May contain `**bold**`. */
  tip?: string;
  /** "Take me there" link to the actual page this step describes (optional). */
  link?: GuideLink;
}

export interface GuideSection {
  /** Stable kebab-case anchor id. */
  id: string;
  /** Short, action-oriented heading, e.g. "Open the active edition". */
  title: string;
  /** One action per step. */
  steps: GuideStep[];
}

export interface PersonaGuide {
  persona: GuidePersona;
  /** Lane title, e.g. "National Admin Guide". */
  title: string;
  /** One line: what this person does on the platform. */
  tagline: string;
  /** Why getting this right matters — opens the lane with the stake (optional). */
  whyItMatters?: string;
  /** The one tap into the product to begin (optional). */
  startHere?: GuideLink;
  /** The whole arc as a few short phrases — rendered as a journey strip. */
  journey: string[];
  sections: GuideSection[];
}

/** A jargon term and its plain-language definition. */
export interface GlossaryItem {
  term: string;
  def: string;
}

export interface GuideBook {
  lanes: Record<GuidePersona, PersonaGuide>;
  /** Shared "Words to know" — the true jargon, defined once. */
  glossary: GlossaryItem[];
  /** Sets the locale expectation without shipping machine-translated copy. */
  plannedLocaleNote?: string;
}

export const GUIDE_PERSONAS: readonly GuidePersona[] = [
  "national",
  "chapter",
  "delegate",
  "mentor",
  "jury",
  "partner",
] as const;

/** Type guard for an untrusted ?persona= query value. */
export function isGuidePersona(
  v: string | null | undefined
): v is GuidePersona {
  return (
    v === "national" ||
    v === "chapter" ||
    v === "delegate" ||
    v === "mentor" ||
    v === "jury" ||
    v === "partner"
  );
}
