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

/* ── Adoption layer: progress + instrumentation (all OPTIONAL) ─────────────
 * Pure helpers + types only (no I/O) so this stays importable from client AND
 * server. A renderer with no progress/event props just shows the plain guide.
 * Mirrors lib/yuva/guide/content.ts, adapted to Yi Future's PersonaGuide model
 * (sections carry a stable `id`, steps carry `action`/`detail`/`tip`/`link`).
 * ────────────────────────────────────────────────────────────────────────── */

/** Stable key for one step within a lane: "<sectionIndex>:<stepIndex>". Index-
 *  based so editing a step's text never shifts a saved completion (only
 *  reordering would — the guide's order is stable). */
export function stepKey(sectionIndex: number, stepIndex: number): string {
  return `${sectionIndex}:${stepIndex}`;
}

/** Every step key in a lane, in order — the full checklist for that lane. */
export function laneStepKeys(content: PersonaGuide): string[] {
  return content.sections.flatMap((s, si) =>
    s.steps.map((_, i) => stepKey(si, i))
  );
}

export type LaneProgress = {
  total: number;
  done: number;
  /** 0–100, for a progress bar. */
  percent: number;
  complete: boolean;
};

export function laneProgress(
  content: PersonaGuide,
  completed: ReadonlySet<string>
): LaneProgress {
  const keys = laneStepKeys(content);
  const done = keys.filter((k) => completed.has(k)).length;
  const total = keys.length;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    complete: total > 0 && done === total,
  };
}

export type NextStep = {
  sectionIndex: number;
  sectionTitle: string;
  stepIndex: number;
  key: string;
  step: GuideStep;
};

/** The viewer's next unfinished step (for resume + nudges), or null if done. */
export function nextUndoneStep(
  content: PersonaGuide,
  completed: ReadonlySet<string>
): NextStep | null {
  for (let si = 0; si < content.sections.length; si++) {
    const s = content.sections[si];
    for (let i = 0; i < s.steps.length; i++) {
      const key = stepKey(si, i);
      if (!completed.has(key)) {
        return {
          sectionIndex: si,
          sectionTitle: s.title,
          stepIndex: i,
          key,
          step: s.steps[i],
        };
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
export type OnboardingCta = {
  kind: OnboardingKind;
  label: string;
  remaining: number;
  target: NextStep | null;
  complete: boolean;
};

export function onboardingCta(
  content: PersonaGuide,
  completed: ReadonlySet<string>
): OnboardingCta {
  const lp = laneProgress(content, completed);
  const next = nextUndoneStep(content, completed);
  if (lp.done === 0) {
    return {
      kind: "start",
      label: "Start onboarding",
      remaining: lp.total,
      target: next,
      complete: false,
    };
  }
  if (next) {
    return {
      kind: "resume",
      label: "Resume onboarding",
      remaining: lp.total - lp.done,
      target: next,
      complete: false,
    };
  }
  return {
    kind: "replay",
    label: "Replay walkthrough",
    remaining: 0,
    target: nextUndoneStep(content, new Set()),
    complete: true,
  };
}

/** Synthetic progress key marking that a viewer saw a module's first-entry
 *  welcome. Stored in guide_progress (so it syncs across devices) but excluded
 *  from laneStepKeys, so it never inflates lane progress or becomes a next step. */
export function welcomeSeenKey(moduleKey: string): string {
  return `__welcome__:${moduleKey}`;
}

/* ── Instrumentation ──────────────────────────────────────────────────── */

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

export type GuideEvent = {
  name: GuideEventName;
  persona: GuidePersona;
  surface: GuideSurface;
  stepKey?: string;
  context?: string;
};

/** Runtime allow-lists — logGuideEvent is a public endpoint; validate against
 *  these before insert so a caller can't poison the metrics table. New names /
 *  surfaces MUST be added in BOTH the type union above AND these runtime arrays,
 *  or logGuideEvent drops the event silently (the type erases at runtime). */
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
