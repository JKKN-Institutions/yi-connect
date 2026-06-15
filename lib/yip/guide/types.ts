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

/* ────────────────────────────────────────────────────────────────────────
 * ADOPTION LAYER — progress + instrumentation (all OPTIONAL).
 *
 * Pure helpers + types only (no JSX, no I/O) so this stays importable from
 * client AND server. A renderer with no progress/event props just shows the
 * plain guide (graceful degradation). Mirrors lib/yuva/guide/content.ts,
 * adapted to YIP's GuidePersona + section/step shape.
 * ──────────────────────────────────────────────────────────────────────── */

/** Stable key for one step within a lane: "<sectionIndex>:<stepIndex>". Index-
 *  based so editing a step's text never shifts a saved completion (only
 *  reordering would — the guide's order is stable). */
export function stepKey(sectionIndex: number, stepIndex: number): string {
  return `${sectionIndex}:${stepIndex}`;
}

/** Every step key in a lane, in order — the full checklist for that persona. */
export function laneStepKeys(lane: PersonaGuide): string[] {
  return lane.sections.flatMap((s, si) => s.steps.map((_, i) => stepKey(si, i)));
}

export interface LaneProgress {
  total: number;
  done: number;
  /** 0–100, for a progress bar. */
  percent: number;
  complete: boolean;
}

export function laneProgress(
  lane: PersonaGuide,
  completed: ReadonlySet<string>
): LaneProgress {
  const keys = laneStepKeys(lane);
  const done = keys.filter((k) => completed.has(k)).length;
  const total = keys.length;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    complete: total > 0 && done === total,
  };
}

export interface NextStep {
  sectionIndex: number;
  sectionTitle: string;
  stepIndex: number;
  key: string;
  step: GuideStep;
}

/** The viewer's next unfinished step (for resume + nudges), or null if done. */
export function nextUndoneStep(
  lane: PersonaGuide,
  completed: ReadonlySet<string>
): NextStep | null {
  for (let si = 0; si < lane.sections.length; si++) {
    const s = lane.sections[si];
    for (let i = 0; i < s.steps.length; i++) {
      const key = stepKey(si, i);
      if (!completed.has(key)) {
        return { sectionIndex: si, sectionTitle: s.title, stepIndex: i, key, step: s.steps[i] };
      }
    }
  }
  return null;
}

/* ── Onboarding entry (Start / Resume / Replay) ───────────────────────────
 * The start-vs-resume-vs-replay decision is derived PURELY from saved progress,
 * never a "first login" flag — that is what lets someone who SKIPPED onboarding
 * pick it up later (non-empty-but-incomplete set → "resume"). */
export type OnboardingKind = "start" | "resume" | "replay";

export interface OnboardingCta {
  kind: OnboardingKind;
  label: string;
  remaining: number;
  target: NextStep | null;
  complete: boolean;
}

export function onboardingCta(
  lane: PersonaGuide,
  completed: ReadonlySet<string>
): OnboardingCta {
  const lp = laneProgress(lane, completed);
  const next = nextUndoneStep(lane, completed);
  if (lp.done === 0) {
    return { kind: "start", label: "Start onboarding", remaining: lp.total, target: next, complete: false };
  }
  if (next) {
    return { kind: "resume", label: "Resume onboarding", remaining: lp.total - lp.done, target: next, complete: false };
  }
  return { kind: "replay", label: "Replay walkthrough", remaining: 0, target: nextUndoneStep(lane, new Set()), complete: true };
}

/** Synthetic progress key marking that a viewer saw a module's first-entry
 *  welcome. Stored in guide_progress (so it syncs across devices) but excluded
 *  from laneStepKeys, so it never inflates lane progress or becomes a next step. */
export function welcomeSeenKey(moduleKey: string): string {
  return `__welcome__:${moduleKey}`;
}

/* ── Instrumentation ──────────────────────────────────────────────────────
 * Every meaningful guide interaction, for MEASURING adoption. logGuideEvent is
 * a public ("use server") endpoint, so the runtime allow-list arrays below are
 * the source of truth it validates against — a name added to the union but NOT
 * the array is dropped silently. Keep BOTH in sync. */
export type GuideEventName =
  | "guide_open"
  | "lane_switch"
  | "step_link_click"
  | "step_complete"
  | "step_uncomplete"
  | "lane_complete"
  | "pdf_download"
  | "nudge_click"
  | "onboarding_start"
  | "welcome_shown"
  | "guide_dismiss";

export type GuideSurface =
  | "page"
  | "drawer"
  | "launcher"
  | "nudge"
  | "widget"
  | "welcome"
  | "onboarding";

export interface GuideEvent {
  name: GuideEventName;
  persona: GuidePersona;
  surface: GuideSurface;
  /** Step key when relevant (complete / uncomplete / link click / welcome moduleKey). */
  stepKey?: string;
  /** Free context (e.g. a route, or the onboarding kind start|resume|replay). */
  context?: string;
}

/** Optional callback the renderers fire on each interaction. No-op when unset. */
export type GuideEventSink = (event: GuideEvent) => void;

/** Runtime allow-lists — logGuideEvent is a public endpoint; validate against
 *  THESE before insert so a caller can't poison the metrics table. */
export const GUIDE_EVENT_NAMES: readonly GuideEventName[] = [
  "guide_open",
  "lane_switch",
  "step_link_click",
  "step_complete",
  "step_uncomplete",
  "lane_complete",
  "pdf_download",
  "nudge_click",
  "onboarding_start",
  "welcome_shown",
  "guide_dismiss",
] as const;

export const GUIDE_SURFACES: readonly GuideSurface[] = [
  "page",
  "drawer",
  "launcher",
  "nudge",
  "widget",
  "welcome",
  "onboarding",
] as const;
