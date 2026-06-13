/**
 * In-app adaptive guide — shared contract.
 *
 * One guide system, four lanes. Each persona's lane is authored as plain-
 * language sections (12th-grade reading level) adapted from docs/yip-guides.
 * The viewer's lane is chosen by WHERE they are in the app (each layout knows
 * its persona), so there is no fragile identity-sniffing.
 *
 * Plain types module — NO "use server". Safe to import from client + server.
 */

export type GuidePersona = "organiser" | "student" | "volunteer" | "jury";

/**
 * A "Take me there →" deep link inside a section. `href` MAY contain the literal
 * token `:eventId`, resolved at render time against the viewer's current event
 * (organiser event-scoped tabs + student /me pages). When a link needs an event
 * and none is in context, the drawer hides that link rather than producing a
 * broken URL.
 */
export interface GuideLink {
  /** Button label, e.g. "Open Allocation". */
  label: string;
  /** App route. May contain `:eventId`, e.g. "/yip/dashboard/events/:eventId/allocation". */
  href: string;
}

export interface GuideSection {
  /** Stable kebab-case anchor id. */
  id: string;
  /** Short, action-oriented heading, e.g. "Set up parties & seats". */
  title: string;
  /** 1–2 plain sentences a 12th-grader understands. */
  summary: string;
  /** Ordered, imperative steps ("Click …", "Open …"). Optional. */
  steps?: string[];
  /** Short callouts / gotchas. Optional. */
  tips?: string[];
  /** Deep links to the real pages this section talks about. Optional. */
  links?: GuideLink[];
}

export interface PersonaGuide {
  persona: GuidePersona;
  /** Lane title, e.g. "Organiser Guide". */
  title: string;
  /** One line: what this person does on the platform. */
  tagline: string;
  /** Public path to the downloadable PDF, e.g. "/yip/guides/organiser.pdf". */
  pdfPath: string;
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
