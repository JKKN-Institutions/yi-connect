/**
 * Yi-Future chapter role "focus" map (soft / tailored permissions).
 *
 * Decision (2026-06-29): chapter roles get a DIFFERENTIATED EXPERIENCE, not
 * hard access locks. Chair & Co-Chair oversee everything; the 4 operational
 * leads (event / outreach / mentorship / ops) each see a dashboard that names
 * their job and links straight to their tools — but NO ONE loses access to any
 * chapter page (zero lock-out risk on live production). The hard authorization
 * boundary stays at the chapter level (`requireChapterAdmin` in
 * lib/yi-future/auth/require-access.ts): every active core-team member can act
 * on their own chapter. This map only tailors emphasis.
 */

export type RoleFocus = {
  /** Short badge label for the admin shell, e.g. "Event Lead". */
  label: string;
  /** Hero heading on the chapter overview. */
  title: string;
  /** One-line description of what this role drives. */
  blurb: string;
  /** Quick links to this role's primary tools. */
  primary: { label: string; href: string }[];
};

const CHAIR_FOCUS: RoleFocus = {
  label: "Chair",
  title: "Full chapter oversight",
  blurb:
    "You oversee the whole chapter — setup, delegates, teams, the 90-day journey, mentors, experts, scoring and the final event.",
  primary: [
    { label: "Delegates", href: "/yi-future/chapter/delegates" },
    { label: "Teams", href: "/yi-future/chapter/teams" },
    { label: "Journey", href: "/yi-future/chapter/journey" },
    { label: "Results", href: "/yi-future/chapter/results" },
  ],
};

export const ROLE_FOCUS: Record<string, RoleFocus> = {
  chapter_chair: CHAIR_FOCUS,
  chapter_co_chair: { ...CHAIR_FOCUS, label: "Co-Chair" },
  chapter_event_lead: {
    label: "Event Lead",
    title: "Run the 90-day journey & final",
    blurb:
      "Your focus is the journey calendar, expert sessions and the chapter final. You still have access to everything else when you need it.",
    primary: [
      { label: "Journey", href: "/yi-future/chapter/journey" },
      { label: "Experts", href: "/yi-future/chapter/experts" },
      { label: "Final Event", href: "/yi-future/chapter/final" },
      { label: "Announcements", href: "/yi-future/chapter/announcements" },
    ],
  },
  college_outreach_lead: {
    label: "Outreach Lead",
    title: "Bring colleges & delegates in",
    blurb:
      "Your focus is college outreach and registering delegates. You still have access to everything else when you need it.",
    primary: [
      { label: "Outreach", href: "/yi-future/chapter/outreach" },
      { label: "Colleges", href: "/yi-future/chapter/colleges" },
      { label: "Delegates", href: "/yi-future/chapter/delegates" },
    ],
  },
  mentorship_content_lead: {
    label: "Mentorship Lead",
    title: "Mentors, experts & messaging",
    blurb:
      "Your focus is onboarding mentors and experts and keeping delegates informed. You still have access to everything else when you need it.",
    primary: [
      { label: "Mentors", href: "/yi-future/chapter/mentors" },
      { label: "Experts", href: "/yi-future/chapter/experts" },
      { label: "Announcements", href: "/yi-future/chapter/announcements" },
      { label: "Messages", href: "/yi-future/chapter/messages" },
    ],
  },
  ops_documentation_lead: {
    label: "Ops & Docs Lead",
    title: "Submissions, scoring & results",
    blurb:
      "Your focus is collecting submissions, running scoring and publishing results. You still have access to everything else when you need it.",
    primary: [
      { label: "Submissions", href: "/yi-future/chapter/submissions" },
      { label: "Scoring", href: "/yi-future/chapter/scoring" },
      { label: "Results", href: "/yi-future/chapter/results" },
    ],
  },
};

export function getRoleFocus(role: string | null | undefined): RoleFocus {
  return (role && ROLE_FOCUS[role]) || CHAIR_FOCUS;
}

/** Short label for the admin shell badge (e.g. "Event Lead"). */
export function roleShortLabel(role: string | null | undefined): string {
  return getRoleFocus(role).label;
}
