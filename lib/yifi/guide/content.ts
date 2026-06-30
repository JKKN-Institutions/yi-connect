/**
 * YiFi — "How to use the platform" guide content (single source).
 *
 * ONE smart guide that adapts to the viewer. This module is PURE DATA (strings
 * only — no JSX, no icons, no I/O) so it stays importable from BOTH client and
 * server without drift. It powers the in-app guide at app/yifi/guide/page.tsx
 * (rendered by app/yifi/_components/GuideView.tsx).
 *
 * Writing rules (12th-grader friendly):
 *   - one ACTION per step, plain verbs, no jargon
 *   - a short "journey" map per lane so the reader sees the whole arc at a glance
 *   - a clickable deep-link on every step that points at a REAL /yifi page, so the
 *     guide doubles as a launchpad (taps straight to the page it describes)
 *
 * Two lanes, mirroring YiFi's two audiences + two sign-in mechanisms:
 *   - participant: a founder attending YiFi. Enters with an access code at
 *     /yifi/join (a `yifi_session` cookie — no password, no Supabase account),
 *     then lives in /yifi/me (census → routing card → vows → dossier).
 *   - organiser: the event admin team. Signs in with email + password at
 *     /yifi/login (a real Supabase session), and works in /yifi/admin. What they
 *     can see depends on the permissions their organiser role grants.
 *
 * Every step is grounded in the live flows (app/yifi/*), not invented.
 */

export const GUIDE_LANES = ["participant", "organiser"] as const;

export type GuideLane = (typeof GUIDE_LANES)[number];

/** A deep-link straight to the page (or section) a step refers to. */
export type GuideLink = { href: string; label: string };

export type GuideStep = {
  /** Imperative one-liner — the single thing to do. */
  action: string;
  /** One sentence of plain-language help (optional). */
  detail?: string;
  /** A highlighted tip / watch-out (optional). */
  tip?: string;
  /** "Take me there" link to the actual page this step describes (optional). */
  link?: GuideLink;
};

export type GuideSection = {
  heading: string;
  steps: GuideStep[];
};

export type GuideFaq = { q: string; a: string };

/** One "Words to know" glossary entry. */
export type GuideTerm = { term: string; def: string };

export type GuideContent = {
  lane: GuideLane;
  /** Short label shown on chips / titles, e.g. "Founder". */
  label: string;
  /** Who this lane is for — one line. */
  tagline: string;
  /** The stake — why this lane matters to the reader, in one line. */
  whyItMatters: string;
  /** The single tap that drops the reader into the product to begin. */
  startHere: GuideLink;
  /** The whole arc as a few words each — rendered as a journey map. */
  journey: string[];
  sections: GuideSection[];
  faqs: GuideFaq[];
  /** Who to contact for help. */
  help: string;
};

const PARTICIPANT: GuideContent = {
  lane: "participant",
  label: "Founder",
  tagline: "For founders attending YiFi — the people in the room.",
  whyItMatters:
    "YiFi routes you to the five people most worth your time and builds a dossier around your problems — but only once your census is done.",
  startHere: { href: "/yifi/join", label: "Enter your access code" },
  journey: [
    "Enter your code",
    "Complete your census",
    "Get your routing card",
    "Meet your matches",
    "Make a vow",
    "Read your dossier",
  ],
  sections: [
    {
      heading: "Get in",
      steps: [
        {
          action: "Open the Join page and enter the access code from your YiFi confirmation.",
          detail: "No password and no account to create — the code from your registration is your key.",
          link: { href: "/yifi/join", label: "Open the Join page" },
        },
        {
          action: "Land in your portal — that's your home for the whole event.",
          detail: "Your routing card, vows and dossier all live here.",
          link: { href: "/yifi/me", label: "Open my portal" },
        },
      ],
    },
    {
      heading: "Complete your census",
      steps: [
        {
          action: "Fill in the census card at the top of your portal.",
          detail: "Your sector, city, role, and your top business challenge — it takes about two minutes.",
          link: { href: "/yifi/me", label: "Go to my portal" },
        },
        {
          action: "Add what you can offer other founders, if you like.",
          detail: "Capital, mentoring hours, distribution, customer intros — this sharpens who you get matched with.",
          tip: "Your census is what powers your matches and your dossier. Skip it and you stay unmatched.",
        },
      ],
    },
    {
      heading: "Your routing card",
      steps: [
        {
          action: "Open your routing card to see your matches.",
          detail: "Five people picked from your challenges and what you offer — no cold networking.",
          link: { href: "/yifi/me", label: "See my routing card" },
        },
        {
          action: "Check your scheduled meetings — each shows a time and a table number.",
          detail: "Meetings are 12 minutes. Be at the table at your slot time.",
          tip: "A match shows a phone number — tap it to call if you need to find each other on the day.",
        },
      ],
    },
    {
      heading: "Make your vows",
      steps: [
        {
          action: "Write a vow in any of the three areas: Business, Family & Health, or Yi / Nation Building.",
          detail: "One short commitment each — a line you'll be held to.",
          link: { href: "/yifi/me", label: "Make a vow" },
        },
        {
          action: "Watch your vow move from Active to Engraved to Placed on the Vow Wall.",
          detail: "One commitment, one witness, engraved in stone — the wall grows every year.",
        },
      ],
    },
    {
      heading: "Your dossier",
      steps: [
        {
          action: "Open your dossier once it's ready.",
          detail: "Eleven hours of stage content, filtered to your sector and your challenges — your own version of the day.",
          link: { href: "/yifi/me", label: "Check my dossier" },
        },
      ],
    },
  ],
  faqs: [
    {
      q: "My code doesn't work.",
      a: "Check your YiFi registration confirmation for the exact code — it's not case-sensitive. If it still won't open, contact the YiFi desk.",
    },
    {
      q: "Why don't I have any matches yet?",
      a: "Matches are built from your census, then curated by the organisers. Complete your census first; if it's done, your card fills in once curation runs.",
    },
    {
      q: "Do I need an app or a password?",
      a: "No. You enter with your access code, and your portal opens. There's nothing to install and no password to remember.",
    },
  ],
  help: "Find a YiFi volunteer or the registration desk at the venue — they can re-send your code and help with your portal.",
};

