/**
 * In-app adaptive guide — shared contract.
 *
 * One guide system, four lanes (organiser / student / volunteer / jury). Each
 * persona's lane is authored as plain-language sections (12th-grade reading
 * level). The content is PURE DATA (strings only — no JSX, no I/O) so the SAME
 * model drives every renderer without drift:
 *   - full page:  app/yip/guide/page.tsx + app/yip/_components/GuideView.tsx
 *   - in-app drawer:  components/yip/guide/guide-drawer.tsx
 *   - static PDF:  public/yip/guides/{persona}.pdf (downloadable / shareable)
 *
 * Model (mirrors lib/yuva/guide/content.ts, adapted for YIP):
 *   - links are PER-STEP (`step.link`), so every step can carry its own
 *     "Take me there →" deep-link button — this is the durable launchpad.
 *   - a short `journey` map per lane shows the whole arc at a glance.
 *
 * Plain types module — NO "use server". Safe to import from client + server.
 */

export type GuidePersona = "organiser" | "student" | "volunteer" | "jury";

/**
 * A "Take me there →" deep link for a single step. `href` MAY contain the
 * literal token `:eventId`, resolved at render time against the viewer's
 * current event (organiser event-scoped tabs). When a link needs an event and
 * none is in context, the renderer hides that link rather than producing a
 * broken URL.
 */
export interface GuideLink {
  /** Button label, e.g. "Open Allocation". */
  label: string;
  /** App route. May contain `:eventId`, e.g. "/yip/dashboard/events/:eventId/allocation". */
  href: string;
}

/**
 * An optional screenshot for a step. Unused today (the live screens move fast
 * and shots rot) — kept in the contract so a future stable entry-moment shot
 * can be added without a model change. Assets would live in public/yip/guides/.
 */
export interface GuideImage {
  src: string;
  alt: string;
  /** Intrinsic pixel size — drives aspect ratio in the renderer. */
  width: number;
  height: number;
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
  /** A screenshot of this moment (optional — reserved, unused today). */
  image?: GuideImage;
}

export interface GuideSection {
  /** Stable kebab-case anchor id. */
  id: string;
  /** Short, action-oriented heading, e.g. "Set up parties & seats". */
  title: string;
  /** One action per step. */
  steps: GuideStep[];
}

export interface PersonaGuide {
  persona: GuidePersona;
  /** Lane title, e.g. "Organiser Guide". */
  title: string;
  /** One line: what this person does on the platform. */
  tagline: string;
  /** Public path to the downloadable PDF, e.g. "/yip/guides/organiser.pdf". */
  pdfPath: string;
  /** The whole arc as a few short phrases — rendered as a journey strip. */
  journey: string[];
  sections: GuideSection[];
}

export type GuideBook = Record<GuidePersona, PersonaGuide>;

/** Resolve `:eventId` tokens in a link href; returns null if the link needs an
 *  event id and none is available (caller hides the link). */
export function resolveGuideHref(
  href: string,
  eventId: string | null | undefined
): string | null {
  if (!href.includes(":eventId")) return href;
  if (!eventId) return null;
  return href.replaceAll(":eventId", eventId);
}

/** Type guard for an untrusted ?persona= query value. */
export function isGuidePersona(v: string | null | undefined): v is GuidePersona {
  return v === "organiser" || v === "student" || v === "volunteer" || v === "jury";
}

export const GUIDE_PERSONAS: readonly GuidePersona[] = [
  "organiser",
  "student",
  "volunteer",
  "jury",
] as const;