const ORGANISER: GuideContent = {
  lane: "organiser",
  label: "Organiser",
  tagline: "For the YiFi event team running the room.",
  whyItMatters:
    "Every founder's routing card, dossier and vow runs on the data you keep clean — census completion is the lever that makes the matching work.",
  startHere: { href: "/yifi/admin", label: "Open the event console" },
  journey: [
    "Sign in",
    "Watch the live stats",
    "Chase census completion",
    "Curate the matches",
    "Run the Vow Wall",
    "Drive the reveal",
  ],
  sections: [
    {
      heading: "Sign in",
      steps: [
        {
          action: "Sign in with your email and password on the organiser login.",
          detail: "Your access is tied to your organiser role for this YiFi edition — you'll only see the tools your role grants.",
          link: { href: "/yifi/login", label: "Go to organiser sign-in" },
        },
        {
          action: "Land in the event console.",
          detail: "Live stats up top, then a tile for each thing you manage.",
          link: { href: "/yifi/admin", label: "Open the console" },
        },
      ],
    },
    {
      heading: "Read the room",
      steps: [
        {
          action: "Check the live stats — registrants, census clusters, matches made, and vows.",
          detail: "This is your at-a-glance health check for the edition.",
          link: { href: "/yifi/admin", label: "View live stats" },
        },
      ],
    },
    {
      heading: "Registrants & census",
      steps: [
        {
          action: "Open Registrants to see everyone and their check-in and census status.",
          link: { href: "/yifi/admin/registrants", label: "Open Registrants" },
        },
        {
          action: "Use the Census Monitor to track completion and nudge whoever's incomplete.",
          detail: "Census completion is what unlocks matching — chase it first, before curating.",
          link: { href: "/yifi/admin/census", label: "Open Census Monitor" },
        },
      ],
    },
    {
      heading: "Curate the matches",
      steps: [
        {
          action: "Open Match Curation to review the routing matches.",
          detail: "Assign slot times and table numbers so each founder's 12-minute meetings are scheduled.",
          link: { href: "/yifi/admin/matches", label: "Open Match Curation" },
        },
      ],
    },
    {
      heading: "Vow Wall & dossiers",
      steps: [
        {
          action: "Open the Vow Wall to monitor submissions and track engraving and tile placement.",
          link: { href: "/yifi/admin/vows", label: "Open the Vow Wall" },
        },
        {
          action: "Open the Dossier Pipeline to watch dossier generation and delivery.",
          link: { href: "/yifi/admin/dossiers", label: "Open Dossier Pipeline" },
        },
      ],
    },
    {
      heading: "Run the reveal",
      steps: [
        {
          action: "Open the Reveal Screen in projector mode for the live moment.",
          detail: "Open it in its own window/tab on the room's screen.",
          link: { href: "/yifi/reveal", label: "Open the Reveal Screen" },
        },
      ],
    },
  ],
  faqs: [
    {
      q: "A tile is missing from my console.",
      a: "You only see the tools your organiser role grants. If you need access to Registrants, Census, Matches, Vows, Dossiers or Reveal, ask the event architect to update your role.",
    },
    {
      q: "Founders say they have no matches.",
      a: "Matching runs off the census. Check the Census Monitor first — incomplete census means no match. Once census is in, curate and assign slots in Match Curation.",
    },
    {
      q: "How do I reset my password?",
      a: "On the organiser sign-in page, use the reset link — you'll get a branded YiFi email with a secure link to set a new password.",
    },
  ],
  help: "Contact the YiFi event architect or the host-chapter chair — they manage organiser roles and access for the edition.",
};

export const GUIDES: Record<GuideLane, GuideContent> = {
  participant: PARTICIPANT,
  organiser: ORGANISER,
};

/**
 * "Words to know" — the real YiFi jargon, defined once in plain language.
 * Shown on every lane so a newcomer isn't tripped up by a term.
 */
export const GUIDE_GLOSSARY: GuideTerm[] = [
  {
    term: "Edition",
    def: "One year's YiFi event — e.g. YiFi 2026 in Madurai. Everything (registrants, matches, vows) belongs to an edition.",
  },
  {
    term: "Access code",
    def: "The code a founder uses to enter at the Join page. It's how you sign in — there's no password.",
  },
  {
    term: "Census",
    def: "The short profile a founder fills in — sector, city, challenges, and what they can offer. It powers matching and the dossier.",
  },
  {
    term: "Routing card",
    def: "A founder's set of curated matches, with scheduled 12-minute meetings showing a time and a table number.",
  },
  {
    term: "Match (introduction)",
    def: "One curated 1-on-1 meeting between two founders, picked from their challenges and offers.",
  },
  {
    term: "Cluster",
    def: "A problem-cluster — founders grouped by the challenge they share. Each cluster has its own colour.",
  },
  {
    term: "Dossier",
    def: "A personalised digest of the day's stage content, filtered to one founder's sector and challenges.",
  },
  {
    term: "Vow",
    def: "One public commitment with one witness, placed on the Vow Wall. It moves from Active to Engraved to Placed.",
  },
  {
    term: "Organiser",
    def: "A member of the event team. What an organiser can see and do depends on the permissions their role grants.",
  },
];

/** Type guard for an untrusted ?lane= query value. */
export function isGuideLane(v: string | null | undefined): v is GuideLane {
  return !!v && (GUIDE_LANES as readonly string[]).includes(v);
}

/* ── Adoption layer: progress + instrumentation (all OPTIONAL) ─────────────
 * Pure helpers + types only (no I/O) so this stays importable from client AND
 * server. A renderer with no progress/event props just shows the plain guide.
 * Cloned verbatim from the Yuva install — these are app-agnostic.
 * ────────────────────────────────────────────────────────────────────────── */

/** Stable key for one step within a lane: "<sectionIndex>:<stepIndex>". Index-
 *  based so editing a step's text never shifts a saved completion (only
 *  reordering would — the guide's order is stable). */
export function stepKey(sectionIndex: number, stepIndex: number): string {
  return `${sectionIndex}:${stepIndex}`;
}

/** Every step key in a lane, in order — the full checklist for that lane. */
export function laneStepKeys(content: GuideContent): string[] {
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
  content: GuideContent,
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
  sectionHeading: string;
  stepIndex: number;
  key: string;
  step: GuideStep;
};

/** The viewer's next unfinished step (for resume + nudges), or null if done. */
export function nextUndoneStep(
  content: GuideContent,
  completed: ReadonlySet<string>
): NextStep | null {
  for (let si = 0; si < content.sections.length; si++) {
    const s = content.sections[si];
    for (let i = 0; i < s.steps.length; i++) {
      const key = stepKey(si, i);
      if (!completed.has(key)) {
        return { sectionIndex: si, sectionHeading: s.heading, stepIndex: i, key, step: s.steps[i] };
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
  content: GuideContent,
  completed: ReadonlySet<string>
): OnboardingCta {
  const lp = laneProgress(content, completed);
  const next = nextUndoneStep(content, completed);
  if (lp.done === 0) {
    return { kind: "start", label: "Start onboarding", remaining: lp.total, target: next, complete: false };
  }
  if (next) {
    return { kind: "resume", label: "Resume onboarding", remaining: lp.total - lp.done, target: next, complete: false };
  }
  return { kind: "replay", label: "Replay walkthrough", remaining: 0, target: nextUndoneStep(content, new Set()), complete: true };
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
  | "nudge_click"
  | "onboarding_start"
  | "welcome_shown"
  | "guide_dismiss";

export type GuideSurface = "page" | "drawer" | "launcher" | "nudge" | "widget" | "welcome" | "onboarding";

export type GuideEvent = {
  name: GuideEventName;
  persona: GuideLane;
  surface: GuideSurface;
  stepKey?: string;
  context?: string;
};

/** Runtime allow-lists — logGuideEvent is a public endpoint; validate against
 *  these before insert so a caller can't poison the metrics table. */
export const GUIDE_EVENT_NAMES: readonly GuideEventName[] = [
  "guide_open",
  "lane_switch",
  "step_link_click",
  "step_complete",
  "step_uncomplete",
  "lane_complete",
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
